import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  process.env.AZURE_POSTGRESQL_CONNECTIONSTRING ||
  process.env.POSTGRES_CONNECTIONSTRING;

if (!connectionString) {
  console.warn("[db] No connection string set. Set DATABASE_URL (or rely on Azure's AZURE_POSTGRESQL_CONNECTIONSTRING).");
}

// Azure Postgres requires SSL. Enable it for any non-local connection.
const isLocal = /localhost|127\.0\.0\.1/.test(connectionString || "");
const useSsl = process.env.PGSSL === "false" ? false : (!isLocal && !!connectionString);

export const pool = new pg.Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 10,
});

export const query = (text, params) => pool.query(text, params);
