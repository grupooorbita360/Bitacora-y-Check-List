'use strict';
/**
 * Helpers compartidos por los specs e2e. Usan node:test (ya usado en
 * apps-script/test) + el paquete `playwright` — no `@playwright/test`,
 * que no hace falta instalar aparte y evita una segunda forma de correr
 * tests en el proyecto.
 */
const { chromium } = require('playwright');
const { createDevServer } = require('../devserver/server');

// Ver /root/.ccr/README.md del entorno de desarrollo: Chromium ya viene
// instalado; si el resolver por defecto de `playwright` no lo encuentra
// (versión distinta a la de /opt/pw-browsers), se fuerza esta ruta.
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium';

async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch (e) {
    return await chromium.launch({ executablePath: CHROMIUM_PATH });
  }
}

// Cada spec arranca su propio dev server (puerto 0 = libre, backend
// aislado) para no compartir estado entre archivos de test.
async function withDevServer(fn) {
  const dev = await createDevServer({ port: 0 });
  try {
    await fn(dev, 'http://localhost:' + dev.port);
  } finally {
    await dev.close();
  }
}

module.exports = { launchBrowser, withDevServer };
