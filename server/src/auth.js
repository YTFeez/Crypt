import { SignJWT, jwtVerify } from "jose";

export function createAuth(secret) {
  const key = new TextEncoder().encode(secret);

  async function signToken(userId, email) {
    return new SignJWT({ sub: userId, email })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("14d")
      .sign(key);
  }

  async function verifyToken(token) {
    const { payload } = await jwtVerify(token, key);
    const sub = payload.sub;
    if (typeof sub !== "string") throw new Error("Token invalide");
    return { userId: sub, email: typeof payload.email === "string" ? payload.email : "" };
  }

  return { signToken, verifyToken };
}

export function authMiddleware(auth, db) {
  return async (req, res, next) => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      res.status(401).json({ error: "Authentification requise." });
      return;
    }
    try {
      const { userId } = await auth.verifyToken(token);
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
      if (!user) {
        res.status(401).json({ error: "Compte introuvable." });
        return;
      }
      req.user = user;
      req.userId = userId;
      next();
    } catch {
      res.status(401).json({ error: "Session expirée." });
    }
  };
}

export function adminMiddleware(adminKey) {
  return (req, res, next) => {
    const key = req.headers["x-talkeo-admin"] ?? req.query.admin_key ?? "";
    if (!adminKey || key !== adminKey) {
      res.status(403).json({ error: "Clé administrateur invalide." });
      return;
    }
    next();
  };
}
