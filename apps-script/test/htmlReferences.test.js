'use strict';
/**
 * Chequeo estático (sin cargar nada en el vm.Context): todo nombre pasado
 * a include(...)/createTemplateFromFile(...)/createHtmlOutputFromFile(...)
 * en el código fuente debe corresponder a un archivo real en
 * apps-script/html/. No habría atrapado por sí solo el bug de despliegue
 * de docs/09-deploy-clasp.md (ese era un problema del ARTEFACTO subido,
 * no del código fuente — para eso está buildGas.test.js), pero sí
 * cualquier typo o referencia a un archivo que nunca existió.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const HTML_DIR = path.join(ROOT, 'html');
const REFERENCE_PATTERN = /(?:include|createTemplateFromFile|createHtmlOutputFromFile)\(\s*'([^']+)'\s*\)/g;

function findHtmlReferences() {
  const filesToScan = fs
    .readdirSync(SRC_DIR)
    .filter((f) => f.endsWith('.js'))
    .map((f) => path.join(SRC_DIR, f))
    .concat(
      fs
        .readdirSync(HTML_DIR)
        .filter((f) => f.endsWith('.html'))
        .map((f) => path.join(HTML_DIR, f))
    );

  const references = [];
  filesToScan.forEach((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    let match;
    while ((match = REFERENCE_PATTERN.exec(content)) !== null) {
      references.push({ name: match[1], file: path.relative(ROOT, filePath) });
    }
  });
  return references;
}

test('toda referencia a include()/createTemplateFromFile()/createHtmlOutputFromFile() apunta a un archivo real en apps-script/html/', () => {
  const references = findHtmlReferences();

  // Si esto llega a dar 0, o el regex se rompió o alguien borró todas las
  // llamadas — cualquiera de las dos es una señal de que el test dejó de
  // vigilar lo que debía.
  assert.ok(references.length > 0, 'se esperaba encontrar al menos una referencia (Index, Styles, Client_*)');

  const missing = references.filter((ref) => !fs.existsSync(path.join(HTML_DIR, ref.name + '.html')));
  assert.deepEqual(
    missing,
    [],
    'Referencias sin apps-script/html/<nombre>.html correspondiente (el nombre nunca lleva prefijo de carpeta, ' +
      'ver docs/09-deploy-clasp.md): ' + JSON.stringify(missing)
  );
});
