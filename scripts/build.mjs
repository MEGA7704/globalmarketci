import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const assetsDir = path.join(publicDir, 'assets');
const indexPath = path.join(publicDir, 'index.html');

const assetSources = [
  { base: 'style', ext: 'css', tag: 'style' },
  { base: 'style-sales', ext: 'css', tag: 'style' },
  { base: 'style-admin', ext: 'css', tag: 'style' },
  { base: 'app', ext: 'js', tag: 'script' },
  { base: 'app-sales', ext: 'js', tag: 'script' },
  { base: 'app-admin', ext: 'js', tag: 'script' },
  { base: 'app-bootstrap', ext: 'js', tag: 'script' }
];

function fail(message) {
  console.error(`[build] ${message}`);
  process.exit(1);
}

for (const asset of assetSources) {
  asset.source = path.join(assetsDir, `${asset.base}.${asset.ext}`);
  if (!fs.existsSync(asset.source)) fail(`Fichier introuvable : ${path.relative(root, asset.source)}`);
}
if (!fs.existsSync(indexPath)) fail('Fichier public/index.html introuvable.');

const hash = crypto.createHash('sha256');
for (const asset of assetSources) hash.update(fs.readFileSync(asset.source));
const digest = hash.digest('hex').slice(0, 12);
const now = new Date();
const buildDate = now.toISOString().slice(0, 10).replaceAll('-', '.');
const buildId = `${buildDate}-${digest}`;

for (const name of fs.readdirSync(assetsDir)) {
  if (/^(?:app|app-sales|app-admin|app-bootstrap|style|style-sales|style-admin)\.[a-f0-9]{12}\.(?:js|css)$/.test(name)) {
    fs.rmSync(path.join(assetsDir, name), { force: true });
  }
}

for (const asset of assetSources) {
  asset.outputName = `${asset.base}.${digest}.${asset.ext}`;
  fs.copyFileSync(asset.source, path.join(assetsDir, asset.outputName));
}

fs.writeFileSync(
  path.join(assetsDir, 'build-version.js'),
  `window.GLOBAL_MARKET_BUILD=${JSON.stringify(buildId)};\n`,
  'utf8'
);

fs.writeFileSync(
  path.join(publicDir, 'version.json'),
  `${JSON.stringify({
    app: 'GLOBAL MARKET',
    version: '4.4.0',
    storageVersion: 7,
    build: buildId,
    generatedAt: now.toISOString(),
    outputDirectory: 'public',
    modules: assetSources.map(asset => asset.outputName)
  }, null, 2)}\n`,
  'utf8'
);

const styleTags = assetSources
  .filter(asset => asset.tag === 'style')
  .map(asset => `<link rel="stylesheet" href="assets/${asset.outputName}" />`)
  .join('\n');
const scriptTags = [
  '<script src="assets/build-version.js"></script>',
  ...assetSources.filter(asset => asset.tag === 'script').map(asset => `<script src="assets/${asset.outputName}"></script>`)
].join('\n');

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>GLOBAL MARKET — Multi-Entreprises | MEGA SERVICES DIABO</title>
${styleTags}
</head>
<body>
<div id="app"></div>
${scriptTags}
</body>
</html>\n`;
fs.writeFileSync(indexPath, html, 'utf8');

console.log(`[build] GLOBAL MARKET ${buildId}`);
console.log('[build] Répertoire de sortie : public');
for (const asset of assetSources) console.log(`[build] ${asset.ext.toUpperCase()} : assets/${asset.outputName}`);
console.log('[build] Construction terminée avec succès.');
