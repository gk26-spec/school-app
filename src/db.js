import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

// Build a pg pool config that works with any way Azure (or local dev) supplies the
// connection: discrete vars, a postgres:// URL, or a Microsoft keyword string such as
// "Database=...;Server=...;User Id=...;Password=..." (possibly under a CUSTOMCONNSTR_ prefix).
function poolConfig() {
  const ssl = process.env.PGSSL === "false" ? false : { rejectUnauthorized: false };

  // 1) Azure Service Connector discrete vars
  if (process.env.AZURE_POSTGRESQL_HOST) {
    return {
      host: process.env.AZURE_POSTGRESQL_HOST,
      user: process.env.AZURE_POSTGRESQL_USER,
      password: process.env.AZURE_POSTGRESQL_PASSWORD,
      database: process.env.AZURE_POSTGRESQL_DATABASE,
      port: parseInt(process.env.AZURE_POSTGRESQL_PORT || "5432", 10),
      ssl, max: 10,
    };
  }

  // 2) Find a connection string by known names, then by scanning for any
  //    PostgreSQL connection variable (covers CUSTOMCONNSTR_/POSTGRESQLCONNSTR_ prefixes).
  const scanned = Object.keys(process.env).find((k) => /postgres/i.test(k) && /conn/i.test(k));
  const cs =
    process.env.DATABASE_URL ||
    process.env.AZURE_POSTGRESQL_CONNECTIONSTRING ||
    process.env.CUSTOMCONNSTR_AZURE_POSTGRESQL_CONNECTIONSTRING ||
    process.env.POSTGRES_CONNECTIONSTRING ||
    (scanned ? process.env[scanned] : undefined);

  if (!cs) {
    console.warn("[db] No database configuration found (set DATABASE_URL or rely on Azure's injected settings).");
    return { max: 10 };
  }

  // URL form: postgres://user:pass@host:5432/db
  if (/^postgres(ql)?:\/\//i.test(cs)) {
    const isLocal = /@(localhost|127\.0\.0\.1)/.test(cs);
    return { connectionString: cs, ssl: isLocal ? false : ssl, max: 10 };
  }

  // Keyword form. Microsoft style is ";"-separated ("User Id=..."); libpq style is space-separated.
  const parts = cs.includes(";") ? cs.split(";") : cs.split(/\s+/);
  const kv = {};
  for (const part of parts) {
    const i = part.indexOf("=");
    if (i > 0) kv[part.slice(0, i).trim().toLowerCase().replace(/\s+/g, "")] = part.slice(i + 1).trim();
  }
  return {
    host: kv.server || kv.host,
    user: kv.userid || kv.user || kv.username || kv.uid,
    password: kv.password || kv.pwd,
    database: kv.database || kv.dbname,
    port: parseInt(kv.port || "5432", 10),
    ssl, max: 10,
  };
}

export const pool = new pg.Pool(poolConfig());
export const query = (text, params) => pool.query(text, params);
