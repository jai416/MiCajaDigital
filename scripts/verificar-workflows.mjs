/**
 * Valida el YAML de los workflows de .github/workflows/.
 *
 * Por qué existe: un workflow con YAML inválido NO PUEDE detectarlo él mismo
 * (GitHub crea un run rojo con 0 jobs y el error no aparece en la pestaña del
 * run). `admin-ci.yml` estuvo así desde 2026-08-22 por un `name:` con dos
 * puntos sin comillas: 46 runs rojos seguidos sin explicación visible.
 *
 * Uso:  node scripts/verificar-workflows.mjs
 * Sale con código 1 si algún workflow es inválido o no declara jobs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { load } from 'js-yaml';

const dir = path.join(process.cwd(), '.github', 'workflows');
const archivos = fs.existsSync(dir)
  ? fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).sort()
  : [];

if (archivos.length === 0) {
  console.log('No hay workflows en .github/workflows/ (nada que validar).');
  process.exit(0);
}

let fallas = 0;
for (const archivo of archivos) {
  const ruta = path.join(dir, archivo);
  try {
    const doc = load(fs.readFileSync(ruta, 'utf8'));
    // Ojo: en YAML 1.1 la clave `on:` se parsea como booleano `true`.
    const disparadores = doc.on ?? doc[true];
    const jobs = doc.jobs ?? {};
    const problemas = [];
    if (!doc || typeof doc !== 'object') problemas.push('no es un mapa YAML');
    if (!disparadores) problemas.push('sin `on:` (nunca se dispararía)');
    if (Object.keys(jobs).length === 0) problemas.push('sin jobs');
    for (const [nombre, job] of Object.entries(jobs)) {
      if (job && job.uses === undefined && job.steps === undefined) {
        problemas.push(`job "${nombre}" sin steps ni uses`);
      }
    }
    if (problemas.length) {
      fallas++;
      console.error(`✗ ${archivo}: ${problemas.join('; ')}`);
    } else {
      console.log(`✓ ${archivo} — jobs: ${Object.keys(jobs).join(', ')}`);
    }
  } catch (e) {
    fallas++;
    const detalle = String(e?.message ?? e).split('\n')[0];
    console.error(`✗ ${archivo}: YAML inválido -> ${detalle}`);
  }
}

if (fallas > 0) {
  console.error(`\n${fallas} workflow(s) con problemas.`);
  process.exit(1);
}
console.log(`\n${archivos.length} workflow(s) válidos.`);
