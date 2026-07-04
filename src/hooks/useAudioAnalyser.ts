import { useEffect, useRef, useCallback } from "react";
import { useEditorStore } from "@/store/editorState";

export function useAudioAnalyser() {
  const { audio, setCurrentTime, setIsPlaying } = useEditorStore();
  const { audioUrl, isPlaying, currentTime } = audio;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Initialize a single Audio Element once in life-cycle
  useEffect(() => {
    const audioElement = new Audio();
    audioElement.crossOrigin = "anonymous";
    audioRef.current = audioElement;

    const onTimeUpdate = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
    };

    audioElement.addEventListener("timeupdate", onTimeUpdate);
    audioElement.addEventListener("ended", onEnded);

    return () => {
      audioElement.removeEventListener("timeupdate", onTimeUpdate);
      audioElement.removeEventListener("ended", onEnded);
      audioElement.pause();
    };
  }, [setCurrentTime, setIsPlaying]);

  // Load track source URL dynamically when it changes
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    if (audioUrl) {
      audioElement.src = audioUrl;
      audioElement.load();
    } else {
      audioElement.pause();
      audioElement.src = "";
    }
  }, [audioUrl]);

  // Handle Play/Pause and Web Audio connection
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement || !audioUrl) return;

    if (isPlaying) {
      // Connect to Web Audio API context on first user interaction
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        const analyser = ctx.createAnalyser();
        
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.65; // snappier beat reactions

        const source = ctx.createMediaElementSource(audioElement);
        source.connect(analyser);
        analyser.connect(ctx.destination);

        audioContextRef.current = ctx;
        analyserRef.current = analyser;
        sourceRef.current = source;
      }

      if (audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume();
      }

      audioElement.play().catch((err) => {
        console.error("Playback failed:", err);
        setIsPlaying(false);
      });
    } else {
      audioElement.pause();
    }
  }, [isPlaying, audioUrl, setIsPlaying]);

  // Sync seek/timeline updates
  useEffect(() => {
    const audioElement = audioRef.current;
    if (audioElement && Math.abs(audioElement.currentTime - currentTime) > 0.3) {
      audioElement.currentTime = currentTime;
    }
  }, [currentTime]);

  // Stable memoized callback for frequency queries
  const getByteFrequencyData = useCallback((array: Uint8Array) => {
    if (analyserRef.current) {
      analyserRef.current.getByteFrequencyData(array as any);
    } else {
      array.fill(0);
    }
  }, []);

  return {
    audioElement: audioRef.current,
    getByteFrequencyData,
    analyserNode: analyserRef.current,
  };
}
