const crypto = require("crypto");
const Database = require("better-sqlite3");

const isVercel = Boolean(process.env.VERCEL);
const dbPath = isVercel ? "/tmp/airguard.db" : "airguard.db";
const db = new Database(dbPath);
const authSecret = process.env.AUTH_SECRET || "airguard-dev-secret-change-me";

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

function toBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function signTokenPart(payloadPart) {
  return toBase64Url(crypto.createHmac("sha256", authSecret).update(payloadPart).digest());
}

function createSession(userId) {
  const payload = {
    uid: Number(userId),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000
  };
  const payloadPart = toBase64Url(JSON.stringify(payload));
  const signaturePart = signTokenPart(payloadPart);
  return `${payloadPart}.${signaturePart}`;
}

function getUserIdFromToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;

  const payloadPart = parts[0];
  const signaturePart = parts[1];
  const expectedSignature = signTokenPart(payloadPart);
  if (signaturePart !== expectedSignature) return null;

  try {
    const payload = JSON.parse(fromBase64Url(payloadPart));
    if (!payload || typeof payload.uid !== "number") return null;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

function getUserFromAuth(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const userId = getUserIdFromToken(token);
  if (!userId) return null;

  const user = db
    .prepare("SELECT id, name, email, created_at FROM users WHERE id = ?")
    .get(userId);

  if (!user) return null;

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
  const requestPathname = (() => {
    try {
      return new URL(req.url || "/api", "http://localhost").pathname;
    } catch {
      return "/api";
    }
  })();

  const rawPath = req.query ? req.query.path : undefined;
  const pathFromQuery = Array.isArray(rawPath)
    ? `/api/${rawPath.join("/")}`
    : typeof rawPath === "string" && rawPath.length > 0
      ? `/api/${rawPath}`
      : "/api";

  // Prefer actual URL path because req.query path params are inconsistent across runtimes.
  const pathname = requestPathname.startsWith("/api/") || requestPathname === "/api"
    ? requestPathname
    : pathFromQuery;

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
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { ok: false, message: "API endpoint not found" });
};
