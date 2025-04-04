const { Pool } = require('pg');

let poolConfig;

if (process.env.DATABASE_URL) {
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  };
} else {
  console.warn('DATABASE_URL environment variable is not set. Falling back to default connection settings.');
  poolConfig = {
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    database: process.env.PGDATABASE || 'postgres'
  };
}

const pool = new Pool(poolConfig);

const connectToDatabase = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('Connected to database successfully');
  } catch (err) {
    console.error('Database connection error:', err);
    throw err;
  }
};

module.exports = { pool, connectToDatabase };
