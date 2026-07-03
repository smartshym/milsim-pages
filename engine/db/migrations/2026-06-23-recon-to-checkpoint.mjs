// Миграция: в config переименовать objectives[].kind 'recon' → 'checkpoint'.
// Правит локальный дамп dumps/config.json (не трогает БД напрямую).
//   node db.mjs pull config
//   node migrations/2026-06-23-recon-to-checkpoint.mjs
//   node db.mjs push config
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(HERE, '..', 'dumps', 'config.json');
const cfg  = JSON.parse(fs.readFileSync(file, 'utf8'));

let n = 0;
(cfg.objectives || []).forEach(function (o) { if (o.kind === 'recon') { o.kind = 'checkpoint'; n++; } });

fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
console.log('recon → checkpoint:', n, 'объектов обновлено в', path.basename(file));
