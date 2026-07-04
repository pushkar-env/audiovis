import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import { VisualizerConfig } from "@/store/editorState";
import { getFrequenciesAtTime } from "./audioAnalyserUtils";
import { renderVisualizer } from "./visualizerRenderer";

let ffmpegInstance: FFmpeg | null = null;

async function getFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;

  const ffmpeg = new FFmpeg();
  
  if (onLog) {
    ffmpeg.on("log", ({ message }) => onLog(message));
  }

  // Load FFmpeg from CDN
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

export async function renderVideoClient(
  audioFile: File,
  pcmData: Float32Array,
  sampleRate: number,
  config: VisualizerConfig,
  onProgress: (progress: number, statusText: string) => void
): Promise<string> {
  const duration = pcmData.length / sampleRate;
  const fps = config.fps;
  const totalFrames = Math.floor(duration * fps);

  // Parse Resolution
  let [width, height] = config.resolution.split("x").map(Number);
  if (isNaN(width) || isNaN(height)) {
    width = 1920;
    height = 1080;
  }

  // Double check memory limits for FFmpeg WASM (approx 4GB WASM heap limit in Chrome)
  // For safety, warn or limit client-side render to ~90 seconds.
  if (duration > 120) {
    throw new Error("Audio is too long for client-side rendering (limit: 2 minutes). Please use Server-Side Render.");
  }

  onProgress(0, "Initializing FFmpeg WASM...");
  const ffmpeg = await getFFmpeg((msg) => {
    // console.log("[FFmpeg WASM log]", msg);
  });

  // Write audio file to FFmpeg filesystem
  onProgress(2, "Loading audio file into virtual memory...");
  const audioBuffer = await audioFile.arrayBuffer();
  await ffmpeg.writeFile("input_audio", new Uint8Array(audioBuffer));

  // Create canvas for rendering frames
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not acquire 2D rendering context for OffscreenCanvas.");
  }

  onProgress(5, "Rendering canvas frames...");
  
  // Write frames one by one into the FFmpeg virtual filesystem
  for (let i = 0; i < totalFrames; i++) {
    const time = i / fps;
    
    // Get spectrum
    const frequencies = getFrequenciesAtTime(pcmData, time, sampleRate);
    
    // Draw visualizer frame
    renderVisualizer(ctx, width, height, time, frequencies, config);
    
    // Convert canvas to JPEG blob
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.80 });
    const arrayBuf = await blob.arrayBuffer();
    const frameData = new Uint8Array(arrayBuf);
    
    // Write frame file
    const frameName = `frame_${i.toString().padStart(6, "0")}.jpg`;
    await ffmpeg.writeFile(frameName, frameData);

    if (i % 10 === 0 || i === totalFrames - 1) {
      const renderProgress = Math.round((i / totalFrames) * 80); // 0-80% is frame rendering
      onProgress(5 + renderProgress, `Rendering frame ${i + 1} of ${totalFrames}...`);
    }
  }

  onProgress(88, "Compiling final video (muxing audio and visuals)...");

  // Map export quality to CRF, audio bitrate
  let crf = "22";
  let audioBitrate = "192k";

  if (config.exportQuality === "low") {
    crf = "25";
    audioBitrate = "128k";
  } else if (config.exportQuality === "high") {
    crf = "19";
    audioBitrate = "320k";
  }

  // Run FFmpeg mux command
  // -preset ultrafast helps complete encoding quickly in WASM.
  // -t limits final duration strictly.
  await ffmpeg.exec([
    "-y",
    "-f", "image2pipe",
    "-vcodec", "mjpeg",
    "-framerate", fps.toString(),
    "-i", "frame_%06d.jpg",
    "-i", "input_audio",
    "-t", duration.toFixed(3),
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "ultrafast",
    "-tune", "animation", // optimized for visualizer vector animations
    "-crf", crf,
    "-c:a", "aac",
    "-b:a", audioBitrate,
    "output.mp4",
  ]);

  onProgress(98, "Retrieving compiled MP4 file...");

  // Read output video
  const data = await ffmpeg.readFile("output.mp4");
  const videoBlob = new Blob([data as any], { type: "video/mp4" });
  const videoUrl = URL.createObjectURL(videoBlob);

  // Clean up virtual filesystem to prevent memory leaks!
  onProgress(99, "Cleaning up virtual filesystem...");
  try {
    await ffmpeg.deleteFile("input_audio");
    await ffmpeg.deleteFile("output.mp4");
    for (let i = 0; i < totalFrames; i++) {
      await ffmpeg.deleteFile(`frame_${i.toString().padStart(6, "0")}.jpg`);
    }
  } catch (err) {
    console.warn("Cleanup warning:", err);
  }

  onProgress(100, "Export completed!");
  return videoUrl;
}
