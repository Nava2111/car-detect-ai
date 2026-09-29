require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Enable CORS and increase JSON payload limit for high-res mobile photos
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Health check & configuration status endpoint
 * Note: Never exposes the actual key to frontend
 */
app.get('/api/status', (req, res) => {
  const hasEnvKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
  res.json({
    status: 'online',
    appName: 'CarDetect AI',
    apiKeyConfigured: hasEnvKey,
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  });
});

/**
 * Vehicle analysis prompt designed to strictly enforce truthful identification
 * and discourage hallucination when models are ambiguous or obscured.
 */
const SYSTEM_PROMPT = `You are CarDetect AI, an expert computer vision and automotive appraiser assistant.
Your task is to analyze the provided image and extract detailed, accurate vehicle specifications.

CRITICAL TRUTHFULNESS & ACCURACY RULE:
- If the exact model cannot be determined (e.g. obscured view, aftermarket body kit, partial crop, bad lighting, generic silhouette, or lack of distinguishing badges/lines), YOU MUST EXPLICITLY STATE THAT THE EXACT MODEL CANNOT BE DETERMINED instead of guessing or inventing an answer.
- Set "exact_model_determined" to false in such cases.
- Explain in "uncertainty_note" what prevents positive identification and list potential plausible candidates if any.
- If the image contains NO vehicle or automobile, set "is_vehicle" to false and explain in "short_description".

CONFIDENCE LEVEL ASSESSMENT RULE:
- "confidence_level": "High" | "Medium" | "Low"
- Use "High" ONLY when there is strong visual evidence (e.g. distinct badges, clear grille/headlight signature, unambiguous body styling, and clear angle/lighting).
- Use "Medium" when the identification is plausible but uncertain (e.g. partially visible angle, obscured emblems, common platform silhouette, or minor aftermarket changes).
- Use "Low" when the image does not provide enough evidence (e.g. heavy shadows, blurry/distant crop, debadged, or severe modifications).
- Do not provide numerical percentages.

STRICT VEHICLE COLOUR DETECTION RULES (MANDATORY):
1. Identify the colour ONLY from the visible pixels of the uploaded image.
2. Do NOT infer the colour from the vehicle model, trim, generation, or known factory paint options.
3. Do NOT automatically convert a visible colour into a manufacturer's paint name (e.g. do not assume "Shark Blue", "Nardo Grey", "Alpine White", or "Portimao Blue" based on the model).
4. First determine a simple visible colour such as:
   - Black
   - White
   - Grey
   - Silver
   - Blue
   - Red
   - Green
   - Yellow
   - Orange
   - Brown
   - Purple
   - Gold
   - Other
5. If the lighting, reflections, shadows, or image quality make the colour uncertain, say:
   "Colour cannot be reliably determined from this image."
6. If two colours are plausible (e.g. dark blue vs black, grey vs silver, dark green vs black), report:
   "Appears to be [colour], but lighting may affect the appearance." (e.g., "Appears to be Blue, but lighting may affect the appearance.")
7. Only mention a specific factory colour name if the image provides very strong visual evidence. Otherwise use the simple visible colour.
8. Do not let the detected vehicle model influence the colour result under any circumstances.
9. Before returning the result, perform a visual colour check:
   "What colour does the vehicle body actually appear to be in this uploaded image?"
   Accuracy of the visible colour is more important than identifying a specific manufacturer paint name.

Return a valid JSON object matching this schema:
{
  "is_vehicle": boolean,
  "exact_model_determined": boolean,
  "make": string,
  "model": string,
  "variant": string,
  "approximate_year_or_generation": string,
  "colour": string,
  "body_type": string,
  "visible_features": string[],
  "confidence_level": "High" | "Medium" | "Low",
  "confidence_reasoning": string,
  "short_description": string,
  "uncertainty_note": string | null
}`;

/**
 * Main Vehicle Analysis Endpoint
 */
