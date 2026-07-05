// Миграция: каждой разведточке проставить leadsTo → следующая точка (по номеру, своя сторона).
// c1→c2 … c6→c7(терминал); p-аналогично. Терминалы leadsTo не получают (конец цепочки).
//   node db.mjs pull points
//   node migrations/2026-07-06-checkpoints-leadsto.mjs
//   node db.mjs push points
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(HERE, '..', 'dumps', 'points.json');
const points = JSON.parse(fs.readFileSync(file, 'utf8'));
const entries = Object.entries(points);

let n = 0;
entries.forEach(function ([id, p]) {
  if (p.kind === 'checkpoint' && p.n != null) {
    const next = entries.find(function ([nid, np]) {
      return np.side === p.side && (np.kind === 'checkpoint' || np.kind === 'terminal') && np.n === p.n + 1;
    });
    if (next) { p.leadsTo = next[0]; n++; }
  }
});

fs.writeFileSync(file, JSON.stringify(points, null, 2));
console.log('leadsTo проставлено чекпоинтам:', n);
