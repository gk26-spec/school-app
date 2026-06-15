import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET;
// Refuse to run without a real secret — prevents forged login tokens.
if (!SECRET || SECRET.length < 16) {
  console.error("FATAL: JWT_SECRET is missing or too short. Set a long random JWT_SECRET (32+ chars) and restart.");
  process.exit(1);
}
const EXPIRES = "12h";

export const hashPassword = (pw) => bcrypt.hash(pw, 10);
export const checkPassword = (pw, hash) => bcrypt.compare(pw, hash);

export const signToken = (user) =>
  jwt.sign({ id: user.id, school_id: user.school_id, role: user.role }, SECRET, { expiresIn: EXPIRES });

// Basic password policy
export function validatePassword(pw) {
  if (typeof pw !== "string" || pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return "Password must include a letter and a number.";
  return null;
}

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
