/**
 * In-place iterative Radix-2 Cooley-Tukey FFT implementation in TypeScript.
 */

// Precompute bit reversal tables and twiddle factors for common sizes to boost performance
interface FFTCache {
  bitRevTable: Int32Array;
  cosTable: Float32Array;
  sinTable: Float32Array;
}

const fftCache: { [size: number]: FFTCache } = {};

function getFFTCache(size: number): FFTCache {
  if (fftCache[size]) return fftCache[size];

  const bitRevTable = new Int32Array(size);
  const cosTable = new Float32Array(size / 2);
  const sinTable = new Float32Array(size / 2);

  // Compute bit reversal table
  let limit = 1;
  let bit = size >> 1;
  while (limit < size) {
    for (let i = 0; i < limit; i++) {
      bitRevTable[i + limit] = bitRevTable[i] + bit;
    }
    limit <<= 1;
    bit >>= 1;
  }

  // Compute twiddle factors
  for (let i = 0; i < size / 2; i++) {
    const angle = (2 * Math.PI * i) / size;
    cosTable[i] = Math.cos(angle);
    sinTable[i] = Math.sin(angle);
  }

  fftCache[size] = { bitRevTable, cosTable, sinTable };
  return fftCache[size];
}

/**
 * Computes the Fast Fourier Transform of real-valued input.
 * @param realInput Array of real number samples (length must be a power of 2, e.g. 1024 or 2048)
 * @returns Float32Array of magnitudes representing frequency bins (length is size / 2)
 */
export function computeFFT(realInput: Float32Array | number[]): Float32Array {
  const n = realInput.length;
  // Ensure size is a power of 2
  if ((n & (n - 1)) !== 0) {
    throw new Error("FFT size must be a power of 2");
  }

  const cache = getFFTCache(n);
  const { bitRevTable, cosTable, sinTable } = cache;

  // Allocate arrays for real and imaginary parts
  const r = new Float32Array(n);
  const im = new Float32Array(n);

  // Reorder inputs using bit-reversal
  for (let i = 0; i < n; i++) {
    r[bitRevTable[i]] = realInput[i];
    im[bitRevTable[i]] = 0;
  }

  // Cooley-Tukey decimation-in-time
  for (let size = 2; size <= n; size <<= 1) {
    const halfSize = size >> 1;
    const tabStep = n / size;

    for (let i = 0; i < n; i += size) {
      for (let j = 0; j < halfSize; j++) {
        const k = i + j;
        const l = k + halfSize;

        // Twiddle factor index
        const tIdx = j * tabStep;
        const wr = cosTable[tIdx];
        const wi = sinTable[tIdx];

        // Complex multiplication
        const tr = r[l] * wr + im[l] * wi;
        const ti = im[l] * wr - r[l] * wi;

        // Butterfly update
        r[l] = r[k] - tr;
        im[l] = im[k] - ti;
        r[k] += tr;
        im[k] += ti;
      }
    }
  }

  // Calculate magnitudes for first N/2 elements (the positive frequency spectrum)
  const half = n / 2;
  const magnitudes = new Float32Array(half);
  for (let i = 0; i < half; i++) {
    magnitudes[i] = Math.sqrt(r[i] * r[i] + im[i] * im[i]);
  }

  return magnitudes;
}

/**
 * Apply a Hanning window to reduce spectral leakage.
 * @param data PCM signal buffer to apply windowing to
 */
export function applyHanningWindow(data: Float32Array): Float32Array {
  const size = data.length;
  const result = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const windowValue = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
    result[i] = data[i] * windowValue;
  }
  return result;
}
