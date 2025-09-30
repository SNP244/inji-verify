// src/services/didCache.ts
import { openDB } from "idb";

const DB_NAME = "InjiVerifyDB";
const DB_VERSION = 4;         // <<— use 4 to match your existing DB
const STORE_NAME = "DIDCache";
const MAX_CACHE_SIZE = 100;

export type DIDCacheEntry = {
  did: string;
  document: any;
  lastAccessed: number;
  usageCount: number;
};

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "did" });
        // index to speed up eviction by lastAccessed
        store.createIndex("by_lastAccessed", "lastAccessed");
      }
      // preserve other stores if needed (VerificationLogs etc. are probably already present)
    },
  });
}

export async function getCachedDID(did: string): Promise<DIDCacheEntry | null> {
  const db = await getDB();
  return (await db.get(STORE_NAME, did)) || null;
}

export async function setCachedDID(entry: DIDCacheEntry): Promise<void> {
  const db = await getDB();

  // Add/update entry
  await db.put(STORE_NAME, entry);

  // Evict oldest if over MAX_CACHE_SIZE (efficient with index)
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const index = store.index("by_lastAccessed");
  const allCount = await store.count();
  if (allCount > MAX_CACHE_SIZE) {
    // get the oldest (smallest lastAccessed)
    const cursor = await index.openCursor();
    if (cursor) {
      const oldestDid = cursor.value.did as string;
      await store.delete(oldestDid);
    }
  }
  await tx.done;
}
