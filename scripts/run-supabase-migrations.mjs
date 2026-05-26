#!/usr/bin/env node
/**
 * CLI: npm run db:migrate
 * Requiere SUPABASE_DB_URL o SUPABASE_DB_PASSWORD en .env
 */
import dotenv from "dotenv";
import { createRequire } from "module";

dotenv.config();

const require = createRequire(import.meta.url);
const { runSupabaseMigrations } = require("./supabase-migrate.js");

runSupabaseMigrations()
  .then((out) => {
    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
