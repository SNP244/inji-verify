// server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 5000;

// Resolve __dirname (since we use ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: "5mb" }));
app.use(
  bodyParser.text({
    type: ["text/*", "application/jwt", "application/*+json"],
    limit: "5mb",
  })
);

let verificationLogs = [];
let logCounter = 1;

// --- Helper: decode base64url safely ---
function base64urlToString(s) {
  try {
    let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    return Buffer.from(b64, "base64").toString("utf8");
  } catch (e) {
    return null;
  }
}

// --- Health check ---
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// --- Store logs ---
app.post("/api/logs", (req, res) => {
  const log = {
    id: logCounter++,
    ...req.body,
    serverTimestamp: Date.now(),
  };
  verificationLogs.push(log);
  console.log("📥 Received log:", log);
  res.status(201).json({ success: true, log });
});

// --- Fetch all logs ---
app.get("/api/logs", (req, res) => {
  res.json(verificationLogs);
});

// --- SDK expects metadata endpoint ---
app.get("/v1/verify/vc-verification", (req, res) => {
  res.json({
    status: "AVAILABLE",
    service: "inji-verify-mock",
    supportedCredentialTypes: ["VerifiablePresentation", "VerifiableCredential"],
    message: "Mock VC verification service is available (offline demo)",
  });
});

// --- Verification endpoint ---
app.post("/v1/verify", (req, res) => {
  const body = req.body;
  let vpObj = null;

  console.log(
    "📥 RAW BODY TYPE:",
    typeof body,
    "VALUE (first 200):",
    typeof body === "string"
      ? body.slice(0, 200)
      : JSON.stringify(body).slice(0, 200)
  );

  try {
    if (typeof body === "string") {
      try {
        vpObj = JSON.parse(body);
      } catch {
        const decoded = base64urlToString(body);
        if (decoded) {
          try {
            vpObj = JSON.parse(decoded);
          } catch {
            vpObj = { raw: decoded };
          }
        } else {
          vpObj = { raw: body };
        }
      }
    } else {
      vpObj = body;
    }
  } catch (err) {
    vpObj = { raw: String(body) };
  }

  console.log(
    "📥 /v1/verify final parsed object:",
    JSON.stringify(vpObj).slice(0, 200)
  );

  const fakeResult = [
    {
      vc: vpObj,
      vcStatus: "SUCCESS",
      message: "Mock verification succeeded (offline demo)",
    },
  ];

  res.json(fakeResult);
});

// --- Serve React frontend (dist/) ---
app.use(express.static(path.join(__dirname, "dist")));

// --- Catch-all: serve index.html for React Router ---
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
