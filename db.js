import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

// SSL: verify the server certificate by default. If Azure ever rejects the chain,
// set PGSSL_NO_VERIFY=true to fall back to encrypt-without-verify.
function sslConfig() {
  if (process.env.PGSSL === "false") return false;
  return { rejectUnauthorized: process.env.PGSSL_NO_VERIFY !== "true" };
}

function poolConfig() {
  const ssl = sslConfig();

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

  if (/^postgres(ql)?:\/\//i.test(cs)) {
    const isLocal = /@(localhost|127\.0\.0\.1)/.test(cs);
    return { connectionString: cs, ssl: isLocal ? false : ssl, max: 10 };
  }

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
