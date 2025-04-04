const { Pool } = require('pg');

// Create a new PostgreSQL connection pool.
// If DATABASE_URL is provided (common in production), it will be used.
// Otherwise, fall back to individual PG* environment variables with defaults.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // e.g., postgres://user:password@host:port/database
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'postgres'
});

const connectToDatabase = async () => {
  try {
    // Test the connection by running a simple query
    await pool.query('SELECT NOW()');
    console.log('Connected to database successfully');
  } catch (err) {
    console.error('Database connection error:', err);
    throw err;
  }
};

module.exports = { pool, connectToDatabase };
