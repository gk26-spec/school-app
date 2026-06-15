import { Router } from "express";
import rateLimit from "express-rate-limit";
import { query } from "../db.js";
import { hashPassword, checkPassword, signToken, validatePassword, requireAuth, requireRole } from "../auth.js";
import { audit } from "../audit.js";

const r = Router();

// Throttle login/registration to slow brute-force and abuse.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." },
});

function defaultSettings() {
  return {
    placePoints: { 1: 10, 2: 8, 3: 6, 4: 4, 5: 1, 6: 1 },
    participationValue: 1,
    qualifiersPerRace: 6,
    yearGroups: ["Kindy", "Pre-primary", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6", "U13", "U14", "U15", "U16", "Open"],
    genders: ["Boys", "Girls"],
  };
}

r.post("/register", authLimiter, async (req, res) => {
  const { schoolName, email, password, name, signupCode } = req.body || {};
  // Controlled onboarding: if SIGNUP_CODE is set, a matching code is required.
  if (process.env.SIGNUP_CODE && signupCode !== process.env.SIGNUP_CODE)
    return res.status(403).json({ error: "A valid signup code is required to create a school." });
  if (!schoolName || !email || !password)
    return res.status(400).json({ error: "schoolName, email and password are required" });
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });
  try {
    const exists = await query("select 1 from users where lower(email)=lower($1)", [email]);
    if (exists.rowCount) return res.status(409).json({ error: "That email is already registered" });

    const school = await query(
      "insert into schools (name, settings) values ($1, $2) returning id, name, carnival_name, settings",
      [schoolName, JSON.stringify(defaultSettings())]
    );
    const sid = school.rows[0].id;
    const hash = await hashPassword(password);
    const user = await query(
      "insert into users (school_id, email, password_hash, name, role) values ($1,$2,$3,$4,'admin') returning id, school_id, email, name, role",
      [sid, email, hash, name || null]
    );
    await query(
      "insert into factions (school_id, name, color, sort_order) values ($1,'Maroon','#7b1e26',0),($1,'White','#e5e7eb',1)",
      [sid]
    );
    audit(sid, user.rows[0].id, "REGISTER_SCHOOL", schoolName);
    res.json({ token: signToken(user.rows[0]), user: user.rows[0], school: school.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not register" });
  }
});

r.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });
  try {
    const u = await query("select * from users where lower(email)=lower($1)", [email]);
    if (!u.rowCount || !(await checkPassword(password, u.rows[0].password_hash))) {
      audit(null, null, "LOGIN_FAILED", email);
      return res.status(401).json({ error: "Wrong email or password" });
    }
    const { id, school_id, email: em, name, role } = u.rows[0];
    audit(school_id, id, "LOGIN", em);
    res.json({ token: signToken(u.rows[0]), user: { id, school_id, email: em, name, role } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Login failed" });
  }
});

r.get("/me", requireAuth, async (req, res) => {
  const u = await query("select id, school_id, email, name, role from users where id=$1", [req.user.id]);
  const s = await query("select id, name, carnival_name, settings from schools where id=$1", [req.user.school_id]);
  res.json({ user: u.rows[0], school: s.rows[0] });
});

r.post("/users", requireAuth, requireRole("admin"), async (req, res) => {
  const { email, password, name, role } = req.body || {};
  if (!email || !password || !["admin", "scorer", "viewer"].includes(role))
    return res.status(400).json({ error: "email, password and a valid role (admin/scorer/viewer) are required" });
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });
  try {
    const exists = await query("select 1 from users where lower(email)=lower($1)", [email]);
    if (exists.rowCount) return res.status(409).json({ error: "That email is already registered" });
    const hash = await hashPassword(password);
    const user = await query(
      "insert into users (school_id, email, password_hash, name, role) values ($1,$2,$3,$4,$5) returning id, school_id, email, name, role",
      [req.user.school_id, email, hash, name || null, role]
    );
    res.json({ user: user.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not create user" });
  }
});

r.get("/users", requireAuth, requireRole("admin"), async (req, res) => {
  const u = await query("select id, email, name, role, created_at from users where school_id=$1 order by created_at", [req.user.school_id]);
  res.json(u.rows);
});

export default r;
