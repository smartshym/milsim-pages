// Миграция: картинка полигона переехала из легаси sandtorch/ в engine/.
// geo.image: '../sandtorch/Boloto_v1.05.jpg' → 'Boloto_v1.05.jpg' (относительно страниц движка).
//   node db.mjs pull settings
//   node migrations/2026-07-06-image-into-engine.mjs
//   node db.mjs push settings
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(HERE, '..', 'dumps', 'settings.json');
const settings = JSON.parse(fs.readFileSync(file, 'utf8'));

const before = settings.geo && settings.geo.image;
if (settings.geo && /(^|\/)sandtorch\/Boloto_v1\.05\.jpg$/.test(String(before))) {
  settings.geo.image = 'Boloto_v1.05.jpg';
  fs.writeFileSync(file, JSON.stringify(settings, null, 2));
  console.log('geo.image:', before, '→', settings.geo.image);
} else {
  console.log('geo.image не трогаю (уже:', before, ')');
}
