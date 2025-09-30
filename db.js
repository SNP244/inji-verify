import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "injiverify.db");
const db = new Database(DB_PATH);

// Create tables if they don’t exist
db.prepare(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    synced INTEGER DEFAULT 0,
    serverTimestamp INTEGER
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS revocations (
    id TEXT PRIMARY KEY,
    reason TEXT
  )
`).run();

export default db;
