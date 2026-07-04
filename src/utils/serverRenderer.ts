import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { Canvas } from "skia-canvas";
import { updateJob } from "./jobManager";
import { decodeAudioNode } from "./audioDecoderNode";
import { getFrequenciesAtTime } from "./audioAnalyserUtils";
import { renderVisualizer } from "./visualizerRenderer";
import { VisualizerConfig } from "@/store/editorState";
import ffmpegPath from "ffmpeg-static";

export async function renderVideoServer(
  jobId: string,
  audioFilePath: string,
  config: VisualizerConfig
): Promise<void> {
  updateJob(jobId, { status: "rendering", progress: 0 });

  let ffmpegProcess: any = null;

  try {
    // 1. Decode audio file to mono PCM Float32Array
    const { sampleRate, channelData } = await decodeAudioNode(audioFilePath);
    const duration = channelData.length / sampleRate;

    // 2. Setup rendering settings
    const fps = config.fps;
    const totalFrames = Math.floor(duration * fps);

    let [width, height] = config.resolution.split("x").map(Number);
    if (isNaN(width) || isNaN(height)) {
      width = 1920;
      height = 1080;
    }

    // 3. Create canvas and context
    const canvas = new Canvas(width, height);
    const ctx = canvas.getContext("2d");

    // 4. Setup output paths
    const outputFileName = `${jobId}.mp4`;
    const exportsDir = path.join(process.cwd(), "public", "exports");
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    const outputFilePath = path.join(exportsDir, outputFileName);

    const command = ffmpegPath || "ffmpeg";

    // 5. Spawn FFmpeg process
    // We pipe raw RGBA pixels directly to stdin and overlay the audio track.
    // -t specifies the exact duration to avoid hanging and guarantee audio sync.
    let preset = "medium";
    let crf = "21";
    let audioBitrate = "192k";

    if (config.exportQuality === "low") {
      preset = "fast";
      crf = "25";
      audioBitrate = "128k";
    } else if (config.exportQuality === "high") {
      preset = "medium";
      crf = "18";
      audioBitrate = "320k";
    }

    ffmpegProcess = spawn(command, [
      "-y",
      "-f", "rawvideo",
      "-pix_fmt", "rgba",
      "-s", `${width}x${height}`,
      "-framerate", fps.toString(),
      "-i", "-", // read raw RGBA from stdin
      "-i", audioFilePath,
      "-t", duration.toFixed(3), // enforce exact duration
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-preset", preset,
      "-tune", "animation", // optimized for vector visualizer animations
      "-crf", crf,
      "-c:a", "aac",
      "-b:a", audioBitrate,
      outputFilePath,
    ]);


    let ffmpegError = "";
    ffmpegProcess.stderr.on("data", (data: Buffer) => {
      ffmpegError += data.toString();
    });

    // Handle FFmpeg termination/close
    const ffmpegExitPromise = new Promise<void>((resolve, reject) => {
      ffmpegProcess.on("close", (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}. Error detail: ${ffmpegError}`));
        }
      });
      ffmpegProcess.on("error", (err: any) => {
        reject(new Error(`FFmpeg failed: ${err.message}`));
      });
    });

    // 6. Write frames sequentially with backpressure handling
    let currentFrame = 0;
    
    // Recursive write function
    const writeFrame = async (): Promise<boolean> => {
      if (currentFrame >= totalFrames) {
        ffmpegProcess.stdin.end();
        return true;
      }

      const time = currentFrame / fps;
      
      // Calculate frequency data for this frame
      const frequencies = getFrequenciesAtTime(channelData, time, sampleRate);
      
      // Render frame on canvas
      renderVisualizer(ctx, width, height, time, frequencies, config);
      
      // Get raw RGBA pixels (bypasses image compression completely!)
      const imageData = ctx.getImageData(0, 0, width, height);
      const buffer = Buffer.from(imageData.data.buffer);

      // Update progress
      const progress = Math.min(99, Math.round((currentFrame / totalFrames) * 100));
      updateJob(jobId, { progress });

      currentFrame++;

      // Write buffer to stdin. If stream buffer is full, wait for 'drain'.
      const canWrite = ffmpegProcess.stdin.write(buffer);
      if (!canWrite) {
        return new Promise((resolve) => {
          ffmpegProcess.stdin.once("drain", () => {
            resolve(false); // Continue writing
          });
        });
      }
      return false; // Continue writing immediately
    };

    // Frame drawing loop
    let done = false;
    while (!done) {
      done = await writeFrame();
    }

    // Wait for FFmpeg process to fully wrap up and exit
    await ffmpegExitPromise;

    // 7. Render complete! Clean up uploaded audio file and update job state
    updateJob(jobId, {
      status: "completed",
      progress: 100,
      videoUrl: `/exports/${outputFileName}`,
    });

    try {
      fs.unlinkSync(audioFilePath);
    } catch (err) {
      console.warn(`[serverRenderer] Failed to delete temp audio: ${audioFilePath}`, err);
    }

  } catch (err: any) {
    console.error("Server render job failed:", err);
    updateJob(jobId, {
      status: "failed",
      error: err.message || "An unknown error occurred during video rendering.",
    });

    if (ffmpegProcess) {
      try {
        ffmpegProcess.kill("SIGKILL");
      } catch (e) {}
    }

    // Clean up uploaded audio file if present
    try {
      if (fs.existsSync(audioFilePath)) {
        fs.unlinkSync(audioFilePath);
      }
    } catch (e) {}
  }
}
