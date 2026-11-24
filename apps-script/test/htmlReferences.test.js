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

// Atrapa el caso inverso al de arriba: un archivo .html nuevo que se creó
// (ej. al partir Client_Views.html/Client_Modals.html en varios archivos
// — docs/16-file-split-map.md) pero a nadie se le incluyó en Index.html
// (ni en ningún otro archivo). Ese archivo quedaría copiado a dist-gas/
// por build-gas.js (que copia TODO .html sin mirar si alguien lo usa) pero
// nunca se serviría — código muerto que nadie detectaría a simple vista.
test('todo archivo .html (salvo Index.html, el entrypoint) está referenciado por algún include()', () => {
  const references = findHtmlReferences();
  const referencedNames = new Set(references.map((ref) => ref.name));

  const allHtmlFiles = fs
    .readdirSync(HTML_DIR)
    .filter((f) => f.endsWith('.html'))
    .map((f) => f.replace(/\.html$/, ''));

  const orphans = allHtmlFiles.filter((name) => name !== 'Index' && !referencedNames.has(name));
  assert.deepEqual(
    orphans,
    [],
    'Archivo(s) .html que existen en apps-script/html/ pero ningún include()/createTemplateFromFile() los referencia ' +
      '— quedarían en dist-gas/ pero nunca se servirían: ' + JSON.stringify(orphans)
  );
});

// Apps Script (y test/loadGas.js, que replica el mismo criterio) carga los
// .js de un proyecto en orden alfabético de nombre de archivo — por eso
// los prefijos numéricos (00_, 10_, 43_...) existen. El patrón usado para
// partir un archivo grande en varios (ej. 43_TaskService.js) es: un
// archivo "core" declara `var X = {...}` y archivos "extensión" hacen
// `Object.assign(X, {...})` para sumarle métodos — si un archivo
// extensión se carga ANTES que el core, revienta con "X is not defined"
// en cuanto Apps Script evalúa ese archivo. Este chequeo lo detecta sin
// necesidad de cargar nada en un vm.Context: para cada
// `Object.assign(X, ...)` que aparece en algún archivo, debe existir OTRO
// archivo que declara `var X = ` (clase o literal) y que ordena
// alfabéticamente ANTES.
test('Object.assign(X, {...}) en cualquier archivo de src/ carga después del archivo que declara "var X ="', () => {
  const jsFiles = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.js')).sort();
  const declaredIn = {}; // nombre -> primer archivo (en orden de carga) que lo declara con "var X ="
  const violations = [];

  jsFiles.forEach((file) => {
    const content = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');

    // Las declaraciones de este mismo archivo se registran primero — si
    // un archivo declara Y también se extiende a sí mismo (no pasa hoy,
    // pero sería válido), el orden textual dentro del propio archivo ya
    // lo garantiza Apps Script con solo ejecutarlo de arriba a abajo.
    const declPattern = /(?:^|\n)var\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/g;
    let match;
    while ((match = declPattern.exec(content)) !== null) {
      const name = match[1];
      if (!declaredIn[name]) declaredIn[name] = file;
    }

    const assignPattern = /Object\.assign\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,/g;
    while ((match = assignPattern.exec(content)) !== null) {
      const name = match[1];
      if (!declaredIn[name]) {
        violations.push(
          name + ' se extiende con Object.assign en ' + file + ' antes de que ningún archivo anterior lo declare con "var ' + name + ' ="'
        );
      }
    }
  });

  assert.deepEqual(violations, [], violations.join('; '));
});
