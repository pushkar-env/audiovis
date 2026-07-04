import { create } from "zustand";

export type VisualizerStyle = "ncs" | "wave" | "galaxy" | "lyrics";
export type BackgroundType =
  | "solid"
  | "gradient"
  | "animated_gradient"
  | "image"
  | "video"
  | "blurred"
  | "space"
  | "abstract"
  | "dark";

export interface VisualizerConfig {
  style: VisualizerStyle;
  primaryColor: string;
  secondaryColor: string;
  glowIntensity: number;
  particleAmount: number;
  circleSize: number;
  thickness: number;
  blur: number;
  
  // Background
  backgroundType: BackgroundType;
  solidColor: string;
  gradientStart: string;
  gradientEnd: string;
  gradientAngle: number;
  backgroundImageUrl: string | null;
  backgroundVideoUrl: string | null;

  // Lyrics text in standard LRC format
  lyrics: string;
  audioDuration: number; // in seconds
  lyricsOffset: number;   // sync shift in seconds

  // Export properties
  resolution: "1080x1080" | "1920x1080" | "1080x1920" | "3840x2160";
  fps: 30 | 60;
  exportQuality: "low" | "medium" | "high";
}

interface AudioState {
  audioFile: File | null;
  audioUrl: string | null;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  audioBuffer: AudioBuffer | null;
  pcmData: Float32Array | null;
}

interface ExportState {
  isExporting: boolean;
  exportProgress: number; // 0 to 100
  exportStatusText: string;
  exportError: string | null;
  exportVideoUrl: string | null;
}

interface EditorStore {
  config: VisualizerConfig;
  audio: AudioState;
  export: ExportState;

  // Config setters
  updateConfig: (updates: Partial<VisualizerConfig>) => void;
  resetConfig: () => void;

  // Audio setters
  setAudioFile: (file: File | null, url: string | null, duration: number, buffer: AudioBuffer | null, pcmData: Float32Array | null) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  resetAudio: () => void;

  // Export setters
  updateExport: (updates: Partial<ExportState>) => void;
  resetExport: () => void;
}

export const defaultLyrics = `[00:02.00] Welcome to BeatCanvas Lyrical Video
[00:06.00] Feel the rhythm in your soul
[00:10.00] Let the frequency take control
[00:14.00] Turn the volume up, lose control
[00:18.00] Pulsing lights, neon glow
[00:22.00] Synchronized to the beat we flow
[00:26.00] In the galaxy of sound we float
[00:30.00] A glowing energy we write
[00:34.50] Watch the spectrum come alive
[00:38.00] Visualizing beats in flight
[00:42.00] Elevate into the night...
[00:46.00] (Instrumental Break)
[00:54.00] BeatCanvas - Pure Visual Synergy`;

const defaultConfig: VisualizerConfig = {
  style: "ncs",
  primaryColor: "#a78bfa", // lavender/purple
  secondaryColor: "#ec4899", // pink
  glowIntensity: 4,
  particleAmount: 200,
  circleSize: 180,
  thickness: 3,
  blur: 8,
  backgroundType: "space",
  solidColor: "#05050a",
  gradientStart: "#1e1b4b", // deep indigo
  gradientEnd: "#020205",   // dark black/blue
  gradientAngle: 135,
  backgroundImageUrl: null,
  backgroundVideoUrl: null,
  lyrics: defaultLyrics,
  audioDuration: 180,
  lyricsOffset: 0,
  resolution: "1920x1080",
  fps: 60,
  exportQuality: "high",
};

export const useEditorStore = create<EditorStore>((set) => ({
  config: defaultConfig,
  audio: {
    audioFile: null,
    audioUrl: null,
    duration: 0,
    currentTime: 0,
    isPlaying: false,
    audioBuffer: null,
    pcmData: null,
  },
  export: {
    isExporting: false,
    exportProgress: 0,
    exportStatusText: "",
    exportError: null,
    exportVideoUrl: null,
  },

  updateConfig: (updates) =>
    set((state) => ({
      config: { ...state.config, ...updates },
    })),

  resetConfig: () =>
    set(() => ({
      config: defaultConfig,
    })),

  setAudioFile: (file, url, duration, buffer, pcmData) =>
    set((state) => ({
      audio: {
        ...state.audio,
        audioFile: file,
        audioUrl: url,
        duration,
        audioBuffer: buffer,
        pcmData,
        currentTime: 0,
        isPlaying: false,
      },
    })),

  setCurrentTime: (time) =>
    set((state) => ({
      audio: { ...state.audio, currentTime: time },
    })),

  setIsPlaying: (isPlaying) =>
    set((state) => ({
      audio: { ...state.audio, isPlaying },
    })),

  resetAudio: () =>
    set((state) => {
      if (state.audio.audioUrl) {
        URL.revokeObjectURL(state.audio.audioUrl);
      }
      return {
        audio: {
          audioFile: null,
          audioUrl: null,
          duration: 0,
          currentTime: 0,
          isPlaying: false,
          audioBuffer: null,
          pcmData: null,
        },
      };
    }),

  updateExport: (updates) =>
    set((state) => ({
      export: { ...state.export, ...updates },
    })),

  resetExport: () =>
    set(() => ({
      export: {
        isExporting: false,
        exportProgress: 0,
        exportStatusText: "",
        exportError: null,
        exportVideoUrl: null,
      },
    })),
}));
