// src/App.tsx
import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { storeResult, getAllResults, initDB, syncLogs } from "./services/storage";
import type { VerificationLog } from "./services/storage";
import ConnectivityBanner from "./components/ConnectivityBanner";
import { QRCodeVerification } from "@mosip/react-inji-verify-sdk";
const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

import "./App.css";

function ScanPage() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="container">
      <h1>Inji Verify – QR Upload</h1>

      {!result ? (
        <>
          <QRCodeVerification
            verifyServiceUrl={`${API_BASE || ""}/v1/verify`}
            onVCProcessed={(res: any) => {
              console.log("✅ Verified VP:", res);
              setResult(res);
              storeResult(JSON.stringify(res)).catch(console.error);
            }}
            onError={(e: any) => {
              console.error("❌ Verification failed:", e);
              setError(e?.message || String(e));
            }}
            triggerElement={<button id="upload-trigger">📂 Upload QR</button>}
            isEnableScan={false} // camera disabled
            isEnableUpload={true}
            uploadButtonId="upload-trigger"
          />

          {error && <div className="error">{error}</div>}
        </>
      ) : (
        <div className="result-box">
          <h2>Verification Result</h2>
          <pre>{JSON.stringify(result, null, 2)}</pre>
          <button onClick={() => { setResult(null); setError(null); }}>Upload Another</button>
        </div>
      )}
    </div>
  );
}

function LogsPage() {
  const [logs, setLogs] = useState<VerificationLog[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadLogs = async () => {
    const all = await getAllResults();
    setLogs(all.reverse());
  };

  const clearLogs = async () => {
    const db = await initDB();
    await db.clear("VerificationLogs");
    setLogs([]);
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      await syncLogs();
      setMessage("✅ Sync complete");
      await loadLogs();
    } catch (err: any) {
      console.error("Manual sync failed:", err);
      setMessage("❌ Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="container">
      <h1>Stored Verification Logs</h1>
      <div className="button-group">
        <button onClick={loadLogs}>📥 Load Logs</button>
        <button onClick={handleSyncNow} disabled={syncing}>
          {syncing ? "🔄 Syncing..." : "🔁 Sync Now"}
        </button>
        <button onClick={clearLogs} className="danger">🗑️ Clear All Logs</button>
      </div>

      {message && <div style={{ marginTop: 8 }}>{message}</div>}

      <ul className="log-list">
        {logs.map((log) => {
          let parsedData: Record<string, any>;
          try {
            parsedData = JSON.parse(log.data);
          } catch {
            parsedData = { raw: log.data };
          }

          return (
            <li key={log.id} className="log-card">
              <b>{new Date(log.timestamp).toLocaleString()}</b>
              <pre>{JSON.stringify(parsedData, null, 2)}</pre>
              <span className={`badge ${log.synced ? "synced" : "pending"}`}>
                {log.synced ? "✅ Synced" : "⏳ Pending"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function App() {
  // 🔄 Auto sync on load and when online
  useEffect(() => {
    syncLogs().catch((e) => console.error("Initial sync failed:", e));
    const onOnline = () => {
      console.log("🌐 Back online — running syncLogs()");
      syncLogs().catch((e) => console.error("Auto sync failed:", e));
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return (
    <Router>
      <ConnectivityBanner />
      <nav className="navbar">
        <div className="brand">Inji Verify</div>
        <div className="nav-links">
          <Link to="/scan">Scan / Upload</Link>
          <Link to="/logs">Logs</Link>
        </div>
      </nav>
      <Routes>
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="*" element={<ScanPage />} />
      </Routes>
    </Router>
  );
}

export default App;
