'use strict';
/**
 * Dev server local para probar el frontend en un navegador real sin
 * depender de un despliegue de Apps Script. Reutiliza el MISMO backend
 * (Config/Services) que corre bajo test (apps-script/test/loadGas.js) con
 * los mocks de SpreadsheetApp/Utilities/Session — la única diferencia con
 * producción es el transporte: aquí el cliente habla HTTP/fetch en vez de
 * google.script.run (ver Client_Api.html → callServer()).
 *
 * Uso: node devserver/server.js [--port 8080]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createContext } = require('../test/loadGas');

const HTML_DIR = path.join(__dirname, '..', 'html');
const portFlagIndex = process.argv.indexOf('--port');
const PORT = portFlagIndex !== -1 ? Number(process.argv[portFlagIndex + 1]) : 8080;

const ctx = createContext();
ctx.PropertiesService.getScriptProperties().setProperty('SESSION_SECRET', 'dev-secret-not-for-production');
ctx.bootstrapTestEnvironment();

const DIRECT_EMAIL = 'eduardo.lopez@example.test';
const SHARED_EMAIL = 'executiveservices.team@example.test';
ctx.__setActiveUserEmail(DIRECT_EMAIL);

function resolveIncludes(html) {
  return html.replace(/<\?!=\s*include\('([^']+)'\);?\s*\?>/g, function (_, name) {
    const content = fs.readFileSync(path.join(HTML_DIR, name + '.html'), 'utf8');
    return resolveIncludes(content);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/') {
    const emailParam = url.searchParams.get('email');
    if (emailParam) ctx.__setActiveUserEmail(emailParam);
    const indexHtml = fs.readFileSync(path.join(HTML_DIR, 'Index.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(resolveIncludes(indexHtml));
    return;
  }

  if (req.method === 'POST' && url.pathname.indexOf('/rpc/') === 0) {
    const fnName = url.pathname.slice('/rpc/'.length);
    if (!/^api_[A-Za-z0-9_]+$/.test(fnName) || typeof ctx[fnName] !== 'function') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Función no encontrada: ' + fnName }));
      return;
    }
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      try {
        const args = body ? JSON.parse(body) : [];
        const result = ctx[fnName].apply(null, args);
        res.end(JSON.stringify({ ok: true, result: result }));
      } catch (e) {
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('Dev server escuchando en http://localhost:' + PORT);
  console.log('Por defecto: DIRECT sin PIN, como Eduardo (' + DIRECT_EMAIL + ').');
  console.log('Para probar el flujo SELECT_PIN+PIN: http://localhost:' + PORT + '/?email=' + encodeURIComponent(SHARED_EMAIL));
  console.log('Login IDs de prueba (PIN 1234): m.moreno, a.hernandez, a.torres, b.castillo, c.jimenez, d.fuentes, e.ramos');
});
