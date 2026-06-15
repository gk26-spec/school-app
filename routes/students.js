import { Router } from "express";
import { pool, query } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { ah } from "../util.js";

const r = Router();
r.use(requireAuth);

r.get("/", ah(async (req, res) => {
  const s = await query(
    "select id, name, year_group, gender, faction_id from students where school_id=$1 order by year_group, gender, name",
    [req.user.school_id]
  );
  res.json(s.rows);
}));

r.post("/", requireRole("admin"), ah(async (req, res) => {
  const { name, year_group, gender, faction_id } = req.body || {};
  if (!name || !year_group || !gender)
    return res.status(400).json({ error: "name, year_group and gender are required" });
  const s = await query(
    "insert into students (school_id, name, year_group, gender, faction_id) values ($1,$2,$3,$4,$5) returning *",
    [req.user.school_id, name, year_group, gender, faction_id || null]
  );
  res.json(s.rows[0]);
}));

// Bulk add (paste a class list)
r.post("/bulk", requireRole("admin"), ah(async (req, res) => {
  const list = Array.isArray(req.body) ? req.body : req.body?.students || [];
  if (!Array.isArray(list) || !list.length)
    return res.status(400).json({ error: "Provide an array of students" });
  const client = await pool.connect();
  try {
    await client.query("begin");
    const out = [];
    for (const s of list) {
      if (!s.name || !s.year_group || !s.gender) continue;
      const row = await client.query(
        "insert into students (school_id, name, year_group, gender, faction_id) values ($1,$2,$3,$4,$5) returning *",
        [req.user.school_id, s.name, s.year_group, s.gender, s.faction_id || null]
      );
      out.push(row.rows[0]);
    }
    await client.query("commit");
    res.json({ added: out.length, students: out });
  } catch (e) {
    await client.query("rollback");
    console.error(e);
    res.status(500).json({ error: "Bulk insert failed" });
  } finally {
    client.release();
  }
}));

r.put("/:id", requireRole("admin"), ah(async (req, res) => {
  const { name, year_group, gender, faction_id } = req.body || {};
  const s = await query(
    "update students set name=coalesce($3,name), year_group=coalesce($4,year_group), gender=coalesce($5,gender), faction_id=$6 where id=$1 and school_id=$2 returning *",
    [req.params.id, req.user.school_id, name ?? null, year_group ?? null, gender ?? null, faction_id ?? null]
  );
  if (!s.rowCount) return res.status(404).json({ error: "Not found" });
  res.json(s.rows[0]);
}));

r.delete("/:id", requireRole("admin"), ah(async (req, res) => {
  await query("delete from students where id=$1 and school_id=$2", [req.params.id, req.user.school_id]);
  res.json({ ok: true });
}));

export default r;
