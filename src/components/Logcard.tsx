import { useState } from "react";
import type { MouseEvent } from "react";
import type { VerificationLog } from "../services/storage";

interface Props {
  log: VerificationLog;
  onRefresh?: () => void; // optional callback to reload logs after actions
}

export default function LogCard({ log, onRefresh }: Props) {
  const [open, setOpen] = useState(false);

  // parse data safely
  let parsed: any;
  try {
    parsed = JSON.parse(log.data);
  } catch {
    parsed = { raw: log.data };
  }

  // helpers
  const issuer =
    parsed?.vc?.issuer?.name ||
    parsed?.issuer ||
    (parsed?.vc?.issuer ? JSON.stringify(parsed.vc.issuer) : "Unknown issuer");
  const type =
    Array.isArray(parsed?.vc?.type) && parsed.vc.type.length
      ? parsed.vc.type[parsed.vc.type.length - 1]
      : parsed?.vc?.type || "Credential";
  const shortId =
    parsed?.jti || parsed?.id || parsed?.vc?.credentialSubject?.id || null;

  // Revocation status
  const revocationStatus = parsed?.revocationStatus || "good";
  const revocationClass = revocationStatus === "revoked" ? "revoked" : "good";

  // actions
  const handleCopy = async (ev: MouseEvent<HTMLButtonElement>) => {
    ev.stopPropagation();
    try {
      await navigator.clipboard?.writeText(JSON.stringify(parsed, null, 2));
      onRefresh?.();
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  const handleExport = (ev: MouseEvent<HTMLButtonElement>) => {
    ev.stopPropagation();
    const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verification-${log.id || Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onRefresh?.();
  };

  return (
    <article
      className={`log-card ${revocationClass}`}
      aria-expanded={open}
      onClick={() => setOpen((s) => !s)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setOpen((s) => !s);
      }}
    >
      <div className="log-header">
        <div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>{issuer}</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{type}</div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ marginBottom: 6, fontSize: 12, color: "#6b7280" }}>
            {new Date(log.timestamp).toLocaleString()}
          </div>
          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", alignItems: "center" }}>
            <div className={`badge ${log.synced ? "synced" : "pending"}`}>
              {log.synced ? "✅ Synced" : "⏳ Pending"}
            </div>
           <div className={`badge ${revocationClass}`}>
      {revocationStatus === "revoked" ? "❌ Revoked" : "✅ Not Revoked"}
    </div>
          </div>
        </div>
      </div>

      {!open && (
        <div style={{ marginTop: 12, color: "#374151", fontSize: 14 }}>
          {shortId ? (
            <div>
              <strong>ID:</strong> {String(shortId).slice(0, 24)}
            </div>
          ) : (
            <div style={{ color: "#6b7280" }}>Tap to view details</div>
          )}
        </div>
      )}

      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 8, color: "#6b7280", fontSize: 13 }}>Full VC JSON</div>
          <pre
            style={{
              background: "#f4f6f9",
              padding: 10,
              borderRadius: 8,
              maxHeight: 260,
              overflow: "auto",
              fontSize: 13,
              color: "#111827",
            }}
          >
            {JSON.stringify(parsed, null, 2)}
          </pre>

          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button onClick={handleCopy} title="Copy JSON">Copy JSON</button>
            <button onClick={handleExport} title="Export JSON">Export JSON</button>
            <div style={{ marginLeft: "auto", color: "#6b7280", fontSize: 13, alignSelf: "center" }}>
              Click card to collapse ▲
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
