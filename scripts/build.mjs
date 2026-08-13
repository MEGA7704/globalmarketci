import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const assetsDir = path.join(publicDir, 'assets');
const appSource = path.join(assetsDir, 'app.js');
const styleSource = path.join(assetsDir, 'style.css');
const indexPath = path.join(publicDir, 'index.html');

function fail(message) {
  console.error(`[build] ${message}`);
  process.exit(1);
}

for (const file of [appSource, styleSource, indexPath]) {
  if (!fs.existsSync(file)) fail(`Fichier introuvable : ${path.relative(root, file)}`);
}

const app = fs.readFileSync(appSource);
const style = fs.readFileSync(styleSource);
const digest = crypto.createHash('sha256').update(app).update(style).digest('hex').slice(0, 12);
const now = new Date();
const buildDate = now.toISOString().slice(0, 10).replaceAll('-', '.');
const buildId = `${buildDate}-${digest}`;
const appName = `app.${digest}.js`;
const styleName = `style.${digest}.css`;

for (const name of fs.readdirSync(assetsDir)) {
  if (/^(app|style)\.[a-f0-9]{12}\.(js|css)$/.test(name)) {
    fs.rmSync(path.join(assetsDir, name), { force: true });
  }
}

fs.copyFileSync(appSource, path.join(assetsDir, appName));
fs.copyFileSync(styleSource, path.join(assetsDir, styleName));
fs.writeFileSync(
  path.join(assetsDir, 'build-version.js'),
  `window.GLOBAL_MARKET_BUILD=${JSON.stringify(buildId)};\n`,
  'utf8'
);
fs.writeFileSync(
  path.join(publicDir, 'version.json'),
  `${JSON.stringify({
    app: 'GLOBAL MARKET',
    version: '4.9.0',
    build: buildId,
    generatedAt: now.toISOString(),
    outputDirectory: 'public'
  }, null, 2)}\n`,
  'utf8'
);

let html = fs.readFileSync(indexPath, 'utf8');
html = html
  .replace(/assets\/style(?:\.[a-f0-9]{12})?\.css(?:\?[^"']*)?/g, `assets/${styleName}`)
  .replace(/assets\/app(?:\.[a-f0-9]{12})?\.js(?:\?[^"']*)?/g, `assets/${appName}`)
  .replace(/\s*<script src="assets\/build-version\.js"><\/script>/g, '');

const appScript = `<script src="assets/${appName}"></script>`;
if (!html.includes(appScript)) fail('La balise du fichier app.js est introuvable dans public/index.html.');
html = html.replace(
  appScript,
  `<script src="assets/build-version.js"></script>\n${appScript}`
);

fs.writeFileSync(indexPath, html, 'utf8');

console.log(`[build] GLOBAL MARKET ${buildId}`);
console.log(`[build] Répertoire de sortie : public`);
console.log(`[build] CSS : assets/${styleName}`);
console.log(`[build] JS  : assets/${appName}`);
console.log('[build] Construction terminée avec succès.');
