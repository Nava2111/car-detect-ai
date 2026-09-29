/**
 * CarDetect AI - Client-Side Controller
 * Mobile-First Vehicle Identification Powered by Google Gemini
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // State
  // =========================================================================
  const state = {
    selectedImageData: null,
    selectedMimeType: 'image/jpeg',
    selectedFileName: 'vehicle.jpg',
    isAnalyzing: false,
    apiKeyConfigured: false,
    userSessionKey: sessionStorage.getItem('gemini_session_key') || '',
    activeCameraStream: null,
    currentFacingMode: 'environment', // Rear camera by default on phones
    analysisStatusInterval: null
  };

  // =========================================================================
  // DOM Elements
  // =========================================================================
  const elements = {
    // API Status & Banner
    apiStatusBtn: document.getElementById('api-status-btn'),
    apiStatusLabel: document.getElementById('api-status-label'),
    apiAlertBanner: document.getElementById('api-alert-banner'),
    openKeyModalBtn: document.getElementById('open-key-modal-btn'),

    // Sections
    heroSection: document.getElementById('hero-section'),
    captureSection: document.getElementById('capture-section'),
    previewSection: document.getElementById('preview-section'),
    resultsSection: document.getElementById('results-section'),

    // Inputs & Triggers
    btnCamera: document.getElementById('btn-camera'),
    btnGallery: document.getElementById('btn-gallery'),
    nativeCameraInput: document.getElementById('native-camera-input'),
    nativeGalleryInput: document.getElementById('native-gallery-input'),
    dropZone: document.getElementById('drop-zone'),
    sampleChips: document.querySelectorAll('.sample-chip'),

    // Preview
    previewImage: document.getElementById('preview-image'),
    previewFilename: document.getElementById('preview-filename'),
    btnChangeImage: document.getElementById('btn-change-image'),
    scannerLaser: document.getElementById('scanner-laser'),
    scanningBadge: document.getElementById('scanning-badge'),
    scanningText: document.getElementById('scanning-text'),
    btnAnalyze: document.getElementById('btn-analyze'),

    // Results Display
    resBadgeStatus: document.getElementById('res-badge-status'),
    resBadgeText: document.getElementById('res-badge-text'),
    resConfidenceBadge: document.getElementById('res-confidence-badge'),
    resConfidenceLevel: document.getElementById('res-confidence-level') || document.getElementById('res-confidence-score'),
    resMake: document.getElementById('res-make'),
    resModel: document.getElementById('res-model'),
    resVariant: document.getElementById('res-variant'),
    resUncertaintyBox: document.getElementById('res-uncertainty-box'),
    resUncertaintyNote: document.getElementById('res-uncertainty-note'),
    resNonVehicleBox: document.getElementById('res-non-vehicle-box'),
    resDescription: document.getElementById('res-description'),
    resReasoning: document.getElementById('res-reasoning'),
    specMake: document.getElementById('spec-make'),
    specModel: document.getElementById('spec-model'),
    specYear: document.getElementById('spec-year'),
    specBody: document.getElementById('spec-body'),
    specColor: document.getElementById('spec-color'),
    specColorDot: document.getElementById('spec-color-dot'),
    specConfidence: document.getElementById('spec-confidence'),
    featuresCount: document.getElementById('features-count'),
    featuresList: document.getElementById('features-list'),
    btnCopyReport: document.getElementById('btn-copy-report'),
    btnScanAnother: document.getElementById('btn-scan-another'),
    btnNewScan: document.getElementById('btn-new-scan'),

    // In-App Camera Modal
    cameraModal: document.getElementById('camera-modal'),
    cameraVideo: document.getElementById('camera-video'),
    cameraCanvas: document.getElementById('camera-canvas'),
    btnCloseCamera: document.getElementById('btn-close-camera'),
    btnFlipCamera: document.getElementById('btn-flip-camera'),
    btnCaptureShutter: document.getElementById('btn-capture-shutter'),
    btnCameraUploadFallback: document.getElementById('btn-camera-upload-fallback'),

    // API Key Modal
    keyModal: document.getElementById('key-modal'),
    btnCloseKeyModal: document.getElementById('btn-close-key-modal'),
    inputSessionKey: document.getElementById('input-session-key'),
    btnSaveSessionKey: document.getElementById('btn-save-session-key'),

    // Toast Container
    toastContainer: document.getElementById('toast-container')
  };

  // =========================================================================
  // Initialize App
  // =========================================================================
  checkServerApiStatus();
  setupEventListeners();

  // =========================================================================
  // API Health Check
  // =========================================================================
  async function checkServerApiStatus() {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error('Status endpoint unreachable');
      const data = await res.json();
      
      state.apiKeyConfigured = data.apiKeyConfigured || !!state.userSessionKey;
      updateStatusUI();
    } catch (err) {
      console.warn('Could not verify server status:', err);
      state.apiKeyConfigured = !!state.userSessionKey;
      updateStatusUI();
    }
  }

  function updateStatusUI() {
    if (state.apiKeyConfigured) {
      elements.apiStatusBtn.className = 'status-pill status-online';
      elements.apiStatusLabel.textContent = 'Gemini AI Ready';
      elements.apiAlertBanner.classList.add('hidden');
    } else {
      elements.apiStatusBtn.className = 'status-pill status-warning';
      elements.apiStatusLabel.textContent = 'API Key Needed';
      elements.apiAlertBanner.classList.remove('hidden');
    }
  }

  // =========================================================================
  // Event Listeners Setup
  // =========================================================================
  function setupEventListeners() {
    // 1. Camera Trigger
    elements.btnCamera.addEventListener('click', () => {
      // If mobile device or camera support is available, attempt native input or in-app viewfinder
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        // Native mobile camera triggers the native high-res camera app directly
        elements.nativeCameraInput.click();
      } else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // Desktop / Laptop with webcam or browser: open interactive viewfinder
        openCameraViewfinder();
      } else {
        elements.nativeCameraInput.click();
      }
    });

    // Native Camera input change
    elements.nativeCameraInput.addEventListener('change', (e) => {
      handleFileSelected(e.target.files[0], 'camera_photo.jpg');
      elements.nativeCameraInput.value = '';
    });

    // 2. Photo Library / Gallery Trigger
    elements.btnGallery.addEventListener('click', () => {
      elements.nativeGalleryInput.click();
    });

    // Native Gallery input change
    elements.nativeGalleryInput.addEventListener('change', (e) => {
      handleFileSelected(e.target.files[0]);
      elements.nativeGalleryInput.value = '';
    });

    // 3. Drag and Drop Zone
    ['dragenter', 'dragover'].forEach(name => {
      elements.dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.dropZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      elements.dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.dropZone.classList.remove('dragover');
      });
    });

    elements.dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const file = dt.files[0];
      if (file && file.type.startsWith('image/')) {
        handleFileSelected(file);
      } else {
        showToast('Please drop a valid image file.', 'warning');
      }
    });

    // Dropzone click fallback to gallery
    elements.dropZone.addEventListener('click', () => {
      elements.nativeGalleryInput.click();
    });

    // 4. Sample Vehicle Presets
    elements.sampleChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        const sampleType = e.currentTarget.dataset.sample;
        loadSampleVehicle(sampleType);
      });
    });

    // 5. Change Photo
    elements.btnChangeImage.addEventListener('click', resetToCapture);

    // 6. Analyze Vehicle
    elements.btnAnalyze.addEventListener('click', startVehicleAnalysis);

    // 7. Results Actions
    elements.btnScanAnother.addEventListener('click', resetToCapture);
    elements.btnNewScan.addEventListener('click', resetToCapture);
    elements.btnCopyReport.addEventListener('click', copySpecsToClipboard);

    // 8. In-App Camera Viewfinder Controls
    elements.btnCloseCamera.addEventListener('click', closeCameraViewfinder);
    elements.btnFlipCamera.addEventListener('click', flipCamera);
    elements.btnCaptureShutter.addEventListener('click', captureCameraPhoto);
    elements.btnCameraUploadFallback.addEventListener('click', () => {
      closeCameraViewfinder();
      elements.nativeGalleryInput.click();
    });

    // 9. API Key Modal Controls
    elements.apiStatusBtn.addEventListener('click', openKeyModal);
    elements.openKeyModalBtn.addEventListener('click', openKeyModal);
    elements.btnCloseKeyModal.addEventListener('click', closeKeyModal);
    elements.btnSaveSessionKey.addEventListener('click', saveSessionApiKey);
  }

  // =========================================================================
  // Image Selection & Processing
  // =========================================================================
  function handleFileSelected(file, fallbackName = null) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Selected file must be an image.', 'warning');
      return;
    }

    state.selectedFileName = file.name || fallbackName || 'vehicle.jpg';
    state.selectedMimeType = file.type || 'image/jpeg';

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target.result;
      // Pre-process and optimize image size for fast upload
      optimizeImage(rawDataUrl, 1920, 0.88, (optimizedDataUrl) => {
        state.selectedImageData = optimizedDataUrl;
        displayImagePreview(optimizedDataUrl, state.selectedFileName);
      });
    };
    reader.readAsDataURL(file);
  }

  /**
   * Scales down ultra-high resolution mobile photos (e.g. 48MP)
   * to high-quality 1080p-1440p to prevent timeouts and optimize Gemini processing
   */
  function optimizeImage(dataUrl, maxDimension, quality, callback) {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const mime = state.selectedMimeType === 'image/png' ? 'image/png' : 'image/jpeg';
      callback(canvas.toDataURL(mime, quality));
    };
    img.onerror = () => {
      callback(dataUrl);
    };
    img.src = dataUrl;
  }

  function displayImagePreview(dataUrl, filename) {
    elements.previewImage.src = dataUrl;
    elements.previewFilename.textContent = filename;

    // Transition sections
    elements.heroSection.classList.add('hidden');
    elements.captureSection.classList.add('hidden');
    elements.resultsSection.classList.add('hidden');
    elements.previewSection.classList.remove('hidden');

    elements.previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetToCapture() {
    state.selectedImageData = null;
    elements.previewImage.src = '';
    elements.previewSection.classList.add('hidden');
    elements.resultsSection.classList.add('hidden');
    elements.heroSection.classList.remove('hidden');
    elements.captureSection.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // =========================================================================
  // Sample Car Presets (Instant Demo Mode)
  // =========================================================================
  function loadSampleVehicle(type) {
    // Generate an illustrative canvas vehicle for instant testing
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 700;
    const ctx = canvas.getContext('2d');

    if (type === 'gt3') {
      renderPorscheSample(ctx);
      state.selectedFileName = 'porsche_911_gt3.jpg';
    } else if (type === 'model3') {
      renderTeslaSample(ctx);
      state.selectedFileName = 'tesla_model_3.jpg';
    } else {
      renderSuvSample(ctx);
      state.selectedFileName = 'toyota_rav4_suv.jpg';
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    state.selectedImageData = dataUrl;
    state.selectedMimeType = 'image/jpeg';
    displayImagePreview(dataUrl, state.selectedFileName);
    showToast('Loaded sample vehicle. Tap "Analyze Vehicle" to test!', 'success');
  }

  function renderPorscheSample(ctx) {
    // Dark modern showroom asphalt
    const grad = ctx.createLinearGradient(0, 0, 0, 700);
    grad.addColorStop(0, '#0a0d18');
    grad.addColorStop(0.6, '#141a2e');
    grad.addColorStop(1, '#070a12');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1000, 700);

    // Floor reflection grid
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 1000; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 460); ctx.lineTo(x + (x - 500) * 1.5, 700); ctx.stroke();
    }

    // Car silhouette - Porsche 911 GT3 in Shark Blue
    ctx.save();
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.ellipse(500, 520, 380, 45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#0284c7'; // Vivid Shark Blue
    ctx.beginPath();
    ctx.moveTo(180, 480);
    ctx.bezierCurveTo(220, 420, 310, 400, 380, 380); // Front hood
    ctx.bezierCurveTo(450, 310, 560, 300, 680, 340); // Roofline curve
    ctx.bezierCurveTo(760, 370, 840, 430, 860, 480); // Rear slope
    ctx.lineTo(820, 500);
    ctx.lineTo(200, 500);
    ctx.closePath();
    ctx.fill();

    // Swan-neck Rear Wing
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(800, 320, 90, 14);
    ctx.fillRect(820, 334, 10, 45);
    ctx.fillRect(860, 334, 10, 45);

    // Windows
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(410, 375);
    ctx.bezierCurveTo(470, 320, 550, 315, 660, 345);
    ctx.bezierCurveTo(620, 385, 520, 390, 410, 390);
    ctx.closePath();
    ctx.fill();

    // Wheels (Center-lock wheels)
    drawWheel(ctx, 310, 500, 52, '#d4d4d8');
    drawWheel(ctx, 740, 500, 54, '#d4d4d8');

    // Matrix LED Headlight beam
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath(); ctx.ellipse(220, 440, 18, 10, -0.2, 0, Math.PI * 2); ctx.fill();

    // Badge & Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Space Grotesk, sans-serif';
    ctx.fillText('PORSCHE 911 GT3 (992)', 370, 620);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '14px Plus Jakarta Sans, sans-serif';
    ctx.fillText('Sample Demonstration Image • Shark Blue Coupe', 360, 645);
    ctx.restore();
  }

  function renderTeslaSample(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 700);
    grad.addColorStop(0, '#111827');
    grad.addColorStop(1, '#030712');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1000, 700);

    ctx.save();
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.ellipse(500, 520, 370, 40, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body (Red Multi-Coat Tesla Model 3)
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(170, 480);
    ctx.bezierCurveTo(240, 430, 320, 410, 400, 390);
    ctx.bezierCurveTo(480, 330, 600, 330, 710, 370);
    ctx.bezierCurveTo(790, 410, 840, 450, 860, 480);
    ctx.lineTo(820, 505);
    ctx.lineTo(190, 505);
    ctx.closePath();
    ctx.fill();

    // Panoramic Glass Roof
    ctx.fillStyle = '#030712';
    ctx.beginPath();
    ctx.moveTo(420, 380);
    ctx.bezierCurveTo(480, 340, 580, 340, 690, 375);
    ctx.bezierCurveTo(640, 405, 520, 405, 420, 400);
    ctx.closePath();
    ctx.fill();

    // Wheels
    drawWheel(ctx, 300, 500, 50, '#52525b');
    drawWheel(ctx, 730, 500, 50, '#52525b');

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Space Grotesk, sans-serif';
    ctx.fillText('TESLA MODEL 3 SEDAN', 380, 620);
    ctx.fillStyle = '#f87171';
    ctx.font = '14px Plus Jakarta Sans, sans-serif';
    ctx.fillText('Sample Demonstration Image • Red Multi-Coat EV', 360, 645);
    ctx.restore();
  }

  function renderSuvSample(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 700);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1000, 700);

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath(); ctx.ellipse(500, 530, 380, 42, 0, 0, Math.PI * 2); ctx.fill();

    // SUV tall profile (Silver Metallic)
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(160, 480);
    ctx.bezierCurveTo(220, 430, 310, 410, 370, 380);
    ctx.lineTo(440, 320); // Upright windshield
    ctx.lineTo(750, 320); // Long roof
    ctx.lineTo(820, 430); // Upright tailgate
    ctx.lineTo(840, 505);
    ctx.lineTo(180, 505);
    ctx.closePath();
    ctx.fill();

    // Roof rails
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(470, 312, 270, 8);

    // Large rugged wheels
    drawWheel(ctx, 300, 505, 58, '#334155');
    drawWheel(ctx, 720, 505, 58, '#334155');

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Space Grotesk, sans-serif';
    ctx.fillText('COMPACT CROSSOVER SUV', 360, 620);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '14px Plus Jakarta Sans, sans-serif';
    ctx.fillText('Sample Demonstration Image • Silver Metallic All-Wheel Drive', 315, 645);
    ctx.restore();
  }

  function drawWheel(ctx, x, y, radius, color) {
    ctx.fillStyle = '#18181b'; // Tire
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = color; // Rim
    ctx.beginPath(); ctx.arc(x, y, radius - 14, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#09090b'; // Hub
    ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
  }

  // =========================================================================
  // Vehicle Analysis (Backend Call)
  // =========================================================================
  async function startVehicleAnalysis() {
    if (state.isAnalyzing) return;
    if (!state.selectedImageData) {
      showToast('Please select or take a photo of a vehicle first.', 'warning');
      return;
    }

    setAnalyzingState(true);

    try {
      const headers = { 'Content-Type': 'application/json' };
      // Include session API key if user provided one in modal
      if (state.userSessionKey) {
        headers['x-gemini-api-key'] = state.userSessionKey;
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          image: state.selectedImageData,
          mimeType: state.selectedMimeType
        })
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.error === 'API_KEY_MISSING') {
          openKeyModal();
          throw new Error('GEMINI_API_KEY is not set. Please provide your key in .env or the setup modal.');
        }
        throw new Error(result.message || 'Vehicle analysis failed.');
      }

      if (result.success && result.data) {
        displayVehicleReport(result.data);
      } else {
        throw new Error('Invalid analysis data returned from server.');
      }

    } catch (err) {
      console.error('Analysis error:', err);
      showToast(err.message, 'error');
    } finally {
      setAnalyzingState(false);
    }
  }

  function setAnalyzingState(isBusy) {
    state.isAnalyzing = isBusy;
    elements.btnAnalyze.disabled = isBusy;

    if (isBusy) {
      elements.btnAnalyze.querySelector('.btn-analyze-content').classList.add('hidden');
      elements.btnAnalyze.querySelector('.btn-loader').classList.remove('hidden');
      elements.scannerLaser.classList.remove('hidden');
      elements.scanningBadge.classList.remove('hidden');

      // Ticker status messages
      const messages = [
        'Analyzing vehicle geometry...',
        'Detecting make, badges & headlights...',
        'Consulting Gemini AI vision model...',
        'Extracting trim & visible features...',
        'Finalizing vehicle specifications...'
      ];
      let msgIndex = 0;
      elements.scanningText.textContent = messages[0];
      state.analysisStatusInterval = setInterval(() => {
        msgIndex = (msgIndex + 1) % messages.length;
        elements.scanningText.textContent = messages[msgIndex];
      }, 1600);

    } else {
      elements.btnAnalyze.querySelector('.btn-analyze-content').classList.remove('hidden');
      elements.btnAnalyze.querySelector('.btn-loader').classList.add('hidden');
      elements.scannerLaser.classList.add('hidden');
      elements.scanningBadge.classList.add('hidden');
      clearInterval(state.analysisStatusInterval);
    }
  }

  // =========================================================================
  // Display Vehicle Report
  // =========================================================================
  function displayVehicleReport(data) {
    // 1. Check if vehicle was recognized
    if (!data.is_vehicle) {
      elements.resBadgeStatus.className = 'badge badge-ambiguous';
      elements.resBadgeText.textContent = 'Non-Vehicle';
      elements.resMake.textContent = 'No Vehicle';
      elements.resModel.textContent = 'Non-Automotive Object';
      elements.resVariant.textContent = '-';
      elements.resNonVehicleBox.classList.remove('hidden');
      elements.resUncertaintyBox.classList.add('hidden');
    } else {
      elements.resNonVehicleBox.classList.add('hidden');
      
      // Make & Model
      elements.resMake.textContent = data.make || 'Undetermined';
      elements.resModel.textContent = data.model || 'Unknown Model';
      elements.resVariant.textContent = data.variant && data.variant !== 'null' ? data.variant : 'Standard / Base Trim';

      // Exact Model Determination / Truthfulness Rule
      if (data.exact_model_determined === false) {
        elements.resBadgeStatus.className = 'badge badge-ambiguous';
        elements.resBadgeText.textContent = 'Model Uncertain';
        elements.resUncertaintyBox.classList.remove('hidden');
        elements.resUncertaintyNote.textContent = data.uncertainty_note 
          || 'The exact model cannot be determined definitively from the visible angle. See plausible specs below.';
      } else {
        elements.resBadgeStatus.className = 'badge badge-verified';
        elements.resBadgeText.textContent = 'Identified';
        elements.resUncertaintyBox.classList.add('hidden');
      }
    }

    // Confidence: Qualitative High, Medium, Low assessment (no numerical percentages)
    const rawConf = String(data.confidence_level || 'Medium').trim().toLowerCase();
    const confLevel = rawConf.startsWith('high')
      ? 'High'
      : rawConf.startsWith('low')
      ? 'Low'
      : 'Medium';

    if (elements.resConfidenceLevel) {
      elements.resConfidenceLevel.textContent = confLevel;
    }
    elements.specConfidence.textContent = `${confLevel} Confidence`;

    // Apply color-coded styling for qualitative confidence badge
    elements.resConfidenceBadge.className = `badge badge-confidence badge-confidence-${confLevel.toLowerCase()}`;

    // AI Summary
    elements.resDescription.textContent = data.short_description || 'Vehicle detected from visual analysis.';
    elements.resReasoning.textContent = data.confidence_reasoning || 'Based on overall silhouette and visible exterior features.';

    // Specifications Matrix
    elements.specMake.textContent = data.make || 'Undetermined';
    elements.specModel.textContent = data.model || 'Undetermined';
    elements.specYear.textContent = data.approximate_year_or_generation || 'Unknown';
    elements.specBody.textContent = data.body_type || 'Automobile';
    elements.specColor.textContent = data.colour || 'Unidentified';
    updateColorDot(elements.specColorDot, data.colour);

    // Visible Features Chips
    elements.featuresList.innerHTML = '';
    const features = Array.isArray(data.visible_features) ? data.visible_features : [];
    elements.featuresCount.textContent = `${features.length} detected`;

    if (features.length === 0) {
      elements.featuresList.innerHTML = '<span class="feature-chip">No specific trim features discerned</span>';
    } else {
      features.forEach(feat => {
        const chip = document.createElement('span');
        chip.className = 'feature-chip';
        chip.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>${escapeHtml(feat)}</span>
        `;
        elements.featuresList.appendChild(chip);
      });
    }

    // Show Results Section
    elements.previewSection.classList.add('hidden');
    elements.resultsSection.classList.remove('hidden');
    elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('Vehicle analysis complete!', 'success');
  }

  function updateColorDot(dotEl, colorName) {
    if (!dotEl) return;
    if (!colorName || colorName.toLowerCase().includes('cannot be reliably determined')) {
      dotEl.style.backgroundColor = 'transparent';
      dotEl.style.border = '1.5px dashed #94a3b8';
      return;
    }
    
    dotEl.style.border = '1.5px solid rgba(255, 255, 255, 0.4)';
    const lower = colorName.toLowerCase();

    if (lower.includes('blue')) dotEl.style.backgroundColor = '#2563eb';
    else if (lower.includes('red')) dotEl.style.backgroundColor = '#dc2626';
    else if (lower.includes('black')) dotEl.style.backgroundColor = '#18181b';
    else if (lower.includes('white')) dotEl.style.backgroundColor = '#f8fafc';
    else if (lower.includes('silver')) dotEl.style.backgroundColor = '#cbd5e1';
    else if (lower.includes('grey') || lower.includes('gray')) dotEl.style.backgroundColor = '#64748b';
    else if (lower.includes('yellow')) dotEl.style.backgroundColor = '#eab308';
    else if (lower.includes('orange')) dotEl.style.backgroundColor = '#ea580c';
    else if (lower.includes('green')) dotEl.style.backgroundColor = '#16a34a';
    else if (lower.includes('brown')) dotEl.style.backgroundColor = '#78350f';
    else if (lower.includes('purple')) dotEl.style.backgroundColor = '#9333ea';
    else if (lower.includes('gold')) dotEl.style.backgroundColor = '#d97706';
    else dotEl.style.backgroundColor = '#38bdf8';
  }

  // =========================================================================
  // In-App Live Camera Viewfinder (WebRTC)
  // =========================================================================
  async function openCameraViewfinder() {
    elements.cameraModal.classList.remove('hidden');
    await startCameraStream();
  }

  async function startCameraStream() {
    stopCameraStream();
    try {
      const constraints = {
        video: {
          facingMode: { ideal: state.currentFacingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      state.activeCameraStream = stream;
      elements.cameraVideo.srcObject = stream;
    } catch (err) {
      console.warn('Camera stream error:', err);
      closeCameraViewfinder();
      showToast('Camera permission denied or camera unavailable. Using file picker.', 'warning');
      elements.nativeCameraInput.click();
    }
  }

  function stopCameraStream() {
    if (state.activeCameraStream) {
      state.activeCameraStream.getTracks().forEach(track => track.stop());
      state.activeCameraStream = null;
    }
  }

  function closeCameraViewfinder() {
    stopCameraStream();
    elements.cameraModal.classList.add('hidden');
  }

  function flipCamera() {
    state.currentFacingMode = state.currentFacingMode === 'environment' ? 'user' : 'environment';
    startCameraStream();
  }

  function captureCameraPhoto() {
    const video = elements.cameraVideo;
    const canvas = elements.cameraCanvas;
    
    if (!video.videoWidth || !video.videoHeight) {
      showToast('Camera feed not ready yet.', 'warning');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    closeCameraViewfinder();

    state.selectedImageData = dataUrl;
    state.selectedMimeType = 'image/jpeg';
    state.selectedFileName = 'captured_vehicle.jpg';
    displayImagePreview(dataUrl, state.selectedFileName);
  }

  // =========================================================================
  // API Key Setup Modal
  // =========================================================================
  function openKeyModal() {
    if (state.userSessionKey) {
      elements.inputSessionKey.value = state.userSessionKey;
    }
    elements.keyModal.classList.remove('hidden');
  }

  function closeKeyModal() {
    elements.keyModal.classList.add('hidden');
  }

  function saveSessionApiKey() {
    const key = elements.inputSessionKey.value.trim();
    if (!key) {
      showToast('Please enter a valid Gemini API key.', 'warning');
      return;
    }

    state.userSessionKey = key;
    sessionStorage.setItem('gemini_session_key', key);
    state.apiKeyConfigured = true;
    updateStatusUI();
    closeKeyModal();
    showToast('Session API Key saved! Ready to analyze.', 'success');
  }

  // =========================================================================
  // Copy Vehicle Specs to Clipboard
  // =========================================================================
  function copySpecsToClipboard() {
    const make = elements.resMake.textContent;
    const model = elements.resModel.textContent;
    const variant = elements.resVariant.textContent;
    const year = elements.specYear.textContent;
    const color = elements.specColor.textContent;
    const body = elements.specBody.textContent;
    const confidence = elements.specConfidence.textContent;
    const desc = elements.resDescription.textContent;

    const text = `🚗 CarDetect AI Vehicle Report\n` +
      `--------------------------------\n` +
      `Make: ${make}\n` +
      `Model: ${model}\n` +
      `Variant: ${variant}\n` +
      `Generation/Year: ${year}\n` +
      `Body Type: ${body}\n` +
      `Colour: ${color}\n` +
      `Confidence: ${confidence}\n` +
      `Description: ${desc}\n` +
      `Identified with Google Gemini Vision AI`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Vehicle report copied to clipboard!', 'success');
      }).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast('Vehicle report copied to clipboard!', 'success');
    } catch (e) {
      showToast('Could not copy report to clipboard.', 'error');
    }
    document.body.removeChild(textArea);
  }

  // =========================================================================
  // Toast System
  // =========================================================================
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

});
