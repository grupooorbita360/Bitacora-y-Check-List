'use strict';
/**
 * Genera apps-script/dist-gas/ — un directorio PLANO (sin subcarpetas) con
 * todo lo que hay que subir a Apps Script: src/*.js + html/*.html +
 * appsscript.json, todos al mismo nivel.
 *
 * Por qué existe: Apps Script (y `clasp push`) identifican cada archivo
 * por su nombre completo, y si se sube con `rootDir` apuntando a la raíz
 * de apps-script/ (que tiene src/ y html/ como subcarpetas), clasp
 * preserva esa subcarpeta como parte del nombre — el HTML de
 * `html/Index.html` termina llamándose "html/Index" adentro de Apps
 * Script, no "Index". Pero el código (`src/99_WebApp.js`, `Index.html`)
 * llama `createTemplateFromFile('Index')` / `include('Styles')` SIN esa
 * subcarpeta, así que Apps Script tira "No se encontró el archivo HTML
 * llamado Index".
 *
 * La corrección permanente es esta: en vez de subir src/+html/ tal cual
 * (con su subcarpeta), generar un directorio plano donde todo vive al
 * mismo nivel — exactamente como luce un proyecto de Apps Script por
 * dentro — y apuntar `clasp`/la copia manual a ESE directorio, nunca a
 * apps-script/ directamente. Así ni `clasp push` ni copiar a mano archivo
 * por archivo pueden volver a introducir un prefijo de carpeta.
 *
 * Uso: node scripts/build-gas.js  (o `npm run build:gas`)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist-gas');
const SRC_DIR = path.join(ROOT, 'src');
const HTML_DIR = path.join(ROOT, 'html');
const MANIFEST = path.join(ROOT, 'appsscript.json');

function emptyDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

function copyFlat(srcDir, extension) {
  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith(extension));
  files.forEach((f) => {
    fs.copyFileSync(path.join(srcDir, f), path.join(OUT_DIR, f));
  });
  return files;
}

function build() {
  emptyDir(OUT_DIR);

  const jsFiles = copyFlat(SRC_DIR, '.js');
  const htmlFiles = copyFlat(HTML_DIR, '.html');
  fs.copyFileSync(MANIFEST, path.join(OUT_DIR, 'appsscript.json'));

  return { outDir: OUT_DIR, jsFiles: jsFiles, htmlFiles: htmlFiles };
}

if (require.main === module) {
  const result = build();
  console.log(
    'Generado ' + result.outDir + ' (' + result.jsFiles.length + ' .js + ' +
      result.htmlFiles.length + ' .html + appsscript.json), listo para clasp push o copia manual.'
  );
}

module.exports = { build: build, OUT_DIR: OUT_DIR, SRC_DIR: SRC_DIR, HTML_DIR: HTML_DIR };
