const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const PORT = process.env.PORT || 3001;
const rootDir = __dirname;
const publicDir = path.join(rootDir, "public"); // Serve straight from public dir!
const dbPath = path.join(rootDir, "airguard.db");
const db = new Database(dbPath);
const sessions = new Map();

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

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
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
  });
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/bootstrap" && req.method === "GET") {
    try {
      const row = db.prepare("SELECT COUNT(*) AS total FROM users").get();
      const totalUsers = Number(row?.total || 0);
      sendJson(res, 200, { ok: true, hasUsers: totalUsers > 0, totalUsers });
      return true;
    } catch (err) {
      sendJson(res, 500, { ok: false, message: "Bootstrap check failed." });
      return true;
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
        return true;
      }

      const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
      if (exists) {
        sendJson(res, 409, { ok: false, message: "Email already registered." });
        return true;
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
      return true;
    } catch (err) {
      sendJson(res, 400, { ok: false, message: err.message || "Registration failed." });
      return true;
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
        return true;
      }

      const token = createSession(user.id);
      sendJson(res, 200, {
        ok: true,
        token,
        user: { id: user.id, name: user.name, email: user.email, created_at: user.created_at }
      });
      return true;
    } catch (err) {
      sendJson(res, 400, { ok: false, message: err.message || "Login failed." });
      return true;
    }
  }

  if (pathname === "/api/me" && req.method === "GET") {
    const auth = getUserFromAuth(req);
    if (!auth) {
      sendJson(res, 401, { ok: false, message: "Unauthorized" });
      return true;
    }

    sendJson(res, 200, { ok: true, user: auth.user, token: auth.token });
    return true;
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (token) sessions.delete(token);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname.startsWith("/api/")) {
    const handled = await handleApi(req, res, pathname);
    if (!handled) {
      sendJson(res, 404, { ok: false, message: "API endpoint not found" });
    }
    return;
  }

  // Handle views dynamically
  let reqPath = pathname;
  if (reqPath === "/") reqPath = "/dashboard.html";
  else if (!reqPath.includes(".")) reqPath = reqPath + ".html"; // Append HTML extension automatically for links

  const safePath = path.normalize(reqPath).replace(/^\\.\\.(\\\\|\/|$)/, "");
  const filePath = path.join(publicDir, safePath);

  sendFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
