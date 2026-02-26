#!/usr/bin/env node
/**
 * Database Migration Script
 * 
 * Usage: node scripts/migrate.js
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env file
dotenv.config({ path: join(__dirname, '..', '.env') });

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  try {
    console.log('🔄 Running migrations...\n');

    // Get all migration files sorted by name
    const migrationsDir = join(__dirname, '..', 'database', 'migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${migrationFiles.length} migration files\n`);

    for (const file of migrationFiles) {
      console.log(`📄 Running: ${file}`);
      const sql = readFileSync(join(migrationsDir, file), 'utf-8');
      
      try {
        await pool.query(sql);
        console.log(`   ✅ Success\n`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`   ℹ️  Already exists, skipping\n`);
        } else {
          throw error;
        }
      }
    }
    
    console.log('✅ All migrations completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();

