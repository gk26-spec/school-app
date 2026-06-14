import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

// Build a pg pool config that works whether the connection is provided as:
//  - Azure Service Connector discrete vars (AZURE_POSTGRESQL_HOST/USER/PASSWORD/DATABASE/PORT)
//  - a URL string (DATABASE_URL=postgres://user:pass@host:5432/db)
//  - a keyword string (host=... port=... dbname=... user=... password=... sslmode=require)
function poolConfig() {
  const ssl = { rejectUnauthorized: false };

  // 1) Azure Service Connector discrete vars (what "Web App + Database" usually injects)
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

  // 2) A connection string — your own DATABASE_URL, or Azure's injected one
  const cs =
    process.env.DATABASE_URL ||
    process.env.AZURE_POSTGRESQL_CONNECTIONSTRING ||
    process.env.POSTGRES_CONNECTIONSTRING;

  if (!cs) {
    console.warn("[db] No database configuration found (set DATABASE_URL or rely on Azure's injected settings).");
    return { max: 10 };
  }

  // URL form
  if (/^postgres(ql)?:\/\//i.test(cs)) {
    const isLocal = /@(localhost|127\.0\.0\.1)/.test(cs);
    return { connectionString: cs, ssl: isLocal && process.env.PGSSL !== "require" ? false : ssl, max: 10 };
  }

  // Keyword / ADO form
  const kv = {};
  for (const part of cs.split(/;|\s+/)) {
    const i = part.indexOf("=");
    if (i > 0) kv[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return {
    host: kv.host || kv.server,
    user: kv.user || kv.username || kv.uid,
    password: kv.password || kv.pwd,
    database: kv.dbname || kv.database,
    port: parseInt(kv.port || "5432", 10),
    ssl, max: 10,
  };
}

export const pool = new pg.Pool(poolConfig());
export const query = (text, params) => pool.query(text, params);
