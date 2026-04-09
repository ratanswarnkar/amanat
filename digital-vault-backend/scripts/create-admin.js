#!/usr/bin/env node
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const db = require('../src/config/db');
const { createAdminUser } = require('../src/services/adminBootstrapService');

const parseArgs = (argv) => {
  const values = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (!current.startsWith('--')) {
      continue;
    }

    const [rawKey, inlineValue] = current.slice(2).split('=');
    const nextValue = inlineValue !== undefined ? inlineValue : argv[index + 1];
    values[rawKey] = nextValue;

    if (inlineValue === undefined) {
      index += 1;
    }
  }

  return values;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const email = args.email || process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = args.password || process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const secret = args.secret || process.env.ADMIN_BOOTSTRAP_SECRET;

  if (!email || !password) {
    console.error('Usage: node scripts/create-admin.js --email you@example.com --password "StrongPass!234" [--secret your-bootstrap-secret]');
    process.exit(1);
  }

  try {
    await db.initializeDatabase();

    const adminUser = await createAdminUser({ email, password, secret });

    console.log(JSON.stringify({
      success: true,
      message: 'Admin user created successfully',
      admin: adminUser,
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      message: error.message || 'Failed to create admin user',
      details: error.details || null,
    }, null, 2));
    process.exit(1);
  } finally {
    await db.end().catch(() => null);
  }
};

main();
