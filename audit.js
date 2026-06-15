import { query } from "./db.js";

// Records who did what. Never lets a logging failure break the actual request.
export async function audit(schoolId, userId, action, detail) {
  try {
    await query(
      "insert into audit_log (school_id, user_id, action, detail) values ($1,$2,$3,$4)",
      [schoolId || null, userId || null, action, detail || null]
    );
  } catch {
    /* swallow */
  }
}
