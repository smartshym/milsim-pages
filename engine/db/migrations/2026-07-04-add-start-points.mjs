// Миграция: добавить точки старта по сторонам (kind:'start', reveal:'always', со страницей).
// Идемпотентно — повторный прогон не дублирует. Правит локальный dumps/config.json.
//   node db.mjs pull config
//   node migrations/2026-07-04-add-start-points.mjs
//   node db.mjs push config
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(HERE, '..', 'dumps', 'config.json');
const cfg  = JSON.parse(fs.readFileSync(file, 'utf8'));
cfg.objectives = cfg.objectives || [];

const starts = [
  { id: 'start-coalition',  side: 'coalition',  kind: 'start', label: 'Старт', at: [43.799660, 77.052893], reveal: 'always' },
  { id: 'start-insurgents', side: 'insurgents', kind: 'start', label: 'Старт', at: [43.799155, 77.056268], reveal: 'always' }
];

const have = new Set(cfg.objectives.map(o => o.id));
let n = 0;
starts.forEach(function (s) { if (!have.has(s.id)) { cfg.objectives.push(s); n++; } });

fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
console.log('добавлено точек старта:', n, '| всего objectives:', cfg.objectives.length);
