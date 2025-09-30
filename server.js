// server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import Database from "better-sqlite3";

const app = express();
const PORT = process.env.PORT || 5000;

// ------------------- Middleware -------------------
app.use(cors());
app.use(bodyParser.json({ limit: "5mb" }));
app.use(
  bodyParser.text({
    type: ["text/*", "application/jwt", "application/*+json"],
    limit: "5mb",
  })
);

// ------------------- Initialize SQLite DB -------------------
const db = new Database("./inji-verify.db");

// Create tables if they don't exist
db.prepare(
  `CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    synced INTEGER DEFAULT 0,
    serverTimestamp INTEGER
  )`
).run();

db.prepare(
  `CREATE TABLE IF NOT EXISTS revocations (
    id TEXT PRIMARY KEY,
    reason TEXT
  )`
).run();

// Insert default revocation entries if empty
const existing = db.prepare("SELECT COUNT(*) AS cnt FROM revocations").get();
if (existing.cnt === 0) {
  const insert = db.prepare("INSERT INTO revocations (id, reason) VALUES (?, ?)");
  insert.run("cred123", "Compromised");
  insert.run("cred999", "Expired");
  console.log("📄 Initialized revocation list in DB");
}

// ------------------- Helper -------------------
function base64urlToString(s) {
  try {
    let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    return Buffer.from(b64, "base64").toString("utf8");
  } catch (e) {
    return null;
  }
}

// ------------------- Health Check -------------------
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// ------------------- Logs Endpoints -------------------
// POST: store log
app.post("/api/logs", (req, res) => {
  const data = JSON.stringify(req.body);
  const serverTimestamp = Date.now();

  // Always mark as synced because server received it successfully
  const synced = 1;

  const stmt = db.prepare(`
    INSERT INTO logs (data, synced, serverTimestamp)
    VALUES (?, ?, ?)
  `);

  const info = stmt.run(data, synced, serverTimestamp);
  console.log("📥 Stored log in DB:", { id: info.lastInsertRowid, synced });

  res.status(201).json({ success: true, id: info.lastInsertRowid });
});



// GET: fetch all logs
app.get("/api/logs", (req, res) => {
  const rows = db.prepare("SELECT * FROM logs ORDER BY id DESC").all();
  res.json(rows);
});

// ------------------- Revocation Endpoint -------------------
app.get("/api/revocations", (req, res) => {
  const rows = db.prepare("SELECT * FROM revocations").all();
  res.json(rows);
});

// ------------------- SDK Metadata Endpoint -------------------
app.get("/v1/verify/vc-verification", (req, res) => {
  res.json({
    status: "AVAILABLE",
    service: "inji-verify-mock",
    supportedCredentialTypes: ["VerifiablePresentation", "VerifiableCredential"],
    message: "Mock VC verification service is available (offline demo)",
  });
});

// ------------------- Verification Endpoint -------------------
app.post("/v1/verify", (req, res) => {
  const body = req.body;
  let vpObj = null;

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

  // Revocation check from DB
  const credId = vpObj?.vc?.id || vpObj?.id || null;
  const revokedEntry = credId
    ? db.prepare("SELECT * FROM revocations WHERE id = ?").get(credId)
    : null;

  const result = {
    verified: !revokedEntry,
    revoked: !!revokedEntry,
    status: revokedEntry ? "revoked" : "success",
    issuer: vpObj?.issuer || vpObj?.vc?.issuer || "Demo Issuer",
    subject: vpObj?.subject || vpObj?.vc?.credentialSubject?.id || "Demo Subject",
    checkedAt: new Date().toISOString(),
    message: revokedEntry
      ? `This credential has been revoked: ${revokedEntry.reason}`
      : "Mock verification succeeded (offline demo)",
    raw: vpObj,
  };

  res.json(result);
});

// ------------------- Catch-All -------------------
app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
});

// ------------------- Start Server -------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
