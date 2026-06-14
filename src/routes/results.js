import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { ah } from "../util.js";

const r = Router();
r.use(requireAuth);

r.get("/", ah(async (req, res) => {
  const rows = await query(
    `select r.id, r.year_group, r.gender, r.place, r.student_id, s.name as student_name, s.faction_id
     from results r join students s on s.id = r.student_id
     where r.school_id=$1 order by r.year_group, r.gender, r.place`,
    [req.user.school_id]
  );
  res.json(rows.rows);
}));

// Set / change a placement (upsert by race + place)
r.put("/", requireRole("admin", "scorer"), ah(async (req, res) => {
  const { year_group, gender, place, student_id } = req.body || {};
  if (!year_group || !gender || !place || !student_id)
    return res.status(400).json({ error: "year_group, gender, place and student_id are required" });
  if (place < 1 || place > 6) return res.status(400).json({ error: "place must be 1–6" });
  // make sure the student belongs to this school
  const own = await query("select 1 from students where id=$1 and school_id=$2", [student_id, req.user.school_id]);
  if (!own.rowCount) return res.status(400).json({ error: "Unknown student" });
  const row = await query(
    `insert into results (school_id, year_group, gender, place, student_id)
     values ($1,$2,$3,$4,$5)
     on conflict (school_id, year_group, gender, place)
     do update set student_id = excluded.student_id
     returning *`,
    [req.user.school_id, year_group, gender, place, student_id]
  );
  res.json(row.rows[0]);
}));

// Clear a placement
r.delete("/", requireRole("admin", "scorer"), ah(async (req, res) => {
  const { year_group, gender, place } = req.body || {};
  if (!year_group || !gender || !place)
    return res.status(400).json({ error: "year_group, gender and place are required" });
  await query(
    "delete from results where school_id=$1 and year_group=$2 and gender=$3 and place=$4",
    [req.user.school_id, year_group, gender, place]
  );
  res.json({ ok: true });
}));

export default r;
