// Optional demo data for testing. DO NOT run against production.
import { pool, query } from "./db.js";
import { hashPassword } from "./auth.js";

const YEARS = ["Year 3", "Year 4", "Year 5", "Year 6"];
const GENDERS = ["Boys", "Girls"];
const NAMES_B = ["Jack", "Noah", "Oliver", "William", "Leo", "Henry"];
const NAMES_G = ["Olivia", "Amelia", "Charlotte", "Mia", "Ava", "Grace"];
const LAST = ["Smith", "Jones", "Brown", "Nguyen", "Taylor", "Lee"];

(async () => {
  try {
    const settings = {
      placePoints: { 1: 10, 2: 8, 3: 6, 4: 4, 5: 1, 6: 1 },
      participationValue: 1, qualifiersPerRace: 6,
      yearGroups: YEARS, genders: GENDERS,
    };
    const school = (await query(
      "insert into schools (name, settings) values ($1,$2) returning id",
      ["Demo School", JSON.stringify(settings)]
    )).rows[0];
    const sid = school.id;
    await query(
      "insert into users (school_id, email, password_hash, name, role) values ($1,$2,$3,'Demo Admin','admin')",
      [sid, "demo@demo.test", await hashPassword("changeme123")]
    );
    const factions = (await query(
      "insert into factions (school_id, name, color, sort_order) values ($1,'Maroon','#7b1e26',0),($1,'White','#e5e7eb',1) returning id",
      [sid]
    )).rows;
    let i = 0;
    for (const yg of YEARS) {
      for (const g of GENDERS) {
        const pool2 = g === "Girls" ? NAMES_G : NAMES_B;
        for (let k = 0; k < 6; k++) {
          await query(
            "insert into students (school_id, name, year_group, gender, faction_id) values ($1,$2,$3,$4,$5)",
            [sid, `${pool2[k]} ${LAST[k]}`, yg, g, factions[k % 2].id]
          );
          i++;
        }
      }
    }
    console.log(`✓ Seeded "Demo School" with ${i} students.`);
    console.log("  Login:  demo@demo.test  /  changeme123   (change this immediately)");
  } catch (e) {
    console.error("Seed failed:", e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
