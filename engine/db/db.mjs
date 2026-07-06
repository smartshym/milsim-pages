// ============================================================================
//  db.mjs — экспорт/импорт Firebase RTDB через REST (test-mode: без токена).
//  Запуск (из папки engine/db):
//    node db.mjs pull <node> [file]            # БД  → dumps/<node>.json
//    node db.mjs push <node> [file]            # dumps/<node>.json → БД (PUT — замена узла)
//    node db.mjs backup [метка]                # ВЕСЬ прогон → dumps/backups/<метка>-<время>.json
//    node db.mjs restore <файл>                # ВЕСЬ прогон ← файл (PUT — замена состояния)
//    node db.mjs wipe [node=.]                 # DELETE узла (обнулить прогон/конфиг)
//    node — подпуть под game/<run>. '.' = весь прогон. Конфиг: settings | coords | points. Ещё: flags | captures | …
//
//  Миграция (безопасно, с бэкапом):
//    node db.mjs pull points            # выгрузить узел (points/settings/coords)
//    node migrations/<миграция>.mjs     # преобразовать dumps/points.json
//    node db.mjs push points            # залить обратно
//  Снять/вернуть состояние прогона (config + captures + events + …):
//    node db.mjs backup preigra         # снимок перед игрой
//    node db.mjs restore dumps/backups/preigra-2026-07-03T....json
//  ⚠️ Когда закроем Firebase правилами — REST-запись потребует токен (сейчас открыто).
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://milsim-pages-default-rtdb.europe-west1.firebasedatabase.app';
const RUN  = 'sandtorch';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DUMPS = path.join(HERE, 'dumps');
const BACKUPS = path.join(DUMPS, 'backups');

function loc(node){ const sub = (node === '.' || node === '') ? '' : '/' + node;
  return { url: `${BASE}/game/${RUN}${sub}.json`, label: `game/${RUN}${sub}` }; }
function rel(p){ return path.relative(process.cwd(), p) || p; }

async function pull(node, outfile){
  const { url, label } = loc(node);
  const r = await fetch(url);
  if (!r.ok) throw new Error('pull failed ' + r.status);
  const data = await r.json();
  fs.mkdirSync(path.dirname(outfile), { recursive: true });
  fs.writeFileSync(outfile, JSON.stringify(data, null, 2));
  console.log('pulled  %s  →  %s', label, rel(outfile));
}
async function push(node, infile){
  const { url, label } = loc(node);
  const body = fs.readFileSync(infile, 'utf8');
  JSON.parse(body); // валидация JSON перед заливкой
  const r = await fetch(url, { method: 'PUT', body, headers: { 'Content-Type': 'application/json' } });
  if (!r.ok) throw new Error('push failed ' + r.status + ' ' + await r.text());
  console.log('pushed  %s  →  %s  (%s)', rel(infile), label, r.status);
}

const [cmd, a1, a2] = process.argv.slice(2);
const dumpName = (node) => (node === '.' || node === '' ? 'run' : node.replace(/\//g, '_')) + '.json';

if (cmd === 'pull') {
  if (!a1) throw new Error('pull: укажи узел — settings | coords | points | . | flags | …');
  await pull(a1, a2 || path.join(DUMPS, dumpName(a1)));
} else if (cmd === 'push') {
  if (!a1) throw new Error('push: укажи узел — settings | coords | points | .');
  await push(a1, a2 || path.join(DUMPS, dumpName(a1)));
} else if (cmd === 'backup') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);   // 2026-07-03T21-40-05
  const fileName = (a1 ? a1 + '-' : '') + stamp + '.json';
  await pull('.', path.join(BACKUPS, fileName));
} else if (cmd === 'restore') {
  if (!a1) throw new Error('restore: укажи файл бэкапа, напр. dumps/backups/<...>.json');
  await push('.', path.isAbsolute(a1) ? a1 : path.resolve(process.cwd(), a1));
} else if (cmd === 'wipe') {
  const node = a1 || '.';                       // по умолчанию весь прогон
  const { url, label } = loc(node);
  const r = await fetch(url, { method: 'DELETE' });
  if (!r.ok) throw new Error('wipe failed ' + r.status);
  console.log('wiped   %s  (сделай backup заранее — восстановление через restore)', label);
} else {
  console.log('usage:\n'
    + '  node db.mjs pull|push <node> [file]          (node: settings | coords | points | . | flags | …)\n'
    + '  node db.mjs backup [метка]                   # весь прогон → dumps/backups/\n'
    + '  node db.mjs restore <файл>                   # весь прогон ← файл (замена)\n'
    + '  node db.mjs wipe [node=.]                     # удалить узел (обнулить прогон)');
}
