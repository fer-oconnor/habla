// Reescritura mecánica de versiones: evita que un navegador conserve el editor anterior.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('public/js');
function update(file) {
  const text = fs.readFileSync(file,'utf8');
  const next = text.replace(/\?v=(?:programming20261002|cloud20261003|review20261003|creator20261003)/g, '?v=studio20261003');
  if (text !== next) fs.writeFileSync(file,next);
}
function walk(dir) {
  for (const item of fs.readdirSync(dir,{withFileTypes:true})) {
    const file = path.join(dir,item.name);
    if (item.isDirectory()) walk(file);
    else if (/\.(?:js|cjs|mjs)$/.test(item.name)) update(file);
  }
}
walk(root);
walk(path.resolve('scripts'));
update(path.resolve('app/habla.tsx'));
update(path.resolve('app/layout.tsx'));
console.log('Versiones de recursos actualizadas.');
