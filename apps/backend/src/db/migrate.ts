import { initializeDatabase } from './pgvector.js';

async function migrate() {
  try {
    console.log('Running database migrations...');
    await initializeDatabase();
    console.log('Migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
