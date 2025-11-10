import { PrismaClient } from '@prisma/client';
import pg from 'pg';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function addTitleColumn() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Add title column
    await client.query(`
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS title VARCHAR(255);
    `);

    console.log('✅ Successfully added title column to reports table');

    // Verify
    const result = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'reports' AND column_name = 'title';
    `);

    if (result.rows.length > 0) {
      console.log('✅ Verification successful:', result.rows[0]);
    } else {
      console.log('⚠️  Column not found after creation');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

addTitleColumn();

