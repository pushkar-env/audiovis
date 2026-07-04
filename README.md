# BeatCanvas 🎵🎨

BeatCanvas is a high-performance production-ready web application that generates stunning audio visualization videos from uploaded audio files. Inspired by electronic music channels like NoCopyrightSounds (NCS), Trap Nation, and Monstercat, BeatCanvas turns songs into customizable H.264 MP4 videos.

## 🚀 Key Features

*   **Real-time Preview**: Adjust audio configurations and see visual changes immediately.
*   **Three Visualizer Styles**:
    *   **NCS Glow Ring**: A center audio circle pulsing to bass drops, surrounded by polar frequency spikes, with dynamic particles, soft bloom, and peak camera shake.
    *   **Wave Bars**: Symmetrical vertical frequency bars extending across the grid, complete with real-time bottom reflections.
    *   **Galaxy Orb**: Cinematic energy sphere with orbital concentric waves, particle explosions on beat triggers, and space dust backgrounds.
*   **Dual Rendering Pipeline**:
    *   *Client-Side WASM*: Generates MP4s directly in the browser using FFmpeg WebAssembly. Ideal for files under 90 seconds.
    *   *Server-Side Cloud*: Securely streams uploads to a background Node.js thread where a headless Skia-Canvas and native FFmpeg compile MP4s at high speed. Perfect for large files up to 2 hours (500MB limit).
*   **Highly Customizable**: Toggle primary/secondary colors, glow filters, blur intensity, particle density, circle sizes, bar thicknesses, FPS (30/60), and resolutions (HD 1080p, square, vertical, or 4K UltraHD).
*   **No Accounts, No Subscriptions, No Watermarks**: Open source, self-contained, and works instantly.

---

## 🛠️ Technology Stack

*   **Frontend**: Next.js 15 (App Router), React 19, TypeScript, TailwindCSS v4, Framer Motion, Zustand (State Management), React Dropzone.
*   **Audio Core**: Web Audio API (`AudioContext`, `AnalyserNode`) + offline FFT Cooley-Tukey mathematical analysis.
*   **Rendering Engines**: Canvas 2D, FFmpeg CLI (Server), `@ffmpeg/ffmpeg` WASM (Client), and `Skia-Canvas` (Node-compatible headless rendering).

---

## 📂 Project Directory Structure

```
BeatCanvas/
├── src/
│   ├── app/                      # Next.js pages & API routes
│   │   ├── api/
│   │   │   ├── upload/           # Handles multipart file uploads (up to 500MB)
│   │   │   └── render/           # Queues and monitors server-side FFmpeg rendering jobs
│   │   ├── editor/               # Studio workspace component
│   │   │   └── page.tsx
│   │   ├── page.tsx              # Beautiful Landing page with mockup visualizer
│   │   ├── layout.tsx            # Global HTML & SEO Meta
│   │   └── globals.css           # Styling theme config (dark neon glassmorphism)
│   ├── hooks/
│   │   └── useAudioAnalyser.ts   # Syncs Web Audio API playback state & analyser node with store
│   ├── store/
│   │   └── editorState.ts        # Zustand store managing UI, audio, and visualizer properties
│   └── utils/
│       ├── visualizers/
│       ├── audioAnalyserUtils.ts # Offline frame-by-frame FFT frequency mapping
│       ├── audioDecoder.ts       # Raw Float32 PCM decoder (Browser & Node FFmpeg CLI)
│       ├── clientRenderer.ts     # Client-side WASM FFmpeg OffscreenCanvas rendering loop
│       ├── serverRenderer.ts     # Server-side Skia-Canvas JPEG-pipe to FFmpeg CLI background job
│       ├── fft.ts                # Fast Fourier Transform (Radix-2 Cooley-Tukey)
│       └── jobManager.ts         # In-memory server render job queues (Status/Progress)
├── public/                       # Static public assets
│   ├── temp_uploads/             # [Auto-Created] Temporary audio uploads
│   └── exports/                  # [Auto-Created] Rendered MP4 videos
├── Dockerfile                    # Containerization build stage
├── docker-compose.yml            # Docker orchestration configuration
├── next.config.ts                # Next.js custom headers (SharedArrayBuffer COOP/COEP)
├── package.json
└── tsconfig.json
```

---

## 📥 Getting Started

### Prerequisites

*   **Node.js**: `v18.x` or higher.
*   **FFmpeg CLI**: Required on the host machine to support backend (Server-Side) rendering.
    *   *Windows*: Download from [Gyan.dev](https://www.gyan.dev/ffmpeg/builds/) and add to system PATH.
    *   *macOS*: Install via Homebrew: `brew install ffmpeg`.
    *   *Linux*: Install via package manager: `sudo apt install ffmpeg`.

### Installation

1.  Clone the repository or navigate to the directory:
    ```bash
    cd AudioVis
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the Next.js development server:
    ```bash
    npm run dev
    ```
4.  Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🐳 Docker Deployment (Production)

Docker containers package the application and system dependencies (including FFmpeg) automatically.

1.  Build and launch the application:
    ```bash
    docker-compose up -d --build
    ```
2.  The application will be accessible at `http://localhost:3000`.
3.  Uploaded files and compiled MP4s are saved in Docker volumes `temp-uploads` and `exports` for persistence.
