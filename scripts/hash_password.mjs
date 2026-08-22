// Genera el hash scrypt para ADMIN_PASSWORD_HASH del panel admin.
// Uso:  node scripts/hash_password.mjs "tu_contraseña"
// Salida: scrypt:N:r:p:salt_hex:hash_hex  (pegarla en .env.local)
// OJO: separadores ':' (no '$'): @next/env expande "$VAR" en .env y corrompería el hash.
import { scryptSync, randomBytes } from 'crypto';

const password = process.argv[2];
if (!password) {
  console.error('Uso: node scripts/hash_password.mjs "tu_contraseña"');
  process.exit(1);
}

const N = 16384;
const r = 8;
const p = 1;
const keylen = 64;
const salt = randomBytes(16);

const hash = scryptSync(password, salt, keylen, { N, r, p }).toString('hex');
console.log(`scrypt:${N}:${r}:${p}:${salt.toString('hex')}:${hash}`);
