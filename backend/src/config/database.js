const { Pool } = require('pg');

let poolConfig;

if (process.env.NODE_ENV === 'production') {
  // In production, require DATABASE_URL to be set.
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable must be set in production.');
  }
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    // For many production environments (like Heroku, Render), SSL is required:
    ssl: { rejectUnauthorized: false }
  };
} else {
  // In development, use DATABASE_URL if set; otherwise, fallback to localhost.
  poolConfig = {
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:@localhost:5432/postgres'
  };
}

const pool = new Pool(poolConfig);

const connectToDatabase = async () => {
  try {
    // Test the connection by running a simple query.
    await pool.query('SELECT NOW()');
    console.log('Connected to database successfully');
  } catch (err) {
    console.error('Database connection error:', err);
    throw err;
  }
};

module.exports = { pool, connectToDatabase };
