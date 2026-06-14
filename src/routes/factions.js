import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { ah } from "../util.js";

const r = Router();
r.use(requireAuth);

r.get("/", ah(async (req, res) => {
  const f = await query(
    "select id, name, color, sort_order from factions where school_id=$1 order by sort_order, name",
    [req.user.school_id]
  );
  res.json(f.rows);
}));

r.post("/", requireRole("admin"), ah(async (req, res) => {
  const { name, color, sort_order } = req.body || {};
  if (!name) return res.status(400).json({ error: "name is required" });
  const f = await query(
    "insert into factions (school_id, name, color, sort_order) values ($1,$2,$3,$4) returning *",
    [req.user.school_id, name, color || "#64748b", sort_order ?? 0]
  );
  res.json(f.rows[0]);
}));

r.put("/:id", requireRole("admin"), ah(async (req, res) => {
  const { name, color, sort_order } = req.body || {};
  const f = await query(
    "update factions set name=coalesce($3,name), color=coalesce($4,color), sort_order=coalesce($5,sort_order) where id=$1 and school_id=$2 returning *",
    [req.params.id, req.user.school_id, name ?? null, color ?? null, sort_order ?? null]
  );
  if (!f.rowCount) return res.status(404).json({ error: "Not found" });
  res.json(f.rows[0]);
}));

r.delete("/:id", requireRole("admin"), ah(async (req, res) => {
  await query("delete from factions where id=$1 and school_id=$2", [req.params.id, req.user.school_id]);
  res.json({ ok: true });
}));

export default r;
