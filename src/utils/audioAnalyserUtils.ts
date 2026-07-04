import { computeFFT, applyHanningWindow } from "./fft";

/**
 * Computes frequency spectrum magnitudes at a specific timestamp.
 * This reproduces the Web Audio API AnalyserNode behaviour offline.
 * 
 * @param pcmData Raw Float32 mono PCM data
 * @param time Timestamp in seconds
 * @param sampleRate Audio sample rate (e.g. 44100)
 * @param fftSize FFT Window size (must be power of 2, e.g. 2048)
 */
export function getFrequenciesAtTime(
  pcmData: Float32Array,
  time: number,
  sampleRate: number,
  fftSize: number = 2048
): Float32Array {
  const centerIdx = Math.floor(time * sampleRate);
  const startIdx = centerIdx - fftSize / 2;
  const slice = new Float32Array(fftSize);

  // Extract slice, padding with 0s at boundaries
  for (let i = 0; i < fftSize; i++) {
    const pcmIdx = startIdx + i;
    if (pcmIdx >= 0 && pcmIdx < pcmData.length) {
      slice[i] = pcmData[pcmIdx];
    } else {
      slice[i] = 0;
    }
  }

  // Apply Hanning Window to smooth boundaries and reduce spectral leakage
  const windowed = applyHanningWindow(slice);

  // Compute radix-2 FFT
  const magnitudes = computeFFT(windowed);

  // Convert linear magnitudes to decibels, then normalize to [0, 1] range.
  // In Web Audio AnalyserNode: minDecibels is -100, maxDecibels is -30.
  // We'll normalize using minDb = -85 and maxDb = -25 for better contrast in visualizers.
  const minDb = -85;
  const maxDb = -20;
  const dbRange = maxDb - minDb;

  const normalized = new Float32Array(magnitudes.length);
  for (let i = 0; i < magnitudes.length; i++) {
    // Normalize magnitude by dividing by N/2 (which is magnitudes.length, i.e. 1024)
    // to scale it to the original signal amplitude range [0, 1]
    const mag = magnitudes[i] / magnitudes.length;
    // Convert to dB. Add small constant to avoid log10(0)
    const db = 20 * Math.log10(Math.max(mag, 1e-6));
    
    // Scale to [0, 1]
    let val = (db - minDb) / dbRange;
    if (val < 0) val = 0;
    if (val > 1) val = 1;

    // Apply basic smoothing similar to AnalyserNode's smoothingTimeConstant
    // Since this is offline frame-by-frame, we return this frame's raw analysis.
    // (Visualizer drawing code does its own interpolation/smoothing dynamically)
    normalized[i] = val;
  }

  return normalized;
}

/**
 * Generates low-resolution waveform data for visual timelines in the editor.
 * 
 * @param pcmData Float32 mono PCM data
 * @param points Number of points to divide the timeline into
 */
export function generateWaveformPoints(pcmData: Float32Array, points: number): number[] {
  const step = Math.floor(pcmData.length / points);
  const result: number[] = [];

  for (let i = 0; i < points; i++) {
    const start = i * step;
    const end = Math.min(start + step, pcmData.length);
    let max = 0;

    for (let j = start; j < end; j++) {
      const val = Math.abs(pcmData[j]);
      if (val > max) max = val;
    }
    result.push(max);
  }

  return result;
}
