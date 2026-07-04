/**
 * Decodes an audio file in the browser using the Web Audio API.
 */
export async function decodeAudioBrowser(
  audioBlob: Blob,
  audioContext: AudioContext
): Promise<AudioBuffer> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  return new Promise((resolve, reject) => {
    audioContext.decodeAudioData(
      arrayBuffer,
      (decodedData) => resolve(decodedData),
      (err) => reject(new Error(`Audio decode failed: ${err ? err.message : "Unknown error"}`))
    );
  });
}
