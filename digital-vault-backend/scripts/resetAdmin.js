#!/usr/bin/env node
const crypto = require('crypto');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const db = require('../src/config/db');
const { resetOrCreateAdminUser } = require('../src/services/adminBootstrapService');

const DEFAULT_DEVELOPMENT_EMAIL = 'admin@amanat.com';

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

const generateStrongPassword = () => {
  const randomCore = crypto.randomBytes(18).toString('base64url');
  return `Amn!${randomCore}9@`;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const isProduction = process.env.NODE_ENV === 'production';
  const email = args.email
    || process.env.ADMIN_RECOVERY_EMAIL
    || process.env.ADMIN_BOOTSTRAP_EMAIL
    || (!isProduction ? DEFAULT_DEVELOPMENT_EMAIL : '');
  const password = args.password || process.env.ADMIN_RECOVERY_PASSWORD || generateStrongPassword();
  const secret = args.secret || process.env.ADMIN_BOOTSTRAP_SECRET;

  if (!email) {
    console.error('Usage: node scripts/resetAdmin.js --email you@example.com [--password "StrongPass!234"] [--secret your-bootstrap-secret]');
    process.exit(1);
  }

  try {
    await db.initializeDatabase();

    const result = await resetOrCreateAdminUser({
      email,
      password,
      secret,
      allowBlockedDefaultIdentifier: !isProduction,
    });

    const message = result.action === 'reset' ? 'Admin password reset' : 'Admin created';
    console.log(JSON.stringify({
      success: true,
      message,
      credentials: {
        email: result.admin?.email || email,
        password,
      },
      admin: result.admin,
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      message: error.message || 'Failed to recover admin access',
      details: error.details || null,
    }, null, 2));
    process.exit(1);
  } finally {
    await db.end().catch(() => null);
  }
};

main();
