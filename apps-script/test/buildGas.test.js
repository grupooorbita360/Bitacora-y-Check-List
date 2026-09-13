'use strict';
/**
 * Este es el chequeo que SÍ habría detectado el bug real de despliegue:
 * `clasp push` con rootDir en la raíz de apps-script/ subía html/Index.html
 * como archivo "html/Index" dentro de Apps Script, pero el código llama
 * createTemplateFromFile('Index')/include('Styles') sin el prefijo —
 * Apps Script tiraba "No se encontró el archivo HTML llamado Index".
 *
 * htmlReferences.test.js valida el código fuente (src/ + html/ tal cual
 * viven en el repo); este archivo valida el ARTEFACTO PLANO que
 * build-gas.js genera (apps-script/dist-gas/, lo que de verdad se sube
 * con clasp push o se copia a mano) — que es donde el bug real vivía.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build, OUT_DIR, SRC_DIR, HTML_DIR } = require('../scripts/build-gas');

const REFERENCE_PATTERN = /(?:include|createTemplateFromFile)\(\s*'([^']+)'\s*\)/g;

function findReferencedHtmlNames() {
  const names = new Set();
  const webAppSrc = fs.readFileSync(path.join(SRC_DIR, '99_WebApp.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(HTML_DIR, 'Index.html'), 'utf8');
  [webAppSrc, indexHtml].forEach((content) => {
    let match;
    while ((match = REFERENCE_PATTERN.exec(content)) !== null) {
      names.add(match[1]);
    }
  });
  return Array.from(names);
}

test('build-gas: genera un directorio plano, sin subcarpetas, con appsscript.json', () => {
  const result = build();

  assert.ok(result.jsFiles.length > 0);
  assert.ok(result.htmlFiles.length > 0);

  const outEntries = fs.readdirSync(OUT_DIR);
  outEntries.forEach((entry) => {
    const isDirectory = fs.statSync(path.join(OUT_DIR, entry)).isDirectory();
    assert.equal(isDirectory, false, entry + ' no debería ser una carpeta — Apps Script no tiene subcarpetas, y clasp preserva cualquiera como parte del nombre del archivo.');
  });

  assert.ok(outEntries.includes('appsscript.json'));
  assert.ok(outEntries.includes('99_WebApp.js'));
});

test('build-gas: cada nombre que include()/createTemplateFromFile() referencia existe en dist-gas/ SIN prefijo (el bug real)', () => {
  build();
  const referencedNames = findReferencedHtmlNames();
  assert.ok(referencedNames.length > 0, 'se esperaba encontrar Index, Styles y los Client_*');

  referencedNames.forEach((name) => {
    const flatPath = path.join(OUT_DIR, name + '.html');
    assert.ok(
      fs.existsSync(flatPath),
      'Apps Script buscaría "' + name + '" y no lo encontraría — falta ' + flatPath +
        ' (si esto falla, algo volvió a introducir una subcarpeta en el artefacto de despliegue)'
    );

    // La forma exacta del bug reportado: el archivo NO debe existir bajo
    // un prefijo de carpeta tipo "html/<nombre>.html" dentro del artefacto
    // (dist-gas es plano, así que esto es sobre todo documentación viva
    // del caso que rompió el deploy — clasp jamás debería recibir una
    // carpeta "html" adentro de rootDir).
    const wronglyPrefixedPath = path.join(OUT_DIR, 'html', name + '.html');
    assert.equal(fs.existsSync(wronglyPrefixedPath), false);
  });
});
