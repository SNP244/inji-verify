// src/App.tsx

import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { QRCodeVerification } from "@mosip/react-inji-verify-sdk";


type VerificationResult = {
  status?: string;
  credential?: any;
  revocationStatus?: "revoked" | "good";
  revocationReason?: string;
  [key: string]: any;
};

import {
  storeResult,
  getAllResults,
  initDB,
  syncLogs,
  exportLogsCSV,
  exportLogsJSON,
} from "./services/storage";
import type { VerificationLog } from "./services/storage";

import ConnectivityBanner from "./components/ConnectivityBanner";
import LogCard from "./components/Logcard";
import ResultCard from "./components/Resultcard";
import MiniResultCard from "./components/MiniResultCard";

import {
  isRevoked,
  getRevocationReason,
  updateRevocationList,
   addTestRevocation,
} from "./services/revocation";

import "./App.css";

const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");
// ------------------- Scan Page -------------------
// ------------------- Scan Page -------------------
function ScanPage() {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [sessionResults, setSessionResults] = useState<VerificationResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [multiScan, setMultiScan] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const [loading, setLoading] = useState(false);

  // Looser validation to accept both "real" VCs and the demo/pixelpass wrapper payloads
  const validateVC = (data: any): { valid: boolean; msg?: string } => {
    if (!data) return { valid: false, msg: "No data found" };

    // Preferred: full Credential (VC)
    if (data.credential && data.credential.credentialSubject) return { valid: true };

    // Demo/mock response shape (used by your example): allow verified/raw/issuer fields
    if (data.verified === true || data.issuer || data.raw) return { valid: true };

    // JWT/payload object with subject/iss, etc.
    if (data.sub || data.iss || data.credentialSubject) return { valid: true };

    return { valid: false, msg: "Missing credential field" };
  };

  // Helper to decode base64url and extract JWT payload if needed
  const b64DecodeUnicode = (b64: string) => {
    let s = b64.replace(/-/g, "+").replace(/_/g, "/");
    const pad = s.length % 4;
    if (pad) s += "=".repeat(4 - pad);
    const bin = atob(s);
    try {
      return decodeURIComponent(
        Array.prototype.map
          .call(bin, (c: string) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
    } catch {
      return bin;
    }
  };

  const tryParsePayload = (maybe: any) => {
    if (typeof maybe === "object" && maybe !== null) return maybe;
    if (typeof maybe !== "string") return { raw: String(maybe) };

    const s = maybe.trim();

    // JSON
    if (s.startsWith("{") || s.startsWith("[")) {
      try {
        return JSON.parse(s);
      } catch {
        return { raw: s };
      }
    }

    // JWT (three parts)
    const jwtMatch = s.match(/^([A-Za-z0-9\-_]+)\.([A-Za-z0-9\-_]+)\.([A-Za-z0-9\-_]+)$/);
    if (jwtMatch) {
      try {
        const decoded = b64DecodeUnicode(jwtMatch[2]);
        return JSON.parse(decoded);
      } catch {
        return { raw: s };
      }
    }

    // base64 / base64url
    if (/^[A-Za-z0-9\-_]+$/.test(s)) {
      try {
        const decoded = b64DecodeUnicode(s);
        if (decoded.startsWith("{") || decoded.startsWith("[")) return JSON.parse(decoded);
        return { raw: decoded };
      } catch {
        return { raw: s };
      }
    }

    return { raw: s };
  };

  // File upload handler — only for textual uploads (.json/.jwt/.txt).
  // Image file uploads are handled by the SDK's built-in upload (see below).
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      // Reject images here and tell the user to use the SDK upload button (keeps behavior consistent)
      if (file.type.startsWith("image/")) {
        throw new Error(
          "Please use the QR component's built-in Upload (image files are handled by the SDK)."
        );
      }

      const text = await file.text();
      const payload = tryParsePayload(text);

      const validation = validateVC(payload);
      if (!validation.valid) throw new Error(validation.msg);

      const res = await fetch(`${API_BASE}/v1/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Verification failed: ${res.status} ${res.statusText} ${txt ? "- " + txt.slice(0,200) : ""}`);
      }

      const data = await res.json();

      const credId =
        data?.credential?.id || data?.credential?.credentialSubject?.id || data?.subject;
      const revoked = credId ? await isRevoked(credId) : false;
      const reason = credId ? await getRevocationReason(credId) : null;

      const enrichedResult: VerificationResult = {
        ...data,
        revocationStatus: revoked ? "revoked" : "good",
        revocationReason: reason || undefined,
      };

      await storeResult(JSON.stringify(enrichedResult));

      if (multiScan) setSessionResults((prev) => [enrichedResult, ...prev]);
      else setResult(enrichedResult);

      setMessage("Verification successful");
    } catch (err: any) {
      console.error("handleFileUpload error:", err);
      setError(err?.message || "Upload verification failed");
    } finally {
      setLoading(false);
      // reset input so same file can be re-uploaded
      (e.target as HTMLInputElement).value = "";
    }
  };

  // Handler used by the SDK for camera upload or live-scan (SDK will pass already-parsed object)
  const handleScanResult = async (data: any) => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const validation = validateVC(data);
      if (!validation.valid) throw new Error(validation.msg);

      const credId = data?.credential?.id || data?.credential?.credentialSubject?.id;
      const revoked = credId ? await isRevoked(credId) : false;
      const reason = credId ? await getRevocationReason(credId) : null;

      const enrichedResult: VerificationResult = {
        ...data,
        revocationStatus: revoked ? "revoked" : "good",
        revocationReason: reason || undefined,
      };

      await storeResult(JSON.stringify(enrichedResult));

      if (multiScan) setSessionResults((prev) => [enrichedResult, ...prev]);
      else setResult(enrichedResult);

      setMessage("Verification successful");
    } catch (err: any) {
      console.error("Scan error:", err);
      setError(err?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  // ------------------- Render -------------------
  return (
    <div className="container">
      <h1>⚡ Inji Verify – Scan / Upload</h1>

      {!result || multiScan ? (
        <div className="scanner-container">
          <div className="scanner-box">
            <div className="button-group">
              <button onClick={() => setCameraAvailable(true)} className="btn">
                📷 Scan QR
              </button>

              {/* Text/JWT uploader — keep this for .json/.jwt/.txt */}
              <label className="btn upload-btn" style={{ opacity: loading ? 0.6 : 1 }}>
                📂 Upload JSON / JWT / TXT
                <input
                  type="file"
                  accept=".json,.jwt,.txt"
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                  disabled={loading}
                />
              </label>
            </div>

            {loading && <div className="spinner">🔄 Verifying...</div>}

            {/* SDK component: enable upload so images (PNG/JPG) are handled by the SDK like before */}
            {cameraAvailable && (
              <QRCodeVerification
                verifyServiceUrl={`${API_BASE}/v1/verify`}
                isEnableScan={true}
                isEnableUpload={true}     // <-- IMPORTANT: SDK will show its own upload UI and process images
                onVCProcessed={handleScanResult}
                onError={(err) => {
                  setError(err?.message || "Camera not accessible. Please use the Upload button (image files).");
                  setCameraAvailable(false);
                }}
              />
            )}
          </div>

          <button onClick={() => setMultiScan((s) => !s)}>
            {multiScan ? "Stop Multi-scan" : "Start Multi-scan"}
          </button>

          {multiScan &&
            sessionResults.map((r, i) => (
              <MiniResultCard key={i} issuer={r.issuer || "Unknown issuer"} status={r.revocationStatus || "good"} />
            ))}

          {error && <div className="error-box">❌ {error}</div>}
          {message && <div className="info-box">✅ {message}</div>}
        </div>
      ) : (
        <ResultCard
          result={result}
          onReset={() => {
            setResult(null);
            setError(null);
            setMessage(null);
            setCameraAvailable(true);
          }}
        />
      )}
    </div>
  );
}



// ------------------- Logs Page -------------------
// ------------------- Logs Page -------------------
function LogsPage() {
  const [logs, setLogs] = useState<VerificationLog[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");

  // Load all logs
  const loadLogs = async () => {
    try {
      const all = await getAllResults();
      setLogs(all.reverse());
    } catch (err: any) {
      setError("Failed to load logs");
      console.error(err);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  // Clear all logs
  const clearLogs = async () => {
    try {
      const db = await initDB();
      await db.clear("VerificationLogs");
      setLogs([]);
      setMessage("🗑️ All logs cleared");
    } catch (err: any) {
      setError("Failed to clear logs");
      console.error(err);
    }
  };

  // Sync logs with backend
  const handleSyncNow = async () => {
    setSyncing(true);
    setMessage(null);
    setError(null);

    try {
      await syncLogs();
      setMessage("✅ Sync complete");
      await loadLogs();
    } catch (err: any) {
      console.error("Manual sync failed:", err);
      setError("❌ Sync failed. Check your connection.");
    } finally {
      setSyncing(false);
    }
  };

  // Stats
  const total = logs.length;
  const syncedCount = logs.filter((l) => l.synced).length;
  const pendingCount = total - syncedCount;

  // Filtered logs
  const visibleLogs = logs.filter((log) => {
    if (!filter) return true;
    try {
      const pd = JSON.parse(log.data);
      const hay = (JSON.stringify(pd) + (log.id ?? "")).toLowerCase();
      return hay.includes(filter.toLowerCase());
    } catch {
      return String(log.data).toLowerCase().includes(filter.toLowerCase());
    }
  });

  return (
    <div className="container">
      <h1>📜 Verification Logs</h1>

      {/* Action buttons */}
      <div className="button-group">
        <button onClick={loadLogs}>📥 Load Logs</button>
        <button onClick={handleSyncNow} disabled={syncing}>
          {syncing ? "🔄 Syncing..." : "🔁 Sync Now"}
        </button>
        <button onClick={clearLogs} className="danger">
          🗑️ Clear All Logs
        </button>
        <button onClick={() => exportLogsJSON()}>⬇️ Export JSON</button>
        <button onClick={() => exportLogsCSV()}>⬇️ Export CSV</button>
      </div>

      {/* Spinner */}
      {syncing && <div className="spinner">🔄 Syncing logs…</div>}

      {/* Messages */}
      {message && <div className="info-box">{message}</div>}
      {error && <div className="error-box">{error}</div>}

      {/* Stats */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginTop: 8,
        }}
      >
        <div className="stats-row" style={{ flex: 1 }}>
          <div className="stat">
            <div style={{ color: "#6b7280" }}>Total</div>
            <div className="num">{total}</div>
          </div>
          <div className="stat">
            <div style={{ color: "#6b7280" }}>Synced</div>
            <div className="num">{syncedCount}</div>
          </div>
          <div className="stat">
            <div style={{ color: "#6b7280" }}>Pending</div>
            <div className="num">{pendingCount}</div>
          </div>
        </div>

        <div style={{ minWidth: 220 }}>
          <input
            placeholder="Search logs (issuer / id / anything)…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #e6eefc",
            }}
          />
        </div>
      </div>

      {/* Logs grid */}
      <div className="logs-grid">
        {visibleLogs.length === 0 && (
          <div style={{ padding: 16, color: "#6b7280" }}>No logs found.</div>
        )}

        {visibleLogs.map((log) => (
          <div key={log.id}>
            <LogCard log={log} onRefresh={loadLogs} />
          </div>
        ))}
      </div>
    </div>
  );
}


// ------------------- Settings Page -------------------
function SettingsPage() {
  const [endpoint, setEndpoint] = useState<string>(
    localStorage.getItem("inji-api-base") || ""
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (endpoint) {
      localStorage.setItem("inji-api-base", endpoint);
    }
  }, [endpoint]);

  const handleRefreshRevocations = async () => {
    if (!endpoint) {
      setMessage("⚠️ Please set endpoint first");
      return;
    }
    try {
      await updateRevocationList(`${endpoint}/api/revocations`);
      setMessage("✅ Revocation list refreshed");
    } catch (err) {
      setMessage("❌ Failed to refresh revocation list");
    }
  };

  return (
    <div className="container">
      <h1>⚙️ Settings</h1>

      <div style={{ marginTop: 16 }}>
        <label>
          <strong>Server Endpoint</strong>
        </label>
        <input
          type="text"
          placeholder="http://localhost:5000"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          style={{
            display: "block",
            width: "100%",
            marginTop: 8,
            padding: 10,
            borderRadius: 6,
            border: "1px solid #ccc",
          }}
        />
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
          This will override the default <code>VITE_API_BASE</code>.
        </p>
      </div>

      <div style={{ marginTop: 20 }}>
        <button onClick={handleRefreshRevocations}>
          🔄 Refresh Revocation List
        </button>
      </div>

      {message && <div style={{ marginTop: 16 }}>{message}</div>}
    </div>
  );
}

// ------------------- Main App -------------------
function App() {
  useEffect(() => {
    // sync logs
    syncLogs().catch((e) => console.error("Initial sync failed:", e));

    // fetch revocation list on startup
    updateRevocationList(`${API_BASE}/api/revocations`);

    const onOnline = () => {
      console.log("🌐 Back online — syncing + refreshing revocation list");
      syncLogs().catch((e) => console.error("Auto sync failed:", e));
      updateRevocationList(`${API_BASE}/api/revocations`);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);
  // ✅ Add this new useEffect here
  useEffect(() => {
  addTestRevocation();  // 👈 Run once on startup
}, []);



  return (
    <Router>
      <ConnectivityBanner />
      <nav className="navbar">
        <div className="brand">⚡ Inji Verify</div>
        <div className="nav-links">
          <Link to="/scan">Scan / Upload</Link>
          <Link to="/logs">Logs</Link>
          <Link to="/settings">Settings</Link>
        </div>
      </nav>

      <Routes>
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<ScanPage />} />
      </Routes>
    </Router>
  );
}

export default App;