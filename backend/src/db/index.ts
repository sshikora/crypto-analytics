import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema/crypto';

const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/crypto_analytics';

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
