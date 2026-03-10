const crypto = require("crypto");
const Database = require("better-sqlite3");

const isVercel = Boolean(process.env.VERCEL);
const dbPath = isVercel ? "/tmp/airguard.db" : "airguard.db";
const db = new Database(dbPath);
const sessions = new Map();

// Keep schema creation at module load so cold starts can initialize quickly.
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
)
`);

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function createSession(userId) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, { userId, createdAt: Date.now() });
  return token;
}

function getUserFromAuth(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token || !sessions.has(token)) return null;

  const session = sessions.get(token);
  const user = db
    .prepare("SELECT id, name, email, created_at FROM users WHERE id = ?")
    .get(session.userId);

  if (!user) {
    sessions.delete(token);
    return null;
  }

  return { token, user };
}

function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        reject(new Error("Payload too large"));
      }
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON payload"));
      }
    });

    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  const pathParts = Array.isArray(req.query.path) ? req.query.path : [];
  const pathname = `/api/${pathParts.join("/")}`;

  if (pathname === "/api/bootstrap" && req.method === "GET") {
    try {
      const row = db.prepare("SELECT COUNT(*) AS total FROM users").get();
      const totalUsers = Number(row && row.total ? row.total : 0);
      sendJson(res, 200, { ok: true, hasUsers: totalUsers > 0, totalUsers });
      return;
    } catch {
      sendJson(res, 500, { ok: false, message: "Bootstrap check failed." });
      return;
    }
  }

  if (pathname === "/api/register" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");

      if (!name || !email || password.length < 6) {
        sendJson(res, 400, { ok: false, message: "Name, email and password(min 6) are required." });
        return;
      }

      const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
      if (exists) {
        sendJson(res, 409, { ok: false, message: "Email already registered." });
        return;
      }

      const now = new Date().toISOString();
      const info = db
        .prepare("INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
        .run(name, email, hashPassword(password), now);

      const token = createSession(info.lastInsertRowid);
      sendJson(res, 201, {
        ok: true,
        token,
        user: { id: info.lastInsertRowid, name, email, created_at: now }
      });
      return;
    } catch (err) {
      sendJson(res, 400, { ok: false, message: err.message || "Registration failed." });
      return;
    }
  }

  if (pathname === "/api/login" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");

      const user = db
        .prepare("SELECT id, name, email, password_hash, created_at FROM users WHERE email = ?")
        .get(email);

      if (!user || user.password_hash !== hashPassword(password)) {
        sendJson(res, 401, { ok: false, message: "Invalid email or password." });
        return;
      }

      const token = createSession(user.id);
      sendJson(res, 200, {
        ok: true,
        token,
        user: { id: user.id, name: user.name, email: user.email, created_at: user.created_at }
      });
      return;
    } catch (err) {
      sendJson(res, 400, { ok: false, message: err.message || "Login failed." });
      return;
    }
  }

  if (pathname === "/api/me" && req.method === "GET") {
    const auth = getUserFromAuth(req);
    if (!auth) {
      sendJson(res, 401, { ok: false, message: "Unauthorized" });
      return;
    }

    sendJson(res, 200, { ok: true, user: auth.user, token: auth.token });
    return;
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (token) sessions.delete(token);
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { ok: false, message: "API endpoint not found" });
};
