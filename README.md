# KELSAಮಿತ್ರ (`KELSA_MITRA`)

> **Voice-first, zero-typing hyper-local job matching for daily-wage and semi-skilled workers.**  
> Bridging blue-collar workers and local employers through regional speech AI (Kannada, Hindi, and English), conversational audio onboarding, and instant missed-call / shift confirmation workflows.

**Live App:** [https://kelsa-mitra.vercel.app/](https://kelsa-mitra.vercel.app/)

---

## Overview

Millions of daily-wage workers—electricians, plumbers, helpers, drivers, delivery riders, and construction staff—struggle with text-heavy job portals and English-first mobile forms. **KELSAಮಿತ್ರ** removes typing and literacy barriers by making **regional voice** the primary interface from sign-up to shift confirmation.

Users can register through a guided **Voice Q&A** in Kannada, Hindi, or English, browse nearby verified shifts by distance and daily wage on an interactive map, listen to job details read aloud, filter or apply by voice command, and connect directly with local businesses with **zero middleman commissions**.

---

## Key Features

### 1. Voice-First Onboarding & Returning User Login
- **Conversational Voice Q&A:** Automatically greets new users and walks step-by-step through role selection (Worker / Employer), name, 10-digit mobile number, primary trade or business, and locality using spoken prompts and 16 kHz PCM WAV voice capture with automatic silence detection.
- **Zero-Typing Accessibility:** Built for users who prefer speaking over reading or typing, with instant multilingual spoken playback on every job card and prompt.
- **Returning User Flow:** Supports one-tap switching to **Existing Login** by mobile number—or automatic account detection during voice phone verification—preserving saved profile details and shift history.

### 2. Two-Sided Hyper-Local Marketplace
- **Worker Mode (`Discover` & `My Shifts`):**
  - Filter nearby openings by **5 km / 10 km radius**, trade category, locality, and sort order (`Nearest`, `Highest Pay`, `Immediate`).
  - Tap **Listen** on any job card to hear wage, shift hours, distance, commute notes, and payment mode (`Evening UPI`, `Daily Cash`, `Weekly Bank`) in Kannada, Hindi, or English.
  - Confirm shifts instantly via missed-call / direct connect workflow with live slot tracking.
- **Employer Mode (`Hire Staff / Post Job`):**
  - Post new daily or weekly openings with wage, worker count, shift timing, locality, and payment mode.
  - Browse available local workers by trade, availability, and distance, and invite workers directly.

### 3. Live Voice Assistant Sheet
- Floating **Voice Assistant** drawer accepts natural spoken commands across Kannada, Hindi, and English (e.g., *"Find electrician work near B.H. Road above ₹700"*) and updates marketplace filters automatically.

### 4. Interactive Geo-Radar Map & Account Hub
- **Interactive Leaflet Map:** Visualizes open jobs and available workers around the user's selected radius with live list-to-map selection sync.
- **Clean Account Profile:** New accounts start cleanly at `₹0` weekly earnings, `0` jobs completed, and `New` trust rating, updating dynamically as shifts are confirmed and profile preferences are saved.

---

## Architecture & Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Lucide Icons |
| **Maps & Geo** | Leaflet (`TumakuruRadar` interactive radius & pin map) |
| **Speech AI (Server Proxy)** | Sarvam AI (`saaras:v4` Speech-to-Text + `bulbul:v3` Text-to-Speech) with Web Audio 16 kHz mono WAV capture & browser speech fallback |
| **Backend & Serverless** | Express (`server.ts` for Node/local dev) + Vercel Serverless Functions (`/api/sarvam/*`) |
| **Database & Realtime** | Supabase (PostgreSQL + PostGIS + Realtime subscriptions) with `localStorage` fallback |

---

## Project Structure

```text
KELSA_MITRA/
├── api/
│   └── sarvam/
│       ├── status.ts          # GET  /api/sarvam/status  (voice pipeline health check)
│       ├── tts.ts             # POST /api/sarvam/tts     (server-side text-to-speech proxy)
│       └── stt.ts             # POST /api/sarvam/stt     (server-side speech-to-text proxy)
├── src/
│   ├── components/
│   │   ├── AccountProfileView.tsx
│   │   ├── ElevenLabsVoiceSheet.tsx
│   │   ├── JobConnectModal.tsx
│   │   ├── OnboardingModal.tsx
│   │   └── TumakuruRadar.tsx
│   ├── services/
│   │   ├── jobService.ts
│   │   ├── supabaseClient.ts
│   │   ├── supabaseService.ts
│   │   └── voiceService.ts
│   ├── utils/
│   │   └── transliterate.ts
│   ├── App.tsx
│   └── main.tsx
├── supabase/
│   └── schema.sql             # Database tables, RLS policies, and Realtime setup
├── server.ts                  # Express server + Vite middleware (dev & Node production)
├── vite.config.ts
└── vercel.json                # Vercel build & SPA rewrite configuration
```

---

## Local Development Setup

### 1. Prerequisites
- **Node.js 22+**
- A **Sarvam AI** API key (for regional Kannada / Hindi / English STT & TTS)
- A **Supabase** project (optional for local offline demo mode; required for shared persistence & Realtime)

### 2. Install & Configure Environment
```bash
git clone https://github.com/yuvadepcodes/KELSA_MITRA.git
cd KELSA_MITRA
npm install
cp .env.example .env
```

Fill in `.env`:
```env
# Server-side only — never exposed to the browser
SARVAM_API_KEY=your_sarvam_api_key

# Supabase public client credentials
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Initialize Supabase Database
Run the contents of `supabase/schema.sql` in your **Supabase Dashboard → SQL Editor** to create the `users`, `jobs`, `workers`, and `shift_applications` tables, RLS policies, and Realtime publication.

### 4. Run Locally
```bash
npm run dev
```
The app and API proxy will be served on `http://localhost:3000`.

### 5. Build & Production Start (Node)
```bash
npm run build
npm start
```

---

## Deployment

### Vercel (Live Production)
The production app at **[https://kelsa-mitra.vercel.app/](https://kelsa-mitra.vercel.app/)** uses:
- `vercel.json` for Vite static output (`dist/`) and SPA routing
- `/api/sarvam/*` serverless routes so `SARVAM_API_KEY` remains strictly server-side
- `vite.config.ts` automatic resolution of `VITE_SUPABASE_*`, `NEXT_PUBLIC_SUPABASE_*`, and Vercel Supabase integration variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`)

Required environment variables on Vercel:
- `SARVAM_API_KEY`
- `SUPABASE_URL` & `SUPABASE_ANON_KEY` (or `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY`)

---

## License

Licensed under the terms in [`LICENSE`](./LICENSE).
