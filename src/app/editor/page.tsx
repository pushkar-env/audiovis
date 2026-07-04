"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Play, 
  Pause, 
  Upload, 
  Settings, 
  Palette, 
  Image as ImageIcon, 
  Sliders, 
  Download, 
  Undo,
  ArrowLeft,
  Tv,
  Zap,
  Music,
  Video,
  AlertTriangle,
  RefreshCw,
  Eye,
  SlidersHorizontal,
  Type
} from "lucide-react";
import { useEditorStore, VisualizerStyle, BackgroundType, defaultLyrics } from "@/store/editorState";
import { useAudioAnalyser } from "@/hooks/useAudioAnalyser";
import { readAudioMetadata, parseArtistTitleFromFilename, fetchLyricsOnline } from "@/utils/audioMetadataParser";
import { renderVisualizer } from "@/utils/visualizerRenderer";
import { generateWaveformPoints } from "@/utils/audioAnalyserUtils";
import { renderVideoClient } from "@/utils/clientRenderer";
import { decodeAudioBrowser } from "@/utils/audioDecoderBrowser";

const DEMO_AUDIO_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3";

export default function EditorPage() {
  const router = useRouter();
  
  // States from Zustand
  const { 
    config, 
    audio, 
    export: exportState, 
    updateConfig, 
    resetConfig,
    setAudioFile,
    setCurrentTime,
    setIsPlaying,
    updateExport,
    resetExport,
    resetAudio
  } = useEditorStore();

  const { style, primaryColor, secondaryColor, glowIntensity, particleAmount, circleSize, thickness, blur, backgroundType, solidColor, gradientStart, gradientEnd, gradientAngle, resolution, fps, exportQuality } = config;
  const { audioFile, audioUrl, duration, currentTime, isPlaying, pcmData, audioBuffer } = audio;
  const { isExporting, exportProgress, exportStatusText, exportError, exportVideoUrl } = exportState;

  // Tabs state
  const [activeTab, setActiveTab] = useState<"upload" | "templates" | "colors" | "background" | "lyrics" | "export">("templates");
  const [loadingDemo, setLoadingDemo] = useState(false);

  // Audio Analyser Hook
  const { getByteFrequencyData, audioElement } = useAudioAnalyser();

  // Canvas Refs
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const frequenciesArrayRef = useRef<Uint8Array | null>(null);

  // Timeline dragging
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);

  // Initialize frequencies buffer for real-time analysis
  useEffect(() => {
    frequenciesArrayRef.current = new Uint8Array(1024); // 1024 bins (2048 FFT)
  }, []);

  // Back to Landing page
  const handleGoHome = () => {
    resetAudio();
    router.push("/");
  };

  // Load Demo Track
  const handleLoadDemo = async () => {
    try {
      setLoadingDemo(true);
      const res = await fetch(DEMO_AUDIO_URL);
      if (!res.ok) throw new Error("Failed to download demo track.");
      const blob = await res.blob();
      const file = new File([blob], "soundhelix_synthwave.mp3", { type: "audio/mp3" });
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const decodedBuffer = await decodeAudioBrowser(file, ctx);
      
      let pcm = decodedBuffer.getChannelData(0);
      if (decodedBuffer.numberOfChannels > 1) {
        const ch0 = decodedBuffer.getChannelData(0);
        const ch1 = decodedBuffer.getChannelData(1);
        const averaged = new Float32Array(ch0.length);
        for (let i = 0; i < ch0.length; i++) {
          averaged[i] = (ch0[i] + ch1[i]) / 2;
        }
        pcm = averaged;
      }
      
      const url = URL.createObjectURL(file);
      setAudioFile(file, url, decodedBuffer.duration, decodedBuffer, pcm);
    } catch (err: any) {
      alert("Error loading demo track: " + err.message);
    } finally {
      setLoadingDemo(false);
    }
  };

  // Keep config Ref updated to prevent canvas loop re-creation during slider dragging
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Real-time canvas render loop
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Render the preview canvas at its actual client display size (scaled down)
    // to maintain a solid 60 FPS. Capped at 1280px width for performance.
    const resizeCanvas = () => {
      const displayW = canvas.parentElement?.clientWidth || 800;
      const [targetW, targetH] = resolution.split("x").map(Number);
      const aspect = (targetW && targetH) ? targetW / targetH : 16/9;
      
      const newWidth = Math.min(1280, displayW); 
      const newHeight = newWidth / aspect;
      
      if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
      }
    };

    resizeCanvas();

    // Listen for layout changes
    window.addEventListener("resize", resizeCanvas);

    const renderLoop = () => {
      if (ctx && canvas && frequenciesArrayRef.current) {
        // Fetch real-time frequency data
        getByteFrequencyData(frequenciesArrayRef.current);
        
        // Query current time directly from the audio element to run smoothly at 60 FPS
        const time = audioElement ? audioElement.currentTime : 0;

        // Draw frame
        renderVisualizer(
          ctx, 
          canvas.width, 
          canvas.height, 
          time, 
          frequenciesArrayRef.current, 
          configRef.current
        );
      }
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [getByteFrequencyData, resolution, audioElement]);

  // Audio Upload handler in Editor sidebar
  const handleSidebarAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoadingDemo(true);
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const decodedBuffer = await decodeAudioBrowser(file, ctx);
      
      let pcm = decodedBuffer.getChannelData(0);
      if (decodedBuffer.numberOfChannels > 1) {
        const ch0 = decodedBuffer.getChannelData(0);
        const ch1 = decodedBuffer.getChannelData(1);
        const averaged = new Float32Array(ch0.length);
        for (let i = 0; i < ch0.length; i++) {
          averaged[i] = (ch0[i] + ch1[i]) / 2;
        }
        pcm = averaged;
      }
      
      const url = URL.createObjectURL(file);
      setAudioFile(file, url, decodedBuffer.duration, decodedBuffer, pcm);

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
        console.error("Sidebar metadata extraction failed:", metaErr);
        updateConfig({ lyrics: defaultLyrics, audioDuration: decodedBuffer.duration });
      }
    } catch (err: any) {
      alert("Error parsing file: " + err.message);
    } finally {
      setLoadingDemo(false);
    }
  };

  // Background Image Upload handler
  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    updateConfig({ backgroundImageUrl: url, backgroundType: "image" });
  };

  // Format seconds -> 00:00
  const formatTime = (timeInSecs: number) => {
    const m = Math.floor(timeInSecs / 60);
    const s = Math.floor(timeInSecs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Waveform rendering memoized to avoid looping through millions of PCM samples on every render
  const waveformPoints = useMemo(() => {
    return pcmData ? generateWaveformPoints(pcmData, 180) : [];
  }, [pcmData]);

  // Seek timeline click
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || duration === 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    setCurrentTime(pct * duration);
  };

  // Timeline dragging mouse listeners
  const handleTimelineMouseDown = () => setIsDraggingTimeline(true);
  
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingTimeline || !timelineRef.current || duration === 0) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      setCurrentTime(pct * duration);
    };

    const handleGlobalMouseUp = () => setIsDraggingTimeline(false);

    if (isDraggingTimeline) {
      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDraggingTimeline, duration, setCurrentTime]);

  // Server-Side Export polling task
  const pollServerJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/render?jobId=${jobId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Status check failed");
      }

      if (data.status === "completed") {
        updateExport({
          exportProgress: 100,
          exportStatusText: "Export completed!",
          isExporting: false,
          exportVideoUrl: data.videoUrl,
        });
        
        // Auto trigger download
        triggerDownload(data.videoUrl);
      } else if (data.status === "failed") {
        throw new Error(data.error || "Server rendering failed.");
      } else {
        // update progress
        updateExport({
          exportProgress: data.progress,
          exportStatusText: `Server rendering frame sequences (${data.progress}%)...`,
        });
        // Check again in 1.5 seconds
        setTimeout(() => pollServerJob(jobId), 1500);
      }
    } catch (err: any) {
      updateExport({
        isExporting: false,
        exportError: err.message || "Server render poll failed.",
      });
    }
  };

  // Trigger browser download link
  const triggerDownload = (url: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `beatcanvas_${Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export process dispatcher
  const handleExport = async (mode: "client" | "server") => {
    if (!audioFile || !pcmData || !audioBuffer) return;

    setIsPlaying(false);
    updateExport({
      isExporting: true,
      exportProgress: 0,
      exportStatusText: "Initializing render pipeline...",
      exportError: null,
      exportVideoUrl: null,
    });

    if (mode === "client") {
      try {
        const videoUrl = await renderVideoClient(
          audioFile,
          pcmData,
          audioBuffer.sampleRate,
          config,
          (progress, text) => {
            updateExport({ exportProgress: progress, exportStatusText: text });
          }
        );
        updateExport({
          isExporting: false,
          exportVideoUrl: videoUrl,
          exportProgress: 100,
        });
        triggerDownload(videoUrl);
      } catch (err: any) {
        updateExport({
          isExporting: false,
          exportError: err.message || "Client rendering failed. Try Server Rendering.",
        });
      }
    } else {
      // Server-Side Export
      try {
        updateExport({ exportStatusText: "Uploading audio to render server..." });
        
        const formData = new FormData();
        formData.append("file", audioFile);

        // 1. Upload file to /api/upload
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();

        if (!uploadRes.ok) {
          throw new Error(uploadData.error || "Upload failed");
        }

        const { fileId } = uploadData;
        updateExport({ exportStatusText: "Queuing render job on server..." });

        // 2. Start render job on /api/render
        const renderRes = await fetch("/api/render", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileId,
            config,
          }),
        });
        const renderData = await renderRes.json();

        if (!renderRes.ok) {
          throw new Error(renderData.error || "Render job request failed");
        }

        // 3. Start polling progress
        const { jobId } = renderData;
        pollServerJob(jobId);

      } catch (err: any) {
        updateExport({
          isExporting: false,
          exportError: err.message || "Server-side rendering setup failed.",
        });
      }
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-black flex flex-col select-none relative">
      
      {/* Top Navbar */}
      <nav className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-dark-bg/60 backdrop-blur-md z-40">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleGoHome}
            className="p-2 rounded-lg hover:bg-white/5 active:scale-95 transition text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-white">
              BeatCanvas <span className="text-sm font-semibold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20 ml-2">Studio</span>
            </span>
          </div>
        </div>

        {audioFile && (
          <div className="text-xs text-gray-400 font-medium px-4 py-1.5 rounded-full bg-white/5 border border-white/10 max-w-sm truncate hidden md:block">
            ACTIVE FILE: {audioFile.name}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button 
            onClick={resetConfig}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/5 text-xs text-gray-400 hover:text-white hover:bg-white/5 active:scale-95 transition"
          >
            <Undo className="w-3.5 h-3.5" />
            Reset Design
          </button>
          <button 
            onClick={() => setActiveTab("export")}
            disabled={!audioFile}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition active:scale-95 ${
              audioFile 
                ? "bg-gradient-to-r from-primary to-secondary text-white shadow-primary/20 hover:brightness-110" 
                : "bg-white/5 border border-white/5 text-gray-500 cursor-not-allowed"
            }`}
          >
            <Download className="w-4 h-4" />
            Export MP4
          </button>
        </div>
      </nav>

      {/* Main Studio Body */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar Menu */}
        <aside className="w-[340px] border-r border-white/5 bg-[#030206] flex flex-col z-30 shrink-0">
          {/* Tab selector buttons */}
          <div className="flex border-b border-white/5 text-[10px] font-medium text-gray-400 p-2 gap-0.5 shrink-0">
            {[
              { id: "upload", label: "Upload", icon: Upload },
              { id: "templates", label: "Styles", icon: Settings },
              { id: "colors", label: "Colors", icon: Palette },
              { id: "background", label: "Backdrop", icon: ImageIcon },
              { id: "lyrics", label: "Lyrics", icon: Type },
              { id: "export", label: "Compile", icon: Download },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 min-w-0 transition ${
                    activeTab === tab.id 
                      ? "bg-white/5 text-white border border-white/5 rounded-lg" 
                      : "hover:bg-white/[0.02] hover:text-gray-200 rounded-lg"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? "text-primary" : ""}`} />
                  <span className="truncate w-full text-center">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Contents */}
          <div className="flex-grow overflow-y-auto p-5 space-y-6">
            
            {/* Upload Tab */}
            {activeTab === "upload" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-white mb-2">Upload Audio Track</h3>
                  <p className="text-xs text-gray-400 leading-relaxed mb-4">
                    Change your active song. This will reset the timeline and waveform rendering instantly.
                  </p>
                  
                  <label className="border border-dashed border-gray-700 hover:border-primary/50 hover:bg-white/[0.01] rounded-xl p-6 text-center cursor-pointer transition block">
                    <input 
                      type="file" 
                      accept="audio/*" 
                      className="hidden" 
                      onChange={handleSidebarAudioUpload} 
                    />
                    <Upload className="w-6 h-6 text-primary mx-auto mb-3" />
                    <span className="text-xs font-semibold text-white block">Choose new audio file</span>
                    <span className="text-[10px] text-gray-500 block mt-1">MP3, WAV, FLAC, M4A, OGG</span>
                  </label>
                </div>

                {!audioFile && (
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
                    <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5 text-primary" />
                      Quick Demo Sandbox
                    </h4>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      Don&apos;t have an audio file ready? Load a royalty-free synthwave demo track to experience the visualizer instantly.
                    </p>
                    <button
                      onClick={handleLoadDemo}
                      disabled={loadingDemo}
                      className="w-full py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition text-[11px] font-semibold text-white flex items-center justify-center gap-1.5"
                    >
                      {loadingDemo ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Parsing demo...
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 text-primary fill-primary" />
                          Load Sandbox Demo
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Templates Tab */}
            {activeTab === "templates" && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white">Visualizer Template Style</h3>
                <div className="space-y-3">
                  {[
                    { id: "ncs", label: "NCS Glow Ring", desc: "Large bouncing center circle with halo-polar frequencies." },
                    { id: "wave", label: "Wave Bars", desc: "Inverted vertical spectrum columns with bottom glow reflection." },
                    { id: "galaxy", label: "Galaxy Orb", desc: "Cinematic layered sphere with orbital rings & nebula space clouds." },
                    { id: "tunnel", label: "3D Wave Tunnel", desc: "Perspective projected 3D wormhole made of audio-reactive neon rings." },
                    { id: "sphere3d", label: "3D Rotating Globe", desc: "Sound-reactive wireframe grid sphere rotating dynamically in 3D." },
                    { id: "lyrics", label: "Lyrical Video", desc: "Premium dynamic text overlays synchronized using LRC tags." }
                  ].map((tpl) => (
                    <div
                      key={tpl.id}
                      onClick={() => updateConfig({ style: tpl.id as VisualizerStyle })}
                      className={`p-4 rounded-xl border text-left cursor-pointer transition ${
                        style === tpl.id
                          ? "bg-primary/10 border-primary shadow-lg shadow-primary/5"
                          : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
                      }`}
                    >
                      <h4 className="text-xs font-bold text-white mb-1 uppercase tracking-wider">{tpl.label}</h4>
                      <p className="text-[11px] text-gray-400 leading-relaxed">{tpl.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Colors & Glow Tab */}
            {activeTab === "colors" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-white mb-4">Glow & Colors</h3>
                  <div className="space-y-4">
                    {/* Primary Color */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-gray-400 uppercase">Primary Color</label>
                      <div className="flex gap-2.5 items-center">
                        <input 
                          type="color" 
                          value={primaryColor} 
                          onChange={(e) => updateConfig({ primaryColor: e.target.value })}
                          className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                        />
                        <input 
                          type="text" 
                          value={primaryColor} 
                          onChange={(e) => updateConfig({ primaryColor: e.target.value })}
                          className="flex-1 bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white uppercase font-mono"
                        />
                      </div>
                    </div>

                    {/* Secondary Color */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-gray-400 uppercase">Secondary Color</label>
                      <div className="flex gap-2.5 items-center">
                        <input 
                          type="color" 
                          value={secondaryColor} 
                          onChange={(e) => updateConfig({ secondaryColor: e.target.value })}
                          className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                        />
                        <input 
                          type="text" 
                          value={secondaryColor} 
                          onChange={(e) => updateConfig({ secondaryColor: e.target.value })}
                          className="flex-1 bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white uppercase font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Glow Intensity */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-semibold text-gray-400 uppercase">
                    <span>Glow Filter</span>
                    <span className="text-primary font-bold">{glowIntensity}px</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="10" 
                    step="0.5" 
                    value={glowIntensity}
                    onChange={(e) => updateConfig({ glowIntensity: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                {/* Blur filter */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-semibold text-gray-400 uppercase">
                    <span>Soft Blur Blur</span>
                    <span className="text-primary font-bold">{blur}px</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="20" 
                    step="1" 
                    value={blur}
                    onChange={(e) => updateConfig({ blur: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
              </div>
            )}

            {/* Background Tab */}
            {activeTab === "background" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-white mb-3">Background Style</h3>
                  <select 
                    value={backgroundType} 
                    onChange={(e) => updateConfig({ backgroundType: e.target.value as BackgroundType })}
                    className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="space" className="bg-black text-white">Space Cosmic Nebula</option>
                    <option value="blurred" className="bg-black text-white">Blurred Background</option>
                    <option value="solid" className="bg-black text-white">Solid Color</option>
                    <option value="gradient" className="bg-black text-white">Linear Gradient</option>
                    <option value="animated_gradient" className="bg-black text-white">Animated Gradient</option>
                    <option value="dark" className="bg-black text-white">Deep Dark (True Black)</option>
                  </select>
                </div>

                {backgroundType === "solid" && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase">Solid Color Picker</label>
                    <div className="flex gap-2.5 items-center">
                      <input 
                        type="color" 
                        value={solidColor} 
                        onChange={(e) => updateConfig({ solidColor: e.target.value })}
                        className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                      />
                      <input 
                        type="text" 
                        value={solidColor} 
                        className="flex-1 bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white font-mono uppercase"
                      />
                    </div>
                  </div>
                )}

                {(backgroundType === "gradient" || backgroundType === "animated_gradient") && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-gray-400 uppercase">Gradient Start</label>
                      <input 
                        type="color" 
                        value={gradientStart} 
                        onChange={(e) => updateConfig({ gradientStart: e.target.value })}
                        className="w-full h-8 rounded border-0 cursor-pointer bg-transparent"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-gray-400 uppercase">Gradient End</label>
                      <input 
                        type="color" 
                        value={gradientEnd} 
                        onChange={(e) => updateConfig({ gradientEnd: e.target.value })}
                        className="w-full h-8 rounded border-0 cursor-pointer bg-transparent"
                      />
                    </div>
                    {backgroundType === "gradient" && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-[11px] font-semibold text-gray-400 uppercase">
                          <span>Angle</span>
                          <span>{gradientAngle}°</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="360" 
                          value={gradientAngle}
                          onChange={(e) => updateConfig({ gradientAngle: parseInt(e.target.value) })}
                          className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-bold text-white mb-2">Upload Custom Cover Image</h4>
                  <label className="border border-dashed border-gray-700 hover:border-primary/50 hover:bg-white/[0.01] rounded-xl p-4 text-center cursor-pointer transition block">
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleBgImageUpload} 
                    />
                    <ImageIcon className="w-5 h-5 text-gray-400 mx-auto mb-2" />
                    <span className="text-[10px] text-gray-300 block">Upload Backdrop Image</span>
                  </label>
                </div>
              </div>
            )}

            {/* Lyrics Tab */}
            {activeTab === "lyrics" && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white">Lyrical Video Editor</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Paste plain lyrics (one line per bar) or standard LRC timestamped lyrics (e.g. <code>[00:12.34] Hello World</code>) to sync dynamically.
                </p>
                <textarea
                  value={config.lyrics}
                  onChange={(e) => updateConfig({ lyrics: e.target.value })}
                  rows={15}
                  placeholder="Paste your lyrics here..."
                  className="w-full bg-white/5 border border-white/5 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-primary/50 resize-y"
                />
                <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-[10px] text-gray-400 space-y-1">
                  <span className="font-bold text-white block">Formatting Tips:</span>
                  <span>• Plain text splits lines evenly across duration.</span>
                  <span>• LRC tags like [mm:ss.xx] enable millisecond sync.</span>
                </div>

                {/* Sync Offset Slider */}
                <div className="space-y-2.5 p-4 rounded-xl bg-white/[0.02] border border-white/5 mt-2">
                  <div className="flex justify-between text-[11px] font-semibold text-gray-400 uppercase">
                    <span>Lyrics Sync Shift</span>
                    <span className={config.lyricsOffset > 0 ? "text-green-400" : config.lyricsOffset < 0 ? "text-red-400" : "text-white"}>
                      {config.lyricsOffset > 0 ? `+${config.lyricsOffset.toFixed(1)}s` : `${config.lyricsOffset.toFixed(1)}s`}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-normal">
                    If lyrics play too early or too late, shift this slider to sync them with the music audio beats.
                  </p>
                  <div className="flex gap-2 items-center pt-1">
                    <span className="text-[10px] text-gray-500 font-mono">-5s</span>
                    <input 
                      type="range" 
                      min="-5" 
                      max="5" 
                      step="0.1"
                      value={config.lyricsOffset || 0}
                      onChange={(e) => updateConfig({ lyricsOffset: parseFloat(e.target.value) })}
                      className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <span className="text-[10px] text-gray-500 font-mono">+5s</span>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button 
                      onClick={() => updateConfig({ lyricsOffset: 0 })}
                      className="text-[9px] hover:text-white text-gray-500 hover:underline"
                    >
                      Reset to 0s
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Export Tab */}
            {activeTab === "export" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-white mb-2">Compile Video Export</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Select a compilation engine based on your track length.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5 mb-1.5">
                      <Zap className="w-3.5 h-3.5 text-yellow-400" />
                      Client-Side Muxing (WASM)
                    </h4>
                    <p className="text-[10px] text-gray-400 leading-relaxed mb-3">
                      Processes video frame compilation directly inside your browser. Best for shorter clips (under 90s) and fast computers.
                    </p>
                    <button
                      onClick={() => handleExport("client")}
                      disabled={duration > 90}
                      className={`w-full py-2 rounded-lg text-xs font-semibold transition active:scale-95 ${
                        duration <= 90
                          ? "bg-yellow-500 text-black hover:bg-yellow-400"
                          : "bg-white/5 text-gray-500 cursor-not-allowed border border-white/5"
                      }`}
                    >
                      {duration > 90 ? "Track Too Long for WASM" : "Generate via WASM"}
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5 mb-1.5">
                      <Tv className="w-3.5 h-3.5 text-primary" />
                      Server-Side Rendering (Cloud)
                    </h4>
                    <p className="text-[10px] text-gray-400 leading-relaxed mb-3">
                      Streams the file to our high-performance rendering worker. Fast, reliable, and handles long files up to 2 hours.
                    </p>
                    <button
                      onClick={() => handleExport("server")}
                      className="w-full py-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition text-xs font-semibold active:scale-95"
                    >
                      Generate via Cloud
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </aside>

        {/* Center Workspace Area */}
        <section className="flex-1 flex flex-col bg-[#08070d] relative overflow-hidden">
          
          {/* Main Visualizer Window */}
          <div className="flex-grow flex items-center justify-center p-6 md:p-10 relative">
            
            {/* Resolution indicator tag */}
            <div className="absolute top-6 left-6 z-20 flex gap-2 text-[10px] font-mono text-gray-400 bg-black/60 border border-white/5 rounded px-2.5 py-1">
              <span>RESOLUTION: {resolution}</span>
              <span className="text-gray-600">|</span>
              <span>TARGET FPS: {fps}</span>
            </div>

            <div className="w-full max-w-4xl aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl relative flex items-center justify-center">
              {!audioFile ? (
                <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center text-center p-8 z-20 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-primary animate-pulse">
                    <Music className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">No Audio Track Loaded</h3>
                    <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto font-normal px-2">
                      Please load a song from the Upload tab or try the Sandbox Demo track to start designing.
                    </p>
                  </div>
                  <button
                    onClick={handleLoadDemo}
                    disabled={loadingDemo}
                    className="px-5 py-2.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-gray-200 active:scale-95 transition"
                  >
                    {loadingDemo ? "Downloading Sandbox Demo..." : "Load Sandbox Demo"}
                  </button>
                </div>
              ) : null}
              
              {/* Core Drawing Canvas */}
              <canvas 
                ref={previewCanvasRef} 
                className={`max-w-full max-h-full block shadow-2xl ${
                  audioFile ? "opacity-100" : "opacity-20 pointer-events-none"
                }`} 
              />
            </div>

          </div>

          {/* Bottom Timeline Controls */}
          <footer className="h-28 border-t border-white/5 bg-[#030206] px-6 py-4 flex flex-col justify-between shrink-0">
            
            {/* Timeline seekbar and Waveform */}
            <div className="flex items-center gap-4 w-full">
              <span className="text-xs font-mono text-gray-400 w-12">{formatTime(currentTime)}</span>
              
              <div 
                ref={timelineRef}
                onClick={handleTimelineClick}
                onMouseDown={handleTimelineMouseDown}
                className="flex-grow h-12 bg-white/[0.02] border border-white/5 rounded-lg relative overflow-hidden cursor-pointer"
              >
                {/* Waveform points */}
                <div className="absolute inset-0 flex items-center justify-between px-1 pointer-events-none">
                  {waveformPoints.map((pt, i) => (
                    <div 
                      key={i} 
                      style={{ height: `${Math.max(10, pt * 90)}%` }}
                      className={`w-0.5 rounded-full transition-colors ${
                        (i / waveformPoints.length) * duration <= currentTime 
                          ? "bg-primary" 
                          : "bg-gray-800"
                      }`}
                    />
                  ))}
                </div>

                {/* Progress cover */}
                <div 
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                  className="absolute top-0 bottom-0 left-0 bg-primary/5 border-r-2 border-primary pointer-events-none transition-[width] duration-75"
                />
              </div>

              <span className="text-xs font-mono text-gray-400 w-12">{formatTime(duration)}</span>
            </div>

            {/* Playback Buttons & Stats */}
            <div className="flex items-center justify-between w-full text-gray-400">
              <div className="flex items-center gap-1.5">
                <button
                  disabled={!audioFile}
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`p-2 rounded-xl transition active:scale-95 ${
                    audioFile 
                      ? "bg-white text-black hover:bg-gray-200" 
                      : "bg-white/5 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current text-black" />
                  ) : (
                    <Play className="w-4 h-4 fill-current text-black" />
                  )}
                </button>
              </div>

              <div className="text-xs flex gap-5 font-medium">
                <div className="flex items-center gap-1">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-gray-500" />
                  <span>BARS: 120</span>
                </div>
                <div className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-gray-500" />
                  <span>PREVIEW SCALE: 50%</span>
                </div>
              </div>
            </div>

          </footer>

        </section>

        {/* Right Sidebar - Config Properties Controls */}
        <aside className="w-[300px] border-l border-white/5 bg-[#030206] p-5 space-y-6 z-30 shrink-0 overflow-y-auto hidden xl:block">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Properties</h3>
          
          {/* Style Properties Tab */}
          <div className="space-y-5 text-gray-400 text-xs">
            
            {/* Visualizer Thickness */}
            <div className="space-y-2">
              <div className="flex justify-between font-semibold uppercase">
                <span>Thickness</span>
                <span className="text-primary font-bold">{thickness}px</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="8" 
                step="0.5" 
                value={thickness}
                onChange={(e) => updateConfig({ thickness: parseFloat(e.target.value) })}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            {/* Particle count */}
            <div className="space-y-2">
              <div className="flex justify-between font-semibold uppercase">
                <span>Particles</span>
                <span className="text-primary font-bold">{particleAmount}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="500" 
                step="10" 
                value={particleAmount}
                onChange={(e) => updateConfig({ particleAmount: parseInt(e.target.value) })}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            {(style === "ncs" || style === "tunnel" || style === "sphere3d") && (
              <div className="space-y-2">
                <div className="flex justify-between font-semibold uppercase">
                  <span>
                    {style === "ncs" && "Circle Radius"}
                    {style === "tunnel" && "Tunnel Radius"}
                    {style === "sphere3d" && "Globe Radius"}
                  </span>
                  <span className="text-primary font-bold">{circleSize}px</span>
                </div>
                <input 
                  type="range" 
                  min="80" 
                  max="280" 
                  step="5" 
                  value={circleSize}
                  onChange={(e) => updateConfig({ circleSize: parseInt(e.target.value) })}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            )}

            {style === "galaxy" && (
              <div className="space-y-2">
                <div className="flex justify-between font-semibold uppercase">
                  <span>Orb Size</span>
                  <span className="text-primary font-bold">{circleSize}px</span>
                </div>
                <input 
                  type="range" 
                  min="80" 
                  max="240" 
                  step="5" 
                  value={circleSize}
                  onChange={(e) => updateConfig({ circleSize: parseInt(e.target.value) })}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            )}

            <hr className="border-white/5" />

            <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Export Format</h4>
            
            {/* Resolution select */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-gray-500 uppercase">Resolution Output</label>
              <select 
                value={resolution}
                onChange={(e) => updateConfig({ resolution: e.target.value as any })}
                className="w-full bg-white/5 border border-white/5 rounded-lg px-2.5 py-1.5 text-white"
              >
                <option value="1920x1080" className="bg-black">1920 x 1080 (HD 16:9)</option>
                <option value="1080x1080" className="bg-black">1080 x 1080 (Square 1:1)</option>
                <option value="1080x1920" className="bg-black">1080 x 1920 (Vertical 9:16)</option>
                <option value="3840x2160" className="bg-black">3840 x 2160 (4K UltraHD)</option>
              </select>
            </div>

            {/* Framerate select */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-gray-500 uppercase">Framerate</label>
              <select 
                value={fps}
                onChange={(e) => updateConfig({ fps: parseInt(e.target.value) as any })}
                className="w-full bg-white/5 border border-white/5 rounded-lg px-2.5 py-1.5 text-white"
              >
                <option value="30" className="bg-black">30 Frames/Second</option>
                <option value="60" className="bg-black">60 Frames/Second</option>
              </select>
            </div>

          </div>
        </aside>

      </div>

      {/* Export progress Dashboard Modal overlay */}
      <AnimatePresence>
        {isExporting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-6 text-center"
          >
            <div className="w-full max-w-md space-y-6">
              <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle 
                    cx="48" 
                    cy="48" 
                    r="42" 
                    stroke="rgba(255,255,255,0.05)" 
                    strokeWidth="6" 
                    fill="none" 
                  />
                  <motion.circle 
                    cx="48" 
                    cy="48" 
                    r="42" 
                    stroke="url(#grad)" 
                    strokeWidth="6" 
                    strokeDasharray={2 * Math.PI * 42}
                    strokeDashoffset={2 * Math.PI * 42 * (1 - exportProgress / 100)}
                    strokeLinecap="round"
                    fill="none" 
                  />
                  <defs>
                    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="absolute text-xl font-bold font-mono text-white">{exportProgress}%</span>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white mb-2">Rendering MP4 Video</h3>
                <p className="text-xs text-gray-400 leading-relaxed font-mono">{exportStatusText}</p>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex gap-3 text-left">
                <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  Export pipelines draw frames offscreen and encode high-bitrate audio/video parameters. Please do not close or reload this browser tab while compilation is active.
                </p>
              </div>

              <button
                onClick={() => {
                  // Cancel is done by resetting export state
                  resetExport();
                  window.location.reload(); // Simple hard-reset is extremely effective for canceling WASM/Server tasks.
                }}
                className="px-5 py-2 rounded-lg bg-red-950 text-red-200 border border-red-800 hover:bg-red-900 active:scale-95 transition text-xs font-semibold"
              >
                Cancel Compilation
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Completion / Download Modal Overlay */}
      <AnimatePresence>
        {exportVideoUrl && !isExporting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-50 p-6 text-center"
          >
            <div className="w-full max-w-lg space-y-6">
              
              <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-400">
                <Download className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-2xl font-extrabold text-white">Video Compiled Successfully!</h3>
                <p className="text-sm text-gray-400 mt-2">
                  Your high-fidelity BeatCanvas visualizer MP4 video is ready.
                </p>
              </div>

              <div className="aspect-video w-full rounded-xl overflow-hidden border border-white/10 bg-black shadow-inner">
                <video src={exportVideoUrl} controls className="w-full h-full object-contain" />
              </div>

              <div className="flex gap-4 items-center justify-center">
                <button
                  onClick={() => triggerDownload(exportVideoUrl)}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white hover:brightness-110 active:scale-95 transition font-semibold text-sm shadow-lg shadow-primary/20 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download MP4
                </button>
                <button
                  onClick={resetExport}
                  className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition font-semibold text-gray-300 text-sm"
                >
                  Back to Studio
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Modals */}
      <AnimatePresence>
        {exportError && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-6 text-center"
          >
            <div className="w-full max-w-md space-y-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                <AlertTriangle className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-white">Compilation Failed</h3>
                <p className="text-xs text-red-300/80 mt-2 font-mono p-4 bg-red-950/20 border border-red-950 rounded-lg text-left overflow-auto max-h-48 leading-relaxed">
                  {exportError}
                </p>
              </div>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={resetExport}
                  className="px-5 py-2.5 rounded-lg bg-white text-black hover:bg-gray-200 active:scale-95 transition text-xs font-semibold"
                >
                  Try Again
                </button>
                <button
                  onClick={() => {
                    resetExport();
                    setActiveTab("export");
                  }}
                  className="px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition text-xs font-semibold text-gray-300"
                >
                  Change Settings
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
