import { openDB } from "idb";

const DB_NAME = "InjiVerifyDB";
const LOGS_STORE = "VerificationLogs";
const REVOCATION_STORE = "RevocationList";

export interface RevocationEntry {
  id: string;
  reason?: string;
}

export async function initDB() {
  return openDB(DB_NAME, 4, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(LOGS_STORE)) {
        db.createObjectStore(LOGS_STORE, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(REVOCATION_STORE)) {
        db.createObjectStore(REVOCATION_STORE, { keyPath: "id" });
      }
    },
  });
}

// ✅ Check if credential is revoked (with debug logs)
export async function isRevoked(credentialId: string): Promise<boolean> {
  const db = await initDB();
  const entry = await db.get(REVOCATION_STORE, credentialId);

  // 🔎 Debugging logs
  const all = await db.getAll(REVOCATION_STORE);
  console.log("📌 Checking credentialId:", credentialId);
  console.log("📌 Revocation entries in DB:", all);
  console.log("📌 Matched entry for this credId:", entry);

  return !!entry;
}

// ✅ Get reason if revoked
export async function getRevocationReason(credentialId: string): Promise<string | null> {
  const db = await initDB();
  const entry = await db.get(REVOCATION_STORE, credentialId);
  return entry?.reason || null;
}

// ✅ Cache list in DB
export async function cacheRevocationList(list: RevocationEntry[]) {
  const db = await initDB();
  const tx = db.transaction(REVOCATION_STORE, "readwrite");
  const store = tx.objectStore(REVOCATION_STORE);
  await store.clear();
  for (const entry of list) {
    await store.put(entry);
  }
  await tx.done;
  console.log("✅ Revocation list cached:", list);
}

// ✅ Fetch & update list from backend
export async function updateRevocationList(endpoint: string): Promise<boolean> {
  try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`Failed to fetch revocation list: ${res.status}`);
    const list = await res.json();
    if (Array.isArray(list)) {
      await cacheRevocationList(list);
      return true;
    }
    return false;
  } catch (err) {
    console.error("⚠️ Failed to update revocation list:", err);
    return false;
  }
}

// ⚡ Temporary helper to add a test revoked credential
export async function addTestRevocation() {
  const db = await initDB();
  const tx = db.transaction(REVOCATION_STORE, "readwrite");
  const store = tx.objectStore(REVOCATION_STORE);

  // Add Demo Subject as revoked
  await store.put({ id: "Demo Subject", reason: "Test revocation" });
  await tx.done;

  console.log("✅ Test revocation added for 'Demo Subject'");
}
