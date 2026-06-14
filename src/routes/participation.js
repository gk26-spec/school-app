import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { ah } from "../util.js";

const r = Router();
r.use(requireAuth);

r.get("/", ah(async (req, res) => {
  const rows = await query(
    "select id, year_group, gender, faction_id, count from participation where school_id=$1",
    [req.user.school_id]
  );
  res.json(rows.rows);
}));

// Upsert the participation count for a faction in a race
r.put("/", requireRole("admin", "scorer"), ah(async (req, res) => {
  const { year_group, gender, faction_id, count } = req.body || {};
  if (!year_group || !gender || !faction_id)
    return res.status(400).json({ error: "year_group, gender and faction_id are required" });
  const n = Number.isFinite(+count) ? Math.max(0, parseInt(count, 10)) : 0;
  const row = await query(
    `insert into participation (school_id, year_group, gender, faction_id, count)
     values ($1,$2,$3,$4,$5)
     on conflict (school_id, year_group, gender, faction_id)
     do update set count = excluded.count
     returning *`,
    [req.user.school_id, year_group, gender, faction_id, n]
  );
  res.json(row.rows[0]);
}));

export default r;
