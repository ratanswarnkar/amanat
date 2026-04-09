const { Pool } = require('pg');

let pool;

const connectDB = async () => {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: Number(process.env.DB_PORT || 5432),
    });
  }

  try {
    const client = await pool.connect();
    console.log('Database connected ✅');
    client.release();
  } catch (error) {
    console.error('Database connection failed', error.message);
  }
};

const getPool = () => {
  if (!pool) {
    throw new Error('Database pool has not been initialized');
  }

  return pool;
};

module.exports = connectDB;
module.exports.getPool = getPool;
