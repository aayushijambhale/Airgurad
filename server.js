const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");

require("dotenv").config();

const PORT = process.env.PORT || 3001;
const rootDir = __dirname;
const publicDir = path.join(rootDir, "public"); // Serve straight from public dir!
const authSecret = process.env.AUTH_SECRET || "airguard-dev-secret-change-me";
const mongoUri = process.env.MONGODB_URI || "";
const mongoDbName = process.env.MONGODB_DB || "airguard";

let mongoClient = null;
let usersCollection = null;

function isMongoAuthError(err) {
  const message = String(err && err.message ? err.message : "").toLowerCase();
  return message.includes("authentication failed") || message.includes("bad auth") || message.includes("auth failed");
}

function isMongoTopologyClosedError(err) {
  const message = String(err && err.message ? err.message : "").toLowerCase();
  return message.includes("topology is closed") || message.includes("pool is closed") || message.includes("connection closed");
}

function dbErrorMessage(err, fallback) {
  if (isMongoAuthError(err)) {
    return "Database authentication failed. Check MONGODB_URI username/password and URL encoding.";
  }
  if (isMongoTopologyClosedError(err)) {
    return "Database connection was reset. Please retry your request.";
  }
  return fallback;
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

async function getUsersCollection() {
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not configured.");
  }
  if (mongoUri.includes("<username>") || mongoUri.includes("<password>") || mongoUri.includes("<cluster-host>")) {
    throw new Error("MONGODB_URI still contains placeholders.");
  }

  if (usersCollection && mongoClient) {
    try {
      await mongoClient.db(mongoDbName).command({ ping: 1 });
      return usersCollection;
    } catch (err) {
      if (!isMongoTopologyClosedError(err)) {
        throw err;
      }
      usersCollection = null;
      try {
        await mongoClient.close();
      } catch {}
      mongoClient = null;
    }
  }

  if (!mongoClient) {
    mongoClient = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      maxPoolSize: 10
    });
    await mongoClient.connect();
  }

  const db = mongoClient.db(mongoDbName);
  usersCollection = db.collection("users");
  await usersCollection.createIndex({ email: 1 }, { unique: true });
  return usersCollection;
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
    uid: String(userId),
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
    if (!payload || typeof payload.uid !== "string") return null;
    if (!ObjectId.isValid(payload.uid)) return null;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

async function getUserFromAuth(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const userId = getUserIdFromToken(token);
  if (!userId) return null;

  const users = await getUsersCollection();
  const user = await users.findOne(
    { _id: new ObjectId(userId) },
    { projection: { _id: 1, name: 1, email: 1, created_at: 1 } }
  );

  if (!user) return null;

  return {
    token,
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      created_at: user.created_at
    }
  };
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
      const users = await getUsersCollection();
      const totalUsers = await users.countDocuments({});
      sendJson(res, 200, { ok: true, hasUsers: totalUsers > 0, totalUsers });
      return true;
    } catch (err) {
      if (isMongoTopologyClosedError(err)) {
        usersCollection = null;
        mongoClient = null;
      }
      sendJson(res, 500, { ok: false, message: dbErrorMessage(err, "Bootstrap check failed.") });
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

      const users = await getUsersCollection();
      const exists = await users.findOne({ email }, { projection: { _id: 1 } });
      if (exists) {
        sendJson(res, 409, { ok: false, message: "Email already registered." });
        return true;
      }

      const now = new Date().toISOString();
      const info = await users.insertOne({
        name,
        email,
        password_hash: hashPassword(password),
        created_at: now
      });

      const userId = String(info.insertedId);
      const token = createSession(userId);
      sendJson(res, 201, {
        ok: true,
        token,
        user: { id: userId, name, email, created_at: now }
      });
      return true;
    } catch (err) {
      if (isMongoTopologyClosedError(err)) {
        usersCollection = null;
        mongoClient = null;
      }
      const statusCode = isMongoAuthError(err) ? 500 : 400;
      sendJson(res, statusCode, { ok: false, message: dbErrorMessage(err, err.message || "Registration failed.") });
      return true;
    }
  }

  if (pathname === "/api/login" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");

      const users = await getUsersCollection();
      const user = await users.findOne({ email });

      if (!user || user.password_hash !== hashPassword(password)) {
        sendJson(res, 401, { ok: false, message: "Invalid email or password." });
        return true;
      }

      const userId = String(user._id);
      const token = createSession(userId);
      sendJson(res, 200, {
        ok: true,
        token,
        user: { id: userId, name: user.name, email: user.email, created_at: user.created_at }
      });
      return true;
    } catch (err) {
      if (isMongoTopologyClosedError(err)) {
        usersCollection = null;
        mongoClient = null;
      }
      const statusCode = isMongoAuthError(err) ? 500 : 400;
      sendJson(res, statusCode, { ok: false, message: dbErrorMessage(err, err.message || "Login failed.") });
      return true;
    }
  }

  if (pathname === "/api/me" && req.method === "GET") {
    const auth = await getUserFromAuth(req);
    if (!auth) {
      sendJson(res, 401, { ok: false, message: "Unauthorized" });
      return true;
    }

    sendJson(res, 200, { ok: true, user: auth.user, token: auth.token });
    return true;
  }

  if (pathname === "/api/logout" && req.method === "POST") {
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
