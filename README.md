# 🚗 CarDetect AI

A sleek, mobile-friendly web application for instant vehicle identification powered by **Google Gemini Vision AI** using the official Google Gemini SDK.

---

## ✨ Features

- **📱 Mobile-First Camera Capture**: Take a real-time photo of any vehicle using your phone camera (native `capture="environment"` or interactive in-app viewfinder).
- **🖼️ Photo Library Upload**: Select any automotive photo from your device's photo gallery or drag & drop files.
- **⚡ Quick Demo Presets**: Includes instant 1-tap vehicle presets for rapid testing without requiring file uploads.
- **🔍 Vehicle Preview & Laser HUD**: High-tech automotive framing reticle and animated laser scanline effect during analysis.
- **🧠 Comprehensive Vehicle Intelligence**:
  - **Make** (Manufacturer)
  - **Model** (e.g. 911, Model 3, Civic, Mustang)
  - **Variant / Trim Level** (e.g. GT3 RS, Long Range, Competition)
  - **Approximate Generation & Year** (e.g. 992 Generation ~2021-2024)
  - **Exterior Colour** (e.g. Shark Blue, Obsidian Black)
  - **Body Type** (Coupe, Sedan, SUV, Hatchback, Convertible, Pickup)
  - **Visible Exterior Features** (Aero wings, headlights, exhaust tips, alloy wheels, calipers)
  - **Confidence Assessment & Score** (High / Medium / Low + percentage)
  - **Concise AI Summary**
- **🛡️ Strict Truthfulness & Anti-Hallucination**:
  - If an exact model cannot be determined (e.g. obscured angle, bad lighting, aftermarket body modifications, debadged vehicle), the AI explicitly identifies the ambiguity and provides plausible candidates instead of guessing or inventing an answer.
  - If a non-vehicle image is submitted, the app informs the user politely.
- **📋 Copy & Share Report**: Copy structured vehicle specifications to the clipboard with one click.

---

## 🔒 Security Architecture

- **No API Keys in Client Code**: All Gemini Vision interactions occur strictly on the backend (`/api/analyze`).
- **Environment Variable Configuration**: The backend reads the API key securely from `process.env.GEMINI_API_KEY`.
- **Git Protection**: The `.gitignore` file prevents `.env` and local secrets from being committed or uploaded to GitHub.
- **Official Google Gemini SDK**: Uses `@google/genai` and `@google/generative-ai` with structured JSON output enforcement.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** v18+ (tested on Node v22)
- A **Google Gemini API Key** from [Google AI Studio](https://aistudio.google.com/app/apikey)

### 2. Installation

Clone or open the repository directory:
```bash
cd car-detect-ai
npm install
```

### 3. Configure Your Gemini API Key

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Open `.env` and set your Gemini API key:
```env
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere
PORT=3000
```

### 4. Start the Application

```bash
npm start
```
Or for auto-reloading development mode:
```bash
npm run dev
```

Open your browser at:
**[http://localhost:3000](http://localhost:3000)**

On mobile, open the URL using your computer's local IP address (e.g. `http://192.168.x.x:3000`) on the same Wi-Fi network.

---

## 📁 Project Structure

```
car-detect-ai/
├── .env.example        # Template for environment configuration
├── .gitignore          # Excludes .env, node_modules, and logs from Git
├── package.json        # Dependencies & scripts
├── server.js           # Express backend API & Gemini SDK integration
├── public/             # Static frontend files
│   ├── index.html      # Mobile-optimized semantic layout
│   ├── styles.css      # Dark-mode automotive design system & animations
│   └── app.js          # Camera, upload, preview, and API dispatch logic
└── README.md           # Documentation
```
