import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { ah } from "../util.js";

const r = Router();
r.use(requireAuth);

r.get("/", ah(async (req, res) => {
  const s = await query("select name, carnival_name, settings from schools where id=$1", [req.user.school_id]);
  res.json(s.rows[0]);
}));

r.put("/", requireRole("admin"), ah(async (req, res) => {
  const { name, carnival_name, settings } = req.body || {};
  const s = await query(
    `update schools set
       name = coalesce($2, name),
       carnival_name = coalesce($3, carnival_name),
       settings = coalesce($4, settings)
     where id=$1
     returning name, carnival_name, settings`,
    [req.user.school_id, name ?? null, carnival_name ?? null, settings ? JSON.stringify(settings) : null]
  );
  res.json(s.rows[0]);
}));

export default r;
