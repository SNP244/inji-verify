// src/services/storage.ts
import { openDB } from 'idb';

const RAW_API_BASE = import.meta.env.VITE_API_BASE ?? "";
export const API_BASE = RAW_API_BASE.replace(/\/$/, ""); // strip trailing slash

const DB_NAME = 'InjiVerifyDB';
const STORE_NAME = 'VerificationLogs';

export interface VerificationLog {
  id?: number;
  timestamp: number;
  data: string; // JSON string
  synced?: boolean;
}

// ------------------- Initialize IndexedDB -------------------
export async function initDB() {
  return openDB(DB_NAME, 4, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex("synced", "synced", { unique: false });
      }
      if (!db.objectStoreNames.contains("RevocationCache")) {
        db.createObjectStore("RevocationCache", { keyPath: "id" });
      }
    },
  });
}

// ------------------- Store a new VC result -------------------
export async function storeResult(data: string) {
  const db = await initDB();
  const log: VerificationLog = {
    timestamp: Date.now(),
    data,
    synced: false,
  };
  await db.add(STORE_NAME, log);
  console.log("✅ Stored log:", log);

  if (navigator.onLine) {
    console.log("🌐 Online → syncing immediately");
    await syncLogs();
  }
}

// ------------------- Fetch all logs -------------------
export async function getAllResults(): Promise<VerificationLog[]> {
  const db = await initDB();
  return db.getAll(STORE_NAME);
}

// ------------------- Sync unsynced logs with backend -------------------
export async function syncLogs(): Promise<void> {
  const db = await initDB();
  const logs = await db.getAll(STORE_NAME);

  const endpoint = (typeof window !== "undefined" && localStorage.getItem("SYNC_ENDPOINT")) || `${API_BASE}/api/logs`;

  for (const log of logs) {
    if (!log.synced) {
      try {
        const payload = JSON.parse(log.data);
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          // Mark as synced
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          const stored = await store.get(log.id);
          if (stored) {
            stored.synced = true;
            await store.put(stored);
            console.log(`✅ Synced log id ${log.id}`);
          }
          await tx.done;
        } else {
          console.warn(`⚠️ Server rejected log id ${log.id}, status ${res.status}`);
        }
      } catch (err) {
        console.warn(`⚠️ Could not sync log id ${log.id} (network error)`);
        console.error(err);
      }
    }
  }

  console.log("🔄 Sync process finished. (Only successful logs marked as synced)");
}

// ------------------- Export logs as JSON -------------------
export async function exportLogsJSON(filename = "verification-logs.json") {
  const logs = await getAllResults();
  const data = JSON.stringify(logs, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ------------------- Export logs as CSV -------------------
export async function exportLogsCSV(filename = "verification-logs.csv") {
  const logs = await getAllResults();

  const rows: string[] = [];
  rows.push(["id","timestamp","synced","issuer","shortData"].join(","));

  for (const log of logs) {
    let parsed: any;
    try { parsed = JSON.parse(log.data); } catch { parsed = { raw: log.data }; }

    const issuer = parsed?.vc?.issuer?.name || parsed?.issuer || parsed?.vc?.issuer || "";
    const raw = typeof log.data === "string" ? log.data : JSON.stringify(parsed);
    const shortData = raw.replace(/"/g, '""').slice(0, 120);

    const row = [
      log.id ?? "",
      new Date(log.timestamp).toISOString(),
      log.synced ? "true" : "false",
      `"${String(issuer).replace(/"/g, '""')}"`,
      `"${shortData.replace(/"/g, '""')}"`
    ].join(",");

    rows.push(row);
  }

  const csv = rows.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
