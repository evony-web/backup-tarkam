#!/usr/bin/env node
/**
 * Prisma Provider Switcher for Dual-Environment Setup
 * 
 * Architecture:
 *   - Schema is ALWAYS committed as "postgresql" (for Vercel/Neon)
 *   - This script temporarily switches to the target provider, generates
 *     the Prisma client, then RESTORES the schema back to "postgresql"
 *   - Local dev uses SQLite (DATABASE_URL=file:...) with SQLite-generated client
 *   - Vercel uses PostgreSQL (DATABASE_URL=postgresql://...) with PG-generated client
 * 
 * Usage:
 *   node scripts/switch-provider.mjs sqlite     → generate SQLite client for local dev
 *   node scripts/switch-provider.mjs postgresql → generate PostgreSQL client for Vercel
 *   node scripts/switch-provider.mjs status     → show current provider
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(__dirname, '../prisma/schema.prisma');
const DEFAULT_PROVIDER = 'postgresql'; // Always restore to this after generate

function getCurrentProvider() {
  const schema = readFileSync(SCHEMA_PATH, 'utf-8');
  const match = schema.match(/provider\s*=\s*"(\w+)"/);
  return match ? match[1] : null;
}

function setProvider(target) {
  let schema = readFileSync(SCHEMA_PATH, 'utf-8');
  
  if (target === 'sqlite') {
    // Switch provider to sqlite and remove directUrl (SQLite doesn't support it)
    schema = schema.replace(/provider\s*=\s*"\w+"/, `provider = "sqlite"`);
    // Remove directUrl line entirely for SQLite
    schema = schema.replace(/\n\s*directUrl\s*=\s*env\("[^"]*"\)/, '');
  } else {
    // Switch provider to postgresql
    schema = schema.replace(/provider\s*=\s*"\w+"/, `provider = "postgresql"`);
    // Add directUrl back if not present
    if (!schema.includes('directUrl')) {
      schema = schema.replace(
        /(url\s*=\s*env\("DATABASE_URL"\))/,
        `$1\n  directUrl = env("DIRECT_URL")`
      );
    }
  }
  
  writeFileSync(SCHEMA_PATH, schema, 'utf-8');
}

function runGenerate() {
  console.log('🔄 Running prisma generate...');
  try {
    execSync('npx prisma generate', { stdio: 'inherit', cwd: resolve(__dirname, '..') });
    console.log('✅ Prisma client generated successfully');
  } catch (e) {
    console.error('❌ prisma generate failed');
    process.exit(1);
  }
}

// ─── Main ───
const command = process.argv[2];

if (!command) {
  console.log('Usage: node scripts/switch-provider.mjs <sqlite|postgresql|status>');
  process.exit(1);
}

if (command === 'status') {
  const current = getCurrentProvider();
  console.log(`Current provider: "${current}" (committed default: "${DEFAULT_PROVIDER}")`);
  process.exit(0);
}

if (command === 'sqlite' || command === 'postgresql') {
  const current = getCurrentProvider();
  
  // Step 1: Switch to target provider
  if (current !== command) {
    setProvider(command);
    console.log(`📝 Provider switched: "${current}" → "${command}"`);
  } else {
    console.log(`✅ Provider already set to "${command}"`);
  }
  
  // Step 2: Generate Prisma client
  runGenerate();
  
  // Step 3: RESTORE schema back to default (postgresql) 
  // This ensures the committed schema always says "postgresql" for Vercel
  const afterGenerate = getCurrentProvider();
  if (afterGenerate !== DEFAULT_PROVIDER) {
    setProvider(DEFAULT_PROVIDER);
    console.log(`🔄 Schema restored to "${DEFAULT_PROVIDER}" (committed default)`);
  }
  
  console.log(`\n📦 Prisma client generated for: ${command}`);
  console.log(`📄 Schema file restored to: ${DEFAULT_PROVIDER}`);
  process.exit(0);
}

console.log(`Unknown command: "${command}". Use sqlite, postgresql, or status.`);
process.exit(1);