app.post('/api/analyze', async (req, res) => {
  try {
    const { image, mimeType } = req.body;

    // Resolve API Key: Environment variable GEMINI_API_KEY takes priority
    const apiKey = (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) 
      || (req.headers['x-gemini-api-key'] && req.headers['x-gemini-api-key'].trim());

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return res.status(401).json({
        error: 'API_KEY_MISSING',
        message: 'GEMINI_API_KEY is not configured on the server. Please add your GEMINI_API_KEY to the .env file or server environment variables.'
      });
    }

    if (!image) {
      return res.status(400).json({
        error: 'IMAGE_REQUIRED',
        message: 'No image data provided. Please capture or upload a vehicle photo.'
      });
    }

    // Extract raw base64 data and mime type
    let cleanBase64 = image;
    let detectedMime = mimeType || 'image/jpeg';

    if (image.startsWith('data:')) {
      const match = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (match) {
        detectedMime = match[1];
        cleanBase64 = match[2];
      } else {
        const parts = image.split(',');
        cleanBase64 = parts[1] || parts[0];
      }
    }

    let analysisResult = null;
    let lastError = null;

    // Ordered list of models compatible with Google Gemini API
    const modelsToTry = [
      'gemini-3-flash-preview',
      'gemini-3.1-flash-lite-preview',
      'gemini-3.8-flash',
      'gemini-flash-latest'
    ];

    // Attempt 1: Using official @google/genai SDK
    const ai = new GoogleGenAI({ apiKey });
    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                { text: 'Analyze this image and identify the vehicle details according to the required JSON schema. Strictly adhere to the colour rules: determine visible colour only from the visible pixels without inferring from the vehicle model or paint catalogs. If the exact model cannot be determined, say so explicitly.' },
                {
                  inlineData: {
                    mimeType: detectedMime,
                    data: cleanBase64
                  }
                }
              ]
            }
          ],
          config: {
            systemInstruction: SYSTEM_PROMPT,
            responseMimeType: 'application/json'
          }
        });

        const responseText = response.text || (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text);
        if (responseText) {
          analysisResult = parseJsonSafe(responseText);
          if (analysisResult) {
            console.log(`Successfully analyzed vehicle using model: ${modelName}`);
            break;
          }
        }
      } catch (errModel) {
        lastError = errModel;
        console.warn(`Model ${modelName} attempt failed:`, errModel.message?.slice(0, 120));
      }
    }

    // Attempt 2: Fallback using @google/generative-ai SDK if needed
    if (!analysisResult) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        for (const modelName of modelsToTry) {
          try {
            const model = genAI.getGenerativeModel({
              model: modelName,
              generationConfig: {
                responseMimeType: 'application/json'
              },
              systemInstruction: SYSTEM_PROMPT
            });

            const result = await model.generateContent([
              'Analyze this image and identify the vehicle details according to the required JSON schema. Strictly adhere to the colour rules: determine visible colour only from the visible pixels without inferring from the vehicle model or paint catalogs. If the exact model cannot be determined, say so explicitly.',
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType: detectedMime
                }
              }
            ]);

            const text = result.response.text();
            if (text) {
              analysisResult = parseJsonSafe(text);
              if (analysisResult) break;
            }
          } catch (modelErr) {
            lastError = modelErr;
          }
        }
      } catch (err2) {
        lastError = err2;
      }
    }

    if (!analysisResult) {
      throw lastError || new Error('Failed to obtain a valid analysis response from Gemini API.');
    }

    // Format and normalize the response payload
    const formattedData = normalizeVehicleData(analysisResult);
    return res.json({
      success: true,
      data: formattedData,
      analyzedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Vehicle analysis error:', error);
    return res.status(500).json({
      error: 'ANALYSIS_FAILED',
      message: error.message || 'An error occurred while analyzing the vehicle image with Gemini AI.'
    });
  }
});

/**
 * Safely parses JSON string even if wrapped in markdown fences
 */
function parseJsonSafe(text) {
  if (!text) return null;
  let cleanText = text.trim();
  
  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```\s*/, '').replace(/```\s*$/, '');
  }
  
  try {
    return JSON.parse(cleanText.trim());
  } catch (e) {
    console.warn('Failed to direct parse JSON, attempting regex extraction:', e.message);
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerErr) {
        console.error('Regex JSON extract failed:', innerErr.message);
      }
    }
    return null;
  }
}

/**
 * Normalizes vehicle data schema to ensure all expected fields exist
 */
function normalizeVehicleData(raw) {
  const isVehicle = raw.is_vehicle !== false;
  const exactDetermined = raw.exact_model_determined !== false && isVehicle;

  // Determine qualitative confidence level (High, Medium, Low)
  let confidenceLevel = 'Medium';
  if (typeof raw.confidence_level === 'string') {
    const cl = raw.confidence_level.trim().toLowerCase();
    if (cl.startsWith('high')) {
      confidenceLevel = 'High';
    } else if (cl.startsWith('low')) {
      confidenceLevel = 'Low';
    } else {
      confidenceLevel = 'Medium';
    }
  } else if (exactDetermined) {
    confidenceLevel = 'High';
  }

  return {
    is_vehicle: isVehicle,
    exact_model_determined: exactDetermined,
    make: raw.make || (isVehicle ? 'Undetermined' : 'N/A'),
    model: raw.model || (isVehicle ? 'Undetermined' : 'N/A'),
    variant: raw.variant || 'Standard / Base or Unidentified',
    approximate_year_or_generation: raw.approximate_year_or_generation || raw.approximate_generation || raw.year || 'Unknown / Not distinguishable',
    colour: raw.colour || raw.color || 'Unidentified',
    body_type: raw.body_type || (isVehicle ? 'Automobile' : 'Non-vehicle'),
    visible_features: Array.isArray(raw.visible_features) && raw.visible_features.length > 0 
      ? raw.visible_features 
      : ['No specific aero or trim features discerned'],
    confidence_level: confidenceLevel,
    confidence_reasoning: raw.confidence_reasoning || 'Visual feature mapping based on front/rear profile.',
    short_description: raw.short_description || 'Vehicle detected from visual analysis.',
    uncertainty_note: raw.uncertainty_note || (exactDetermined ? null : 'The exact model could not be definitively confirmed from the visible angles or badges.')
  };
}

/**
 * Helper to discover local Wi-Fi / LAN IP address
 */
function getNetworkIp() {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Start server listening on all network interfaces (0.0.0.0)
app.listen(PORT, HOST, () => {
  const lanIp = getNetworkIp();
  console.log(`===============================================`);
  console.log(`🚗 CarDetect AI Server running on port ${PORT}`);
  console.log(`💻 Local URL:   http://localhost:${PORT}`);
  console.log(`📱 Phone URL:   http://${lanIp}:${PORT}`);
  console.log(`🔑 GEMINI_API_KEY configured: ${process.env.GEMINI_API_KEY ? 'YES (from environment)' : 'NO (needs setup in .env)'}`);
  console.log(`===============================================`);
});
