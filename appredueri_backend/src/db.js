const { Pool } = require("pg");
require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway shared-certificate setup: TLS encryption without cert verification.
  // TODO: Obtain Railway CA cert and switch to { rejectUnauthorized: true, ca: ... }
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  // Connection pool settings
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // Prevent runaway queries from blocking connections
  statement_timeout: 10000, // 10 secunde max per query
});

// Log connection status
pool.on("connect", () => {
  if (!isProduction) {
    console.log("[DB] Connected to PostgreSQL");
  }
});

pool.on("error", (err) => {
  console.error("[DB] Unexpected error on idle client:", err);
  // Exit to trigger Railway's process restart — pool may be wedged
  process.exit(-1);
});

module.exports = pool;
