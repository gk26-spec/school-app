import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "dev-only-change-me";
if (SECRET === "dev-only-change-me") {
  console.warn("[auth] JWT_SECRET is not set — using an insecure default. Set JWT_SECRET in production.");
}
const EXPIRES = "12h";

export const hashPassword = (pw) => bcrypt.hash(pw, 10);
export const checkPassword = (pw, hash) => bcrypt.compare(pw, hash);

export const signToken = (user) =>
  jwt.sign({ id: user.id, school_id: user.school_id, role: user.role }, SECRET, { expiresIn: EXPIRES });

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role))
    return res.status(403).json({ error: "You don't have permission to do that" });
  next();
};
