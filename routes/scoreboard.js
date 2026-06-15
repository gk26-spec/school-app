import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../auth.js";
import { ah } from "../util.js";

const r = Router();
r.use(requireAuth);

async function loadContext(schoolId) {
  const school = (await query("select settings from schools where id=$1", [schoolId])).rows[0];
  const settings = school?.settings || {};
  const factions = (await query(
    "select id, name, color, sort_order from factions where school_id=$1 order by sort_order, name",
    [schoolId]
  )).rows;
  return { settings, factions };
}

// Live faction tally: placement points + participation points
r.get("/tally", ah(async (req, res) => {
  const sid = req.user.school_id;
  const { settings, factions } = await loadContext(sid);
  const placePoints = settings.placePoints || {};
  const partValue = settings.participationValue ?? 1;

  const results = (await query(
    "select r.place, s.faction_id from results r join students s on s.id=r.student_id where r.school_id=$1",
    [sid]
  )).rows;
  const parts = (await query("select faction_id, count from participation where school_id=$1", [sid])).rows;

  const totals = Object.fromEntries(
    factions.map((f) => [f.id, { ...f, placement: 0, participation: 0, total: 0 }])
  );
  for (const row of results) {
    if (totals[row.faction_id]) totals[row.faction_id].placement += Number(placePoints[row.place]) || 0;
  }
  for (const p of parts) {
    if (totals[p.faction_id]) totals[p.faction_id].participation += (p.count || 0) * partValue;
  }
  const list = Object.values(totals)
    .map((t) => ({ ...t, total: t.placement + t.participation }))
    .sort((a, b) => b.total - a.total);
  res.json(list);
}));

// Champion (1st) and runner-up (2nd) per race
r.get("/champions", ah(async (req, res) => {
  const sid = req.user.school_id;
  const { settings } = await loadContext(sid);
  const rows = (await query(
    `select r.year_group, r.gender, r.place, s.name as student_name, f.name as faction_name, f.color as faction_color
     from results r
     join students s on s.id = r.student_id
     left join factions f on f.id = s.faction_id
     where r.school_id=$1 and r.place in (1,2)`,
    [sid]
  )).rows;

  const yearGroups = settings.yearGroups || [];
  const genders = settings.genders || ["Boys", "Girls"];
  const out = [];
  for (const yg of yearGroups) {
    for (const g of genders) {
      const champ = rows.find((x) => x.year_group === yg && x.gender === g && x.place === 1) || null;
      const runner = rows.find((x) => x.year_group === yg && x.gender === g && x.place === 2) || null;
      out.push({ year_group: yg, gender: g, champion: champ, runner_up: runner });
    }
  }
  res.json(out);
}));

// Interschool qualifiers: top N per race
r.get("/qualifiers", ah(async (req, res) => {
  const sid = req.user.school_id;
  const { settings } = await loadContext(sid);
  const cutoff = settings.qualifiersPerRace || 6;
  const rows = (await query(
    `select r.year_group, r.gender, r.place, s.name as student_name, f.name as faction_name
     from results r
     join students s on s.id = r.student_id
     left join factions f on f.id = s.faction_id
     where r.school_id=$1 and r.place <= $2
     order by r.year_group, r.gender, r.place`,
    [sid, cutoff]
  )).rows;
  res.json({ cutoff, rows });
}));

export default r;
