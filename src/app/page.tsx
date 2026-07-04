"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { motion } from "framer-motion";
import { 
  Upload, 
  Music, 
  Sparkles, 
  Tv, 
  Sliders, 
  Zap, 
  ShieldAlert, 
  Download,
  Info,
  ChevronDown,
  Play,
  Volume2
} from "lucide-react";
import { useEditorStore, VisualizerStyle, defaultLyrics } from "@/store/editorState";
import { decodeAudioBrowser } from "@/utils/audioDecoderBrowser";
import { readAudioMetadata, parseArtistTitleFromFilename, fetchLyricsOnline } from "@/utils/audioMetadataParser";

export default function LandingPage() {
  const router = useRouter();
  const { setAudioFile, updateConfig } = useEditorStore();
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mock visualizer canvas references
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Drag & drop configuration
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "audio/*": [".mp3", ".wav", ".flac", ".aac", ".m4a", ".ogg"],
    },
    maxSize: 500 * 1024 * 1024, // 500MB
    multiple: false,
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        await handleAudioUpload(file);
      }
    },
    onDropRejected: (rejections) => {
      const err = rejections[0]?.errors[0]?.message || "Invalid file format or file too large.";
      setErrorMsg(err);
    }
  });

  const handleAudioUpload = async (file: File) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setLoadingText("Initializing audio decoder...");

      // Prepare Audio Context for browser decoding
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      
      setLoadingText("Decoding audio channel data (PCM)...");
      const decodedBuffer = await decodeAudioBrowser(file, ctx);
      
      // Get raw channel data (mono or average stereo)
      let pcmData = decodedBuffer.getChannelData(0);
      if (decodedBuffer.numberOfChannels > 1) {
        // Average channels if stereo
        const ch0 = decodedBuffer.getChannelData(0);
        const ch1 = decodedBuffer.getChannelData(1);
        const averaged = new Float32Array(ch0.length);
        for (let i = 0; i < ch0.length; i++) {
          averaged[i] = (ch0[i] + ch1[i]) / 2;
        }
        pcmData = averaged;
      }

      // Create a URL for playback
      const audioUrl = URL.createObjectURL(file);

      // Save to store
      setAudioFile(file, audioUrl, decodedBuffer.duration, decodedBuffer, pcmData);
      
      setLoadingText("Extracting song metadata and lyrics...");
      try {
        // 1. Read metadata from ID3 tags
        const meta = await readAudioMetadata(file);
        let songLyrics = meta.lyrics;
        
        // 2. If no embedded lyrics, try fetching online
        if (!songLyrics) {
          let artist = meta.artist;
          let title = meta.title;
          
          if (!artist || !title) {
            const filenameParts = parseArtistTitleFromFilename(file.name);
            artist = artist || filenameParts.artist;
            title = title || filenameParts.title;
          }
          
          if (artist && title) {
            const onlineLyrics = await fetchLyricsOnline(artist, title);
            if (onlineLyrics) {
              songLyrics = onlineLyrics;
            }
          }
        }
        
        if (songLyrics) {
          updateConfig({ lyrics: songLyrics, audioDuration: decodedBuffer.duration });
        } else {
          updateConfig({ lyrics: defaultLyrics, audioDuration: decodedBuffer.duration });
        }
      } catch (metaErr) {
        console.error("Metadata extraction failed:", metaErr);
        updateConfig({ lyrics: defaultLyrics, audioDuration: decodedBuffer.duration });
      }
      
      setLoadingText("Loading editor studio...");
      router.push("/editor");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to parse audio file. Ensure it is not corrupted.");
      setLoading(false);
    }
  };

  // Mock landing page visualizer loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    let height = (canvas.height = 360);

    const handleResize = () => {
      if (canvas && canvas.parentElement) {
        width = canvas.width = canvas.parentElement.clientWidth;
      }
    };
    window.addEventListener("resize", handleResize);

    const bars = 60;
    const barWidth = 6;
    const barSpacing = 4;
    const amplitude = 80;

    let time = 0;

    const render = () => {
      time += 0.05;
      ctx.clearRect(0, 0, width, height);

      // Draw subtle background grid
      ctx.strokeStyle = "rgba(139, 92, 246, 0.03)";
      ctx.lineWidth = 1;
      const gridSize = 30;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const totalWidth = bars * (barWidth + barSpacing);
      const startX = (width - totalWidth) / 2;

      ctx.save();
      // Glow effect
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#8b5cf6";

      // Draw bouncing spectrum bars
      for (let i = 0; i < bars; i++) {
        // Generate a rolling wave formula for mock frequency
        const freqVal = Math.sin(i * 0.15 + time) * Math.cos(i * 0.05 - time * 0.7);
        const noise = Math.sin(i * 0.9 + time * 1.5) * 0.15;
        const normalized = Math.max(0.1, (freqVal + 1) / 2 + noise);
        const barHeight = normalized * amplitude + 4;

        const x = startX + i * (barWidth + barSpacing);
        const y = height / 2 - barHeight / 2;

        // Gradient color transition from Purple to Pink
        const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
        gradient.addColorStop(0, "#ec4899");
        gradient.addColorStop(0.5, "#8b5cf6");
        gradient.addColorStop(1, "#3b82f6");

        ctx.fillStyle = gradient;

        // Draw rounded rectangle
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }

      // Draw floating particles inside the hero canvas
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#ffffff";
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      for (let p = 0; p < 15; p++) {
        const px = (Math.sin(p * 0.5 + time * 0.2) * 0.4 + 0.5) * width;
        const py = (Math.cos(p * 0.3 - time * 0.1) * 0.3 + 0.5) * height;
        const size = (Math.sin(p + time) + 1.5) * 1.5;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const selectTemplate = (style: VisualizerStyle) => {
    updateConfig({ style });
    // Trigger standard input selection click
    const input = document.getElementById("audio-upload-input");
    if (input) input.click();
  };

  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden bg-background">
      {/* Background Ambient Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] bg-primary/10 rounded-full blur-[140px] pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[60%] bg-secondary/10 rounded-full blur-[140px] pointer-events-none animate-pulse-glow" />

      {/* Navbar */}
      <header className="w-full py-5 px-6 md:px-12 flex justify-between items-center glass-panel border-x-0 border-t-0 z-50">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-secondary">
            <Music className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">
            Beat<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Canvas</span>
          </span>
        </div>
        <nav className="hidden md:flex gap-8 text-sm font-medium text-gray-300">
          <a href="#features" className="hover:text-primary transition">Features</a>
          <a href="#templates" className="hover:text-primary transition">Templates</a>
          <a href="#faq" className="hover:text-primary transition">FAQ</a>
        </nav>
        <div>
          <button 
            onClick={() => document.getElementById("audio-upload-input")?.click()}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary hover:brightness-110 active:scale-95 transition text-sm font-semibold text-white shadow-lg shadow-primary/20"
          >
            Launch Studio
          </button>
        </div>
      </header>

      {/* Main Hero Container */}
      <main className="flex-grow flex flex-col items-center py-16 md:py-24 px-6 relative z-10">
        
        {/* Pitch Headline */}
        <div className="text-center max-w-4xl mb-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-panel text-xs font-semibold text-primary mb-6"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Next-Gen Audio Visualization Video Export
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight mb-6"
          >
            Create Stunning <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary text-glow-primary">Audio Visualizer</span> Videos
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base sm:text-xl text-gray-400 max-w-2xl mx-auto"
          >
            Transform your music into professional animated videos in seconds. Generate high-fidelity visualizer videos styled like NCS, Monstercat, and Trap Nation. Free, no watermarks.
          </motion.p>
        </div>

        {/* Drag & Drop Upload Panel */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="w-full max-w-3xl glass-panel rounded-3xl p-8 mb-16 relative"
        >
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-4 text-center">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              </div>
              <p className="text-lg font-semibold text-white mt-4">{loadingText}</p>
              <p className="text-sm text-gray-400">Please do not close this window. Decoding large files takes a few seconds.</p>
            </div>
          ) : (
            <div 
              {...getRootProps()} 
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${
                isDragActive 
                  ? "border-primary bg-primary/5 shadow-inner" 
                  : "border-gray-700 hover:border-primary/50 hover:bg-white/[0.01]"
              }`}
            >
              <input {...getInputProps()} id="audio-upload-input" />
              
              <div className="mx-auto w-16 h-16 mb-6 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-primary/50 transition">
                <Upload className="w-8 h-8 text-primary group-hover:text-white transition" />
              </div>
              
              <h3 className="text-xl font-bold text-white mb-2">Drag & drop your audio file</h3>
              <p className="text-sm text-gray-400 mb-6">
                Supports MP3, WAV, FLAC, AAC, M4A, OGG (up to 500MB or 2 hours)
              </p>
              
              <button 
                type="button"
                className="px-6 py-3 rounded-xl bg-white text-dark-bg font-semibold text-sm hover:bg-gray-200 transition shadow-md active:scale-95"
              >
                Choose File
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="mt-4 p-4 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-sm text-red-200">{errorMsg}</div>
            </div>
          )}
        </motion.div>

        {/* Live Mock Visualizer (Interactive Preview Box) */}
        <section className="w-full max-w-4xl mb-24 text-center">
          <h2 className="text-2xl font-bold text-white mb-6">Visualizer Sandbox</h2>
          <div className="glass-panel rounded-2xl overflow-hidden p-2 relative group">
            <canvas ref={canvasRef} className="w-full block bg-black/60 rounded-xl" />
            <div className="absolute top-4 right-4 text-xs font-mono bg-black/80 px-2.5 py-1.5 rounded border border-white/10 text-gray-300">
              PREVIEW LOOPING
            </div>
          </div>
        </section>

        {/* Template Gallery */}
        <section id="templates" className="w-full max-w-6xl mb-28 text-center scroll-mt-24">
          <h2 className="text-3xl font-bold text-white mb-3">Choose a Visualizer Style</h2>
          <p className="text-gray-400 max-w-xl mx-auto mb-12">
            Click any visualizer template below to load your audio file and start customizing in the studio.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* Style 1: NCS */}
            <div 
              onClick={() => selectTemplate("ncs")}
              className="glass-panel glass-panel-hover rounded-2xl overflow-hidden text-left flex flex-col h-full cursor-pointer group"
            >
              <div className="h-48 bg-gradient-to-br from-violet-950 to-[#0c0a1a] relative flex items-center justify-center p-6 border-b border-white/5">
                <div className="w-24 h-24 rounded-full border-4 border-violet-400 flex items-center justify-center shadow-lg shadow-violet-500/40 relative">
                  <div className="absolute inset-0 rounded-full border border-violet-200 scale-110 opacity-40" />
                  <div className="absolute inset-0 rounded-full border-2 border-dashed border-violet-300 animate-spin-slow" />
                  <div className="w-3 h-3 rounded-full bg-violet-400" />
                </div>
                <div className="absolute bottom-3 right-3 text-xs bg-black/50 px-2 py-0.5 rounded border border-white/5 font-medium text-violet-300">
                  Style 1
                </div>
              </div>
              <div className="p-6 flex-grow flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition">NCS Glow</h3>
                  <p className="text-sm text-gray-400">
                    A large glowing center circle with dynamic frequency spectrum wrapped around it. Reacts heavily to bass drops with particle bursts and camera shake.
                  </p>
                </div>
                <div className="mt-6 flex justify-between items-center text-xs font-semibold text-primary uppercase">
                  <span>NoCopyrightSounds Look</span>
                  <Play className="w-4 h-4 text-primary group-hover:translate-x-1 transition" />
                </div>
              </div>
            </div>

            {/* Style 2: Wave Bars */}
            <div 
              onClick={() => selectTemplate("wave")}
              className="glass-panel glass-panel-hover rounded-2xl overflow-hidden text-left flex flex-col h-full cursor-pointer group"
            >
              <div className="h-48 bg-gradient-to-br from-pink-950 to-[#0c0a1a] relative flex items-end justify-center pb-8 border-b border-white/5">
                <div className="flex gap-1.5 items-end h-24 w-3/4">
                  {[12, 28, 48, 68, 76, 52, 36, 60, 84, 96, 68, 40, 24, 16].map((h, i) => (
                    <div 
                      key={i} 
                      style={{ height: `${h}%` }} 
                      className="flex-1 bg-gradient-to-t from-pink-500 to-purple-500 rounded-t shadow-sm shadow-pink-500/30" 
                    />
                  ))}
                </div>
                <div className="absolute bottom-3 right-3 text-xs bg-black/50 px-2 py-0.5 rounded border border-white/5 font-medium text-pink-300">
                  Style 2
                </div>
              </div>
              <div className="p-6 flex-grow flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition">Wave Bars</h3>
                  <p className="text-sm text-gray-400">
                    Vertical neon spectrum bars extending across the grid, complete with real-time bottom reflection, smooth interpolation, and gradient styling.
                  </p>
                </div>
                <div className="mt-6 flex justify-between items-center text-xs font-semibold text-primary uppercase">
                  <span>Modern EDM Look</span>
                  <Play className="w-4 h-4 text-primary group-hover:translate-x-1 transition" />
                </div>
              </div>
            </div>

            {/* Style 3: Galaxy Orb */}
            <div 
              onClick={() => selectTemplate("galaxy")}
              className="glass-panel glass-panel-hover rounded-2xl overflow-hidden text-left flex flex-col h-full cursor-pointer group"
            >
              <div className="h-48 bg-gradient-to-br from-blue-950 to-[#0c0a1a] relative flex items-center justify-center p-6 border-b border-white/5">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-600 to-indigo-900 border border-blue-400 shadow-xl shadow-blue-500/20 relative flex items-center justify-center">
                  <div className="absolute w-28 h-28 rounded-full border border-blue-400/20 scale-125 animate-pulse" />
                  <div className="absolute w-32 h-32 rounded-full border border-indigo-400/10 scale-150 animate-ping" />
                  <div className="w-20 h-20 rounded-full border border-dashed border-white/10 animate-spin-slow" />
                </div>
                <div className="absolute bottom-3 right-3 text-xs bg-black/50 px-2 py-0.5 rounded border border-white/5 font-medium text-blue-300">
                  Style 3
                </div>
              </div>
              <div className="p-6 flex-grow flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition">Galaxy Orb</h3>
                  <p className="text-sm text-gray-400">
                    A cinematic floating energy sphere. Multi-layered energy waves pulse outwards and concentric rings expand inside an interactive rotating space background.
                  </p>
                </div>
                <div className="mt-6 flex justify-between items-center text-xs font-semibold text-primary uppercase">
                  <span>Cinematic Galaxy Look</span>
                  <Play className="w-4 h-4 text-primary group-hover:translate-x-1 transition" />
                </div>
              </div>
            </div>

            {/* Style 4: 3D Wave Tunnel */}
            <div 
              onClick={() => selectTemplate("tunnel")}
              className="glass-panel glass-panel-hover rounded-2xl overflow-hidden text-left flex flex-col h-full cursor-pointer group"
            >
              <div className="h-48 bg-gradient-to-br from-indigo-950 to-[#0c0a1a] relative flex items-center justify-center p-6 border-b border-white/5 overflow-hidden">
                <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
                <div className="w-20 h-20 rounded-full border border-indigo-400/30 flex items-center justify-center relative animate-pulse">
                  <div className="w-16 h-16 rounded-full border-2 border-indigo-300 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full border border-indigo-200" />
                  </div>
                </div>
                <div className="absolute bottom-3 right-3 text-xs bg-black/50 px-2 py-0.5 rounded border border-white/5 font-medium text-indigo-300">
                  Style 4
                </div>
              </div>
              <div className="p-6 flex-grow flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition">3D Wave Tunnel</h3>
                  <p className="text-sm text-gray-400">
                    Fly through a 3D neon tunnel of sound. Concentric frequency rings ripple into the distance using historical audio buffers, paired with floating camera effects and star dust.
                  </p>
                </div>
                <div className="mt-6 flex justify-between items-center text-xs font-semibold text-primary uppercase">
                  <span>Immersive 3D Space</span>
                  <Play className="w-4 h-4 text-primary group-hover:translate-x-1 transition" />
                </div>
              </div>
            </div>

            {/* Style 5: 3D Rotating Globe */}
            <div 
              onClick={() => selectTemplate("sphere3d")}
              className="glass-panel glass-panel-hover rounded-2xl overflow-hidden text-left flex flex-col h-full cursor-pointer group"
            >
              <div className="h-48 bg-gradient-to-br from-cyan-950 to-[#0c0a1a] relative flex items-center justify-center p-6 border-b border-white/5">
                <div className="w-20 h-20 rounded-full border-2 border-cyan-400/40 relative flex items-center justify-center animate-spin-slow">
                  <div className="absolute inset-0 rounded-full border border-dashed border-cyan-200/60 rotate-45" />
                  <div className="absolute inset-0 rounded-full border border-dashed border-cyan-300/30 -rotate-45" />
                  <div className="w-4 h-4 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50" />
                </div>
                <div className="absolute bottom-3 right-3 text-xs bg-black/50 px-2 py-0.5 rounded border border-white/5 font-medium text-cyan-300">
                  Style 5
                </div>
              </div>
              <div className="p-6 flex-grow flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition">3D Rotating Globe</h3>
                  <p className="text-sm text-gray-400">
                    A beautiful rotating 3D wireframe sphere that morphs and deforms dynamically on coordinate axes based on sound frequencies, generating a futuristic audio planet.
                  </p>
                </div>
                <div className="mt-6 flex justify-between items-center text-xs font-semibold text-primary uppercase">
                  <span>3D Mesh Planet</span>
                  <Play className="w-4 h-4 text-primary group-hover:translate-x-1 transition" />
                </div>
              </div>
            </div>

            {/* Style 6: Lyrical Video */}
            <div 
              onClick={() => selectTemplate("lyrics")}
              className="glass-panel glass-panel-hover rounded-2xl overflow-hidden text-left flex flex-col h-full cursor-pointer group"
            >
              <div className="h-48 bg-gradient-to-br from-emerald-950 to-[#0c0a1a] relative flex items-center justify-center p-6 border-b border-white/5">
                <div className="text-center">
                  <div className="text-xs font-bold text-emerald-400 tracking-widest uppercase mb-1">BeatCanvas</div>
                  <div className="text-lg font-bold text-white tracking-wide">Sync Lyrics</div>
                </div>
                <div className="absolute bottom-3 right-3 text-xs bg-black/50 px-2 py-0.5 rounded border border-white/5 font-medium text-emerald-300">
                  Style 6
                </div>
              </div>
              <div className="p-6 flex-grow flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition">Lyrical Video</h3>
                  <p className="text-sm text-gray-400">
                    Create professional lyrical videos. Display animated text overlays perfectly synchronized with your audio track using standard LRC tags and offsets.
                  </p>
                </div>
                <div className="mt-6 flex justify-between items-center text-xs font-semibold text-primary uppercase">
                  <span>Synced Typography</span>
                  <Play className="w-4 h-4 text-primary group-hover:translate-x-1 transition" />
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full max-w-5xl mb-28 scroll-mt-24">
          <h2 className="text-3xl font-bold text-white text-center mb-16">Engine Capabilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl w-fit">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-white">Dual Export Mode</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Renders small files instantly in your browser using WebAssembly. Automatically routes larger files to the server's high-speed rendering queue.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
              <div className="p-3 bg-secondary/10 border border-secondary/20 rounded-xl w-fit">
                <Sliders className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="text-lg font-bold text-white">High Customization</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Customize colors, glow levels, particle speeds, circles sizes, background types (space, gradient, blurred), frames per second, and output resolution.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl w-fit">
                <Tv className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-white">100% Deterministic Sync</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                By decimilating audio and calculating exact frame-by-frame FFT spectrums, we guarantee perfectly synchronized video audio with zero timing drift.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl w-fit">
                <Download className="w-6 h-6 text-yellow-400" />
              </div>
              <h3 className="text-lg font-bold text-white">No Watermarks</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Export files in Full HD or 4K at 60 FPS without accounts, sign-ups, subscriptions, or watermarks. The generated MP4 is yours completely.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl w-fit">
                <Music className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Advanced Web Audio API</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Real-time frequency analysis during playbacks allows responsive animations where bass pumps circular diameters and treble drives cosmic waves.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl w-fit">
                <Info className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Offscreen Muxing</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Uses OffscreenCanvas frame capture piped directly into FFmpeg. Avoids frame drops or audio clipping, resulting in clean native MP4s.
              </p>
            </div>

          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="w-full max-w-4xl mb-24 scroll-mt-24">
          <h2 className="text-3xl font-bold text-white text-center mb-12">Frequently Asked Questions</h2>
          <div className="flex flex-col gap-4">
            
            {[
              {
                q: "Is BeatCanvas really free with no watermark?",
                a: "Yes. BeatCanvas is completely free. We do not place watermarks on your exported videos, and we don't require user accounts, logins, or paid subscription layers."
              },
              {
                q: "How does the rendering work?",
                a: "BeatCanvas draws your video frame-by-frame onto a canvas and pipes the raw image buffer directly into FFmpeg. For shorter songs, it does this completely in the browser using WebAssembly. For files over 2 minutes or larger than 30MB, it uploads the audio securely and utilizes high-performance server-side FFmpeg rendering."
              },
              {
                q: "What audio file types are supported?",
                a: "We support standard audio files: MP3, WAV, FLAC, AAC, M4A, and OGG. The maximum supported upload limit is 500MB, and you can render files up to 2 hours long."
              },
              {
                q: "Why does my browser take time to compile the video?",
                a: "Client-side rendering compiles WebAssembly frame-by-frame on your computer. Depending on your CPU, resolution, and selected FPS, this can take a minute or two. For fastest compilation of larger tracks, you can choose Server-Side rendering which runs in a background thread on our server."
              }
            ].map((faqItem, idx) => (
              <div 
                key={idx} 
                className="glass-panel rounded-xl overflow-hidden cursor-pointer"
                onClick={() => toggleFaq(idx)}
              >
                <div className="p-5 flex justify-between items-center text-white font-semibold">
                  <span>{faqItem.q}</span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${openFaq === idx ? "rotate-180" : ""}`} />
                </div>
                {openFaq === idx && (
                  <div className="px-5 pb-5 text-sm text-gray-400 leading-relaxed border-t border-white/5 pt-3">
                    {faqItem.a}
                  </div>
                )}
              </div>
            ))}

          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 bg-[#030207] py-12 px-6 md:px-12 relative z-10 text-center">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-secondary">
              <Music className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              Beat<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Canvas</span>
            </span>
          </div>
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} BeatCanvas. Crafted for high-performance audio visualizer video generation.
          </p>
          <div className="flex gap-6 text-xs text-gray-400">
            <a href="#" className="hover:text-primary transition">Privacy Policy</a>
            <a href="#" className="hover:text-primary transition">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
