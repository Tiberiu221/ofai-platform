/**
 * Script pentru rularea migration-ului în production
 * Usage: node scripts/run-migration-production.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runMigration() {
  console.log('🚀 Starting migration in production...\n');
  
  // Check DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL not found in .env');
    console.log('   Set it to your PRODUCTION database URL');
    process.exit(1);
  }
  
  console.log(`📦 Database: ${process.env.DATABASE_URL.split('@')[1]}\n`);
  
  // Confirm
  console.log('⚠️  WARNING: This will run migration in PRODUCTION database!');
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Read migration file
  const migrationPath = path.join(__dirname, '..', 'migrations', 'create_review_summaries.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('📄 Migration file loaded\n');
  
  // Connect to production DB
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔌 Connecting to database...');
    await pool.query('SELECT NOW()');
    console.log('✅ Connected!\n');
    
    // Run migration
    console.log('⚙️  Running migration...');
    await pool.query(sql);
    console.log('✅ Migration executed successfully!\n');
    
    // Verify
    console.log('🔍 Verifying table...');
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'review_summaries'
      ORDER BY ordinal_position
    `);
    
    if (result.rows.length === 0) {
      throw new Error('Table review_summaries not found after migration!');
    }
    
    console.log('✅ Table verified! Columns:');
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });
    
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
