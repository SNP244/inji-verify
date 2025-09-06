// src/services/storage.ts

// top of file
const RAW_API_BASE = import.meta.env.VITE_API_BASE ?? "";
export const API_BASE = RAW_API_BASE.replace(/\/$/, ""); // strip trailing slash

import { openDB } from 'idb';

const DB_NAME = 'InjiVerifyDB';
const STORE_NAME = 'VerificationLogs';

export interface VerificationLog {
  id?: number;
  timestamp: number;
  data: string; // JSON string
  synced?: boolean;
}

// Initialize IndexedDB
export async function initDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
      }
    },
  });
}

// Store a new VC result
export async function storeResult(data: string) {
  const db = await initDB();
  const log: VerificationLog = {
    timestamp: Date.now(),
    data,
    synced: false,
  };
  await db.add(STORE_NAME, log);
  console.log('✅ Stored log:', log);
}

// Fetch all logs
export async function getAllResults(): Promise<VerificationLog[]> {
  const db = await initDB();
  return db.getAll(STORE_NAME);
}

// Sync unsynced logs with server
export async function syncLogs(): Promise<void> {
  const db = await initDB();
  const logs = await db.getAll(STORE_NAME);

  for (const log of logs) {
    if (!log.synced) {
      try {
        let payload: any;
        try {
          payload = JSON.parse(log.data);
        } catch {
          payload = { raw: log.data };
        }

        const endpoint = `${API_BASE || ""}/api/logs`; // if API_BASE empty => /api/logs (relative)
const res = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ...log, data: payload }),
});

        if (res.ok) {
          // ✅ Update record as synced
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const stored = await store.get(log.id);
          if (stored) {
            stored.synced = true;
            await store.put(stored);
            console.log(`✅ Synced log id ${log.id}`);
          }
          await tx.done;
        } else {
          console.error(`❌ Server rejected log id ${log.id}`);
        }
      } catch (err) {
        console.error('❌ Sync failed for log id', log.id, err);
      }
    }
  }

  console.log('✅ Sync attempt complete.');
}
