import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");

(async () => {
  try {
    console.log("Running schema.sql …");
    await pool.query(sql);
    console.log("✓ Tables are ready.");
  } catch (e) {
    console.error("Migration failed:", e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
