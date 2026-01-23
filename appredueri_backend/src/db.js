const { Pool } = require("pg");
require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway și alți provideri cloud cer SSL
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  // Connection pool settings
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Log connection status
pool.on("connect", () => {
  if (!isProduction) {
    console.log("[DB] Connected to PostgreSQL");
  }
});

pool.on("error", (err) => {
  console.error("[DB] Unexpected error on idle client:", err);
});

module.exports = pool;
