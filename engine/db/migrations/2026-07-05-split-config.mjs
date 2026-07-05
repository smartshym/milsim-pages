// Миграция: единый game/<run>/config → settings + coords + points (структура адаптера в state.js).
// Порядок:
//   node db.mjs pull config
//   node migrations/2026-07-05-split-config.mjs        → пишет dumps/{settings,coords,points}.json
//   node db.mjs push settings && push coords && push points
//   node db.mjs wipe config                            → убрать старый узел (бэкап уже снят)
// Логика дедупа координат идентична state.js toStructure — одна координата под несколько точек.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dump = p => path.join(HERE, '..', 'dumps', p);
const cfg = JSON.parse(fs.readFileSync(dump('config.json'), 'utf8'));

const settings = { sides: cfg.sides, shared: cfg.shared, geo: cfg.geo, mechanics: cfg.mechanics };
const coords = {}, points = {}, byKey = {}; let n = 0;
(cfg.objectives || []).forEach(function (o) {
  const p = {}; for (const k in o) if (k !== 'id' && k !== 'at' && k !== 'coord') p[k] = o[k];
  if (o.at && o.at[0] != null) {
    const key = (+o.at[0]).toFixed(6) + ',' + (+o.at[1]).toFixed(6);
    if (!byKey[key]) { byKey[key] = 'coord' + (++n); coords[byKey[key]] = { label: (o.label || o.id || byKey[key]), lat: +o.at[0], lng: +o.at[1] }; }
    p.coord = byKey[key];
  }
  points[o.id] = p;
});

fs.writeFileSync(dump('settings.json'), JSON.stringify(settings, null, 2));
fs.writeFileSync(dump('coords.json'), JSON.stringify(coords, null, 2));
fs.writeFileSync(dump('points.json'), JSON.stringify(points, null, 2));
console.log('готово → координат:', Object.keys(coords).length, '| точек:', Object.keys(points).length);
