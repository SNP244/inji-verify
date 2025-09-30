import { useState } from "react";
import "./ResultCard.css";

interface ResultCardProps {
  result: any;
  onReset: () => void;
  backLabel?: string; // ✅ optional label for the reset button
}

export default function ResultCard({
  result,
  onReset,
  backLabel = "Upload Another",
}: ResultCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isSuccess = result?.verified === true || result?.status === "success";
  const statusText = isSuccess
    ? "✅ Verification Successful"
    : "❌ Verification Failed";

  // Revocation status + reason
  const isRevoked = result?.revocationStatus === "revoked";
  const reason = result?.revocationReason || null;

  const revocationStatus = isRevoked
    ? { text: `❌ Revoked${reason ? ` (${reason})` : ""}`, className: "revoked" }
    : { text: "✅ Not Revoked", className: "good" };

  // Try to extract meaningful fields
  const issuer = result?.issuer || result?.vc?.issuer || "Unknown Issuer";
  const subject =
    result?.subject || result?.vc?.credentialSubject?.id || "Unknown Subject";
  const timestamp = new Date().toLocaleString();

  return (
    <div className="result-card">
      <div className={`status-banner ${isSuccess ? "success" : "failure"}`}>
        {statusText}
      </div>

      <div className="info-section">
        <p>
          <strong>Issuer:</strong> {issuer}
        </p>
        <p>
          <strong>Subject:</strong> {subject}
        </p>
        <p>
          <strong>Verified At:</strong> {timestamp}
        </p>
        <p className={`revocation ${revocationStatus.className}`}>
          <strong>Revocation Status:</strong> {revocationStatus.text}
        </p>
      </div>

      <div className="actions">
        <button onClick={() => setExpanded(!expanded)}>
          {expanded ? "Hide Details" : "Show Details"}
        </button>
        <button className="secondary" onClick={onReset}>
          {backLabel}
        </button>
      </div>

      {expanded && (
        <pre className="raw-json">{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  );
}
