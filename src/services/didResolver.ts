import { getCachedDID, setCachedDID } from "./didCache";
import type { DIDCacheEntry } from "./didCache";


const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

export async function resolveDID(payload: any): Promise<any> {
  const credId = payload?.credential?.id || payload?.credential?.credentialSubject?.id;
  if (!credId) throw new Error("Missing credential ID");

  // 1️⃣ Check cache
  const cached = await getCachedDID(credId);
  if (cached) {
    cached.lastAccessed = Date.now();
    cached.usageCount++;
    await setCachedDID(cached);
    return cached.document;
  }

  // 2️⃣ Offline? Throw error
  if (!navigator.onLine) throw new Error("Offline & DID not cached");

  // 3️⃣ Online fetch
  const res = await fetch(`${API_BASE}/v1/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
  const errText = await res.text();
  throw new Error(`DID resolution failed: ${res.status} ${errText}`);
}


  const data = await res.json();

  // 4️⃣ Cache it
  const entry: DIDCacheEntry = {
    did: credId,
    document: data,
    lastAccessed: Date.now(),
    usageCount: 1,
  };
  await setCachedDID(entry);

  return data;
}
