const crypto = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");

const authSecret = process.env.AUTH_SECRET || "airguard-dev-secret-change-me";
const mongoUri = process.env.MONGODB_URI || "";
const mongoDbName = process.env.MONGODB_DB || "airguard";

let mongoClient = null;
let usersCollection = null;

function isMongoAuthError(err) {
  const message = String(err && err.message ? err.message : "").toLowerCase();
  return message.includes("authentication failed") || message.includes("bad auth") || message.includes("auth failed");
}

function dbErrorMessage(err, fallback) {
  if (isMongoAuthError(err)) {
    return "Database authentication failed. Check MONGODB_URI username/password and URL encoding.";
  }
  return fallback;
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

async function getUsersCollection() {
  if (usersCollection) return usersCollection;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not configured.");
  }
  if (mongoUri.includes("<username>") || mongoUri.includes("<password>") || mongoUri.includes("<cluster-host>")) {
    throw new Error("MONGODB_URI still contains placeholders.");
  }

  if (!mongoClient) {
    mongoClient = new MongoClient(mongoUri);
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
      const users = await getUsersCollection();
      const totalUsers = await users.countDocuments({});
      sendJson(res, 200, { ok: true, hasUsers: totalUsers > 0, totalUsers });
      return;
    } catch (err) {
      sendJson(res, 500, { ok: false, message: dbErrorMessage(err, "Bootstrap check failed.") });
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

      const users = await getUsersCollection();
      const exists = await users.findOne({ email }, { projection: { _id: 1 } });
      if (exists) {
        sendJson(res, 409, { ok: false, message: "Email already registered." });
        return;
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
      return;
    } catch (err) {
      const statusCode = isMongoAuthError(err) ? 500 : 400;
      sendJson(res, statusCode, { ok: false, message: dbErrorMessage(err, err.message || "Registration failed.") });
      return;
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
        return;
      }

      const userId = String(user._id);
      const token = createSession(userId);
      sendJson(res, 200, {
        ok: true,
        token,
        user: { id: userId, name: user.name, email: user.email, created_at: user.created_at }
      });
      return;
    } catch (err) {
      const statusCode = isMongoAuthError(err) ? 500 : 400;
      sendJson(res, statusCode, { ok: false, message: dbErrorMessage(err, err.message || "Login failed.") });
      return;
    }
  }

  if (pathname === "/api/me" && req.method === "GET") {
    const auth = await getUserFromAuth(req);
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
