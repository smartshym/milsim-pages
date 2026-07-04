// Миграция: цепочка навигации на старте.
//   QR-1 «к старту» (guide) — раздатка после брифинга: ведёт к старту, флагом 'brief' раскрывает старт на карте.
//   Старт (QR-2) — виден после QR-1; открытие пишет захват старта → появляется первая точка; страница ведёт к ней.
// Идемпотентно. Правит локальный dumps/config.json.
//   node db.mjs pull config
//   node migrations/2026-07-04-start-nav-chain.mjs
//   node db.mjs push config
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(HERE, '..', 'dumps', 'config.json');
const cfg  = JSON.parse(fs.readFileSync(file, 'utf8'));
cfg.objectives = cfg.objectives || [];
const FLAG = 'brief';

let starts = 0, guides = 0;
Object.keys(cfg.sides || {}).forEach(function (sk) {
  const start = cfg.objectives.find(o => o.kind === 'start' && o.side === sk);
  const first = cfg.objectives.find(o => (o.kind === 'checkpoint' || o.kind === 'terminal') && o.side === sk && o.n === 1);
  if (start) {
    start.reveal = { flag: FLAG, scope: 'side' };   // виден только после QR-1
    start.onOpen = { event: 'capture' };            // скан старта → захват → откроется первая точка
    if (first) start.leadsTo = first.id;            // страница старта ведёт к первой точке
    delete start.decoy; delete start.fragment;      // на случай мусора
    starts++;
  }
  // QR-1 «к старту» (раздатка) — ведёт к старту, флагом раскрывает старт на карте
  const gid = 'to-' + (start ? start.id : ('start-' + sk));
  if (start && !cfg.objectives.some(o => o.id === gid)) {
    cfg.objectives.push({
      id: gid, side: sk, kind: 'guide', label: 'К старту',
      at: start.at.slice(), leadsTo: start.id,
      reveal: 'always', onOpen: { event: 'flag', flag: FLAG }
    });
    guides++;
  }
});

fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
console.log('старт переделан:', starts, '| добавлено guide «к старту»:', guides, '| всего objectives:', cfg.objectives.length);
