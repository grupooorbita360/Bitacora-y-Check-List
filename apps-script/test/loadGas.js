'use strict';
/**
 * Carga los archivos de apps-script/src en un vm.Context junto con los
 * mocks de globals de Apps Script, en el mismo orden numérico con el que
 * clasp los subiría (00_, 10_, 11_... 90_) — así el código bajo prueba es
 * exactamente el que se copiaría al proyecto de Apps Script real.
 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { createGasMocks } = require('./mocks/gasGlobals');

const SRC_DIR = path.join(__dirname, '..', 'src');

function createContext() {
  const mocks = createGasMocks();
  const sandbox = Object.assign({ console: console }, mocks);
  vm.createContext(sandbox);

  const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.js')).sort();
  for (const file of files) {
    const code = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
    vm.runInContext(code, sandbox, { filename: file });
  }

  return sandbox;
}

module.exports = { createContext };
