import { spawn } from "child_process";
import fs from "fs";
import ffmpegPath from "ffmpeg-static";

/**
 * Decodes an audio file to raw mono PCM Float32 data in Node.js.
 */
export async function decodeAudioNode(
  filePath: string,
  targetSampleRate = 44100
): Promise<{ sampleRate: number; channelData: Float32Array }> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found: ${filePath}`));
    }

    const command = ffmpegPath || "ffmpeg";

    // Spawn FFmpeg to output raw f32le mono audio stream
    const ffmpeg = spawn(command, [
      "-i",
      filePath,
      "-f",
      "f32le",
      "-ac",
      "1", // Downmix to mono
      "-ar",
      targetSampleRate.toString(), // Resample
      "-", // Output to stdout
    ]);

    const chunks: Buffer[] = [];
    let errorOutput = "";

    ffmpeg.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    ffmpeg.stderr.on("data", (data: Buffer) => {
      errorOutput += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        return reject(
          new Error(`FFmpeg decoding failed with code ${code}. Error: ${errorOutput}`)
        );
      }

      // Combine buffers
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const buffer = Buffer.concat(chunks, totalLength);

      // Convert buffer of float32s to Float32Array (4 bytes per float32)
      const sampleCount = Math.floor(buffer.length / 4);
      const channelData = new Float32Array(sampleCount);

      for (let i = 0; i < sampleCount; i++) {
        channelData[i] = buffer.readFloatLE(i * 4);
      }

      resolve({
        sampleRate: targetSampleRate,
        channelData,
      });
    });

    ffmpeg.on("error", (err) => {
      reject(new Error(`Failed to start FFmpeg. Is it installed in system PATH? Msg: ${err.message}`));
    });
  });
}
