import pg from 'pg';
const { Pool: PgPool } = pg;
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

const url = process.env.DATABASE_URL;
const isNeon = url.includes("neon.tech") || url.includes("neon.database");

export let pool: InstanceType<typeof PgPool> | NeonPool;
export let db: ReturnType<typeof pgDrizzle> | ReturnType<typeof neonDrizzle>;

if (isNeon) {
  neonConfig.webSocketConstructor = ws;
  const neonPool = new NeonPool({ connectionString: url });
  pool = neonPool as any;
  db = neonDrizzle({ client: neonPool, schema });
} else {
  const pgPool = new PgPool({ connectionString: url });
  pool = pgPool;
  db = pgDrizzle(pgPool, { schema });
}
