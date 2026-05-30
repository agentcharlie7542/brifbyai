// 첫 관리자(또는 임의 유저) 계정 생성. 멱등: 같은 이메일이 있으면 비밀번호·역할만 갱신.
// 사용:
//   node --env-file=.env.local scripts/seed-admin.mjs <email> <password> [role]
//   role 기본값 admin (admin|editor|viewer)
import { neon } from '@neondatabase/serverless';
import { scrypt as _scrypt, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(_scrypt);

const connectionString =
  process.env.POSTGRES_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('POSTGRES_DATABASE_URL 가 설정되지 않았습니다 (.env.local).');
  process.exit(1);
}

const [, , emailArg, passwordArg, roleArg] = process.argv;
const email = (emailArg || '').toLowerCase().trim();
const password = passwordArg || '';
const role = roleArg || 'admin';

if (!email || !password) {
  console.error(
    '사용법: node --env-file=.env.local scripts/seed-admin.mjs <email> <password> [admin|editor|viewer]'
  );
  process.exit(1);
}
if (!['admin', 'editor', 'viewer'].includes(role)) {
  console.error(`role 은 admin|editor|viewer 중 하나여야 합니다 (입력: ${role})`);
  process.exit(1);
}

async function hashPassword(plain) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(plain, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}

const sql = neon(connectionString);
const passwordHash = await hashPassword(password);

const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
if (existing.length > 0) {
  await sql`
    UPDATE users
    SET password_hash = ${passwordHash}, role = ${role}, is_active = true
    WHERE email = ${email}
  `;
  console.log(`✓ updated: ${email} (role=${role})`);
} else {
  await sql`
    INSERT INTO users (email, role, password_hash, is_active)
    VALUES (${email}, ${role}, ${passwordHash}, true)
  `;
  console.log(`✓ created: ${email} (role=${role})`);
}
console.log('done.');
