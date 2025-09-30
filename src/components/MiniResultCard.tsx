// src/components/MiniResultCard.tsx
import "./MiniResultCard.css";

interface MiniResultCardProps {
  issuer: string;
  status: "revoked" | "good" | "success" | "failure";
  onClick?: () => void; // optional if you want to expand/click later
}

export default function MiniResultCard({ issuer, status, onClick }: MiniResultCardProps) {
  const isRevoked = status === "revoked" || status === "failure";

  return (
    <div className={`mini-card ${isRevoked ? "revoked" : "valid"}`} onClick={onClick}>
      <div className="mini-card-top">
        <strong>{issuer || "Unknown Issuer"}</strong>
      </div>
      <div className="mini-card-bottom">
        {isRevoked ? "🔴 Revoked" : "🟢 Valid"}
      </div>
    </div>
  );
}
