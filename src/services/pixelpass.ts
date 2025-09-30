// src/services/pixelpass.ts
export async function decodePixelpassPayload(rawInput: string): Promise<any> {
  if (!rawInput || typeof rawInput !== "string") {
    throw new Error("No raw payload");
  }

  // Clean the input (strip headers like "PP:", "HC1:", "shc:", etc.)
  let payload = rawInput.trim();
  const headerMatch = payload.match(/^[A-Za-z0-9+.-_]+:/);
  if (headerMatch) payload = payload.slice(headerMatch[0].length);
  payload = payload.replace(/\s+/g, "");

  try {
    // PixelPass exports decodeQR (per your types)
    const { decodeQR } = await import("@mosip/pixelpass");
    const decoded = decodeQR(payload);
    return tryParseDecoded(decoded);
  } catch (err: any) {
    throw new Error("PixelPass decodeQR failed: " + (err?.message || String(err)));
  }
}

function tryParseDecoded(decoded: any): any {
  if (typeof decoded === "string") {
    try {
      return JSON.parse(decoded);
    } catch {
      if (decoded.startsWith("http://") || decoded.startsWith("https://")) return { url: decoded };
      return decoded;
    }
  }
  return decoded;
}
