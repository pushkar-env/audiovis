export interface AudioMetadata {
  title: string | null;
  artist: string | null;
  lyrics: string | null;
}

/**
 * Parses ID3v2 tags (v2.2, v2.3, v2.4) from an audio File.
 */
export async function readAudioMetadata(file: File): Promise<AudioMetadata> {
  const result: AudioMetadata = { title: null, artist: null, lyrics: null };
  
  try {
    // Read the first 128 KB of the file (sufficient for metadata header tags)
    const sliceSize = 128 * 1024;
    const blob = file.slice(0, Math.min(sliceSize, file.size));
    const buffer = await blob.arrayBuffer();
    const view = new DataView(buffer);
    
    // Check for "ID3" magic bytes
    if (view.byteLength < 10) return result;
    if (
      view.getUint8(0) !== 0x49 || // 'I'
      view.getUint8(1) !== 0x44 || // 'D'
      view.getUint8(2) !== 0x33    // '3'
    ) {
      return result;
    }
    
    const majorVersion = view.getUint8(3);
    if (majorVersion !== 2 && majorVersion !== 3 && majorVersion !== 4) return result;
    
    // Helper to decode 4-byte synchsafe integer
    const getSynchsafeSize = (offset: number) => {
      const b0 = view.getUint8(offset);
      const b1 = view.getUint8(offset + 1);
      const b2 = view.getUint8(offset + 2);
      const b3 = view.getUint8(offset + 3);
      return (b0 << 21) | (b1 << 14) | (b2 << 7) | b3;
    };
    
    const tagSize = getSynchsafeSize(6);
    const totalLength = Math.min(tagSize + 10, view.byteLength);
    
    let offset = 10;
    
    // Text decoding helper for ID3 string fields
    const textDecode = (bytes: Uint8Array, encoding: number) => {
      // Encodings: 
      // 0: ISO-8859-1 (Latin1)
      // 1: UTF-16 with BOM (LE or BE)
      // 2: UTF-16BE without BOM
      // 3: UTF-8
      let decoderName = "utf-8";
      if (encoding === 1) decoderName = "utf-16le";
      else if (encoding === 2) decoderName = "utf-16be";
      
      let startIdx = 0;
      if (encoding === 1 && bytes.length >= 2) {
        // Strip Byte Order Mark (BOM)
        if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) {
          startIdx = 2;
        }
      }
      
      try {
        const decoder = new TextDecoder(decoderName);
        let decoded = decoder.decode(bytes.slice(startIdx));
        
        // Remove trailing null terminators
        const nullIdx = decoded.indexOf("\0");
        if (nullIdx !== -1) {
          decoded = decoded.substring(0, nullIdx);
        }
        return decoded.trim();
      } catch {
        return "";
      }
    };

    while (offset + 10 < totalLength) {
      let frameId = "";
      let frameSize = 0;
      
      if (majorVersion === 2) {
        // ID3v2.2 (3-char frame IDs and 3-byte size fields)
        frameId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2));
        frameSize = (view.getUint8(offset + 3) << 16) | (view.getUint8(offset + 4) << 8) | view.getUint8(offset + 5);
        offset += 6;
      } else {
        // ID3v2.3 & ID3v2.4 (4-char frame IDs and 4-byte size fields)
        frameId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
        if (majorVersion === 4) {
          frameSize = getSynchsafeSize(offset + 4);
        } else {
          frameSize = view.getUint32(offset + 4);
        }
        offset += 10;
      }
      
      if (frameSize <= 0 || offset + frameSize > totalLength) {
        break;
      }
      
      const frameBytes = new Uint8Array(buffer, offset, frameSize);
      
      if (frameId === "TIT2" || frameId === "TT2") {
        result.title = textDecode(frameBytes.slice(1), frameBytes[0]);
      } else if (frameId === "TPE1" || frameId === "TP1") {
        result.artist = textDecode(frameBytes.slice(1), frameBytes[0]);
      } else if (frameId === "USLT" || frameId === "ULT") {
        // Unsynchronized lyrics frame structure:
        // [encoding: 1B] [lang: 3B] [content descriptor: null-terminated] [lyrics: text]
        const encoding = frameBytes[0];
        let descEnd = 4; // Skip encoding + language
        
        if (encoding === 1 || encoding === 2) {
          // UTF-16 has double null terminators \0\0
          while (descEnd + 1 < frameBytes.length) {
            if (frameBytes[descEnd] === 0 && frameBytes[descEnd + 1] === 0) {
              descEnd += 2;
              break;
            }
            descEnd += 2;
          }
        } else {
          // ISO / UTF-8 has single null terminator \0
          while (descEnd < frameBytes.length) {
            if (frameBytes[descEnd] === 0) {
              descEnd += 1;
              break;
            }
            descEnd += 1;
          }
        }
        result.lyrics = textDecode(frameBytes.slice(descEnd), encoding);
      }
      
      offset += frameSize;
    }
  } catch (err) {
    console.error("Failed to parse ID3 tags:", err);
  }
  
  return result;
}

/**
 * Parsers Artist and Title from the file name if no ID3 tags are present.
 */
export function parseArtistTitleFromFilename(filename: string): { artist: string | null; title: string | null } {
  const cleanName = filename.replace(/\.[^/.]+$/, ""); // Strip file extension
  const splitters = [" - ", " – ", " -", "- "];
  
  for (const sep of splitters) {
    if (cleanName.includes(sep)) {
      const parts = cleanName.split(sep);
      const artist = parts[0].trim();
      let title = parts[1].trim();
      
      // Remove tags like (Official Video), [Lyrics], [NCS Release]
      title = title.replace(/\s*[([].*?[\])]\s*/g, "").trim();
      return { artist, title };
    }
  }
  
  return { artist: null, title: cleanName.trim() };
}

/**
 * Fetches lyrics online using lyrics.ovh API.
 */
export async function fetchLyricsOnline(artist: string, title: string): Promise<string | null> {
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return data.lyrics || null;
  } catch (e) {
    console.error("Lyrics online search failed:", e);
    return null;
  }
}
