'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, withDevServer } = require('./helpers');

// Cubre exactamente el flujo que se validó a mano en Fase 3/4: un Agent no
// puede reasignar directo (Task_Permissions real, sin fila REASSIGN para
// Agent) y debe pedir un ajuste; su Supervisor lo aprueba y el Owner
// cambia, con el historial completo.
test('Adjustment flow: Agent bloqueado de reassign directo -> requestAdjustment -> Supervisor aprueba -> Owner cambia', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      // Eduardo crea la Task para Ana (Agent).
      const ctxEduardo = await browser.newContext();
      const pageEduardo = await ctxEduardo.newPage();
      await pageEduardo.goto(base + '/', { waitUntil: 'networkidle' });
      await pageEduardo.waitForSelector('text=Dashboard');
      await pageEduardo.click('text=Tasks');
      await pageEduardo.click('text=+ Nueva Task');
      await pageEduardo.waitForSelector('#modal-title');
      await pageEduardo.fill('#modal-title', 'Caso escalado - reembolso');
      await pageEduardo.selectOption('#modal-type', 'Operativo');
      await pageEduardo.selectOption('#modal-owner', 'U004'); // Ana Torres
      await pageEduardo.click('.modal-box button.primary:has-text("Crear")');
      await pageEduardo.waitForSelector('text=Caso escalado - reembolso');
      const taskId = decodeURIComponent(pageEduardo.url().split('/tasks/')[1]);
      await ctxEduardo.close();

      // Ana (Agent) entra vía selector+PIN (email compartido).
      const ctxAna = await browser.newContext();
      const pageAna = await ctxAna.newPage();
      await pageAna.goto(base + '/?email=' + encodeURIComponent(dev.sharedEmail), { waitUntil: 'networkidle' });
      await pageAna.waitForSelector('#login-user');
      await pageAna.selectOption('#login-user', 'a.torres');
      await pageAna.fill('#login-pin', '1234');
      await pageAna.click('text=Entrar');
      await pageAna.waitForSelector('text=Dashboard');

      await pageAna.goto(base + '/#/tasks/' + taskId);
      await pageAna.waitForSelector('text=Caso escalado - reembolso');

      const reassignButtonCount = await pageAna.locator('button:has-text("Reasignar")').count();
      assert.equal(reassignButtonCount, 0, 'un Agent no debe ver el botón Reasignar directo');

      await pageAna.click('button:has-text("Pedir Ajuste")');
      await pageAna.waitForSelector('#modal-type');
      await pageAna.selectOption('#modal-type', 'REASSIGN');
      await pageAna.selectOption('#modal-new-owner', 'U005'); // Bruno Castillo
      await pageAna.fill('#modal-reason', 'Me voy de vacaciones, que lo tome Bruno.');
      await pageAna.click('.modal-box button.primary:has-text("Enviar")');
      await pageAna.waitForSelector('text=Ajustes pendientes');
      await ctxAna.close();

      // Marta (Supervisor de Ana) entra vía selector+PIN y aprueba.
      const ctxMarta = await browser.newContext();
      const pageMarta = await ctxMarta.newPage();
      await pageMarta.goto(base + '/?email=' + encodeURIComponent(dev.sharedEmail), { waitUntil: 'networkidle' });
      await pageMarta.waitForSelector('#login-user');
      await pageMarta.selectOption('#login-user', 'm.moreno');
      await pageMarta.fill('#login-pin', '1234');
      await pageMarta.click('text=Entrar');
      await pageMarta.waitForSelector('text=Dashboard');

      await pageMarta.goto(base + '/#/tasks/' + taskId);
      await pageMarta.waitForSelector('text=Ajustes pendientes');
      await pageMarta.click('button:has-text("Aprobar")');
      await pageMarta.waitForSelector('#modal-comment');
      await pageMarta.fill('#modal-comment', 'Aprobado, adelante.');
      await pageMarta.click('.modal-box button.primary:has-text("Confirmar")');
      await pageMarta.waitForSelector('text=Bruno Castillo');

      await pageMarta.click('text=Historial completo');
      const fullHistory = await pageMarta.textContent('.panel:has-text("Historial completo")');
      ['Task creada', 'Asignada', 'Ajuste solicitado', 'Ajuste aprobado'].forEach((label) => {
        assert.match(fullHistory, new RegExp(label), 'falta evento en el historial: ' + label);
      });

      await ctxMarta.close();
    } finally {
      await browser.close();
    }
  });
});

test('Adjustment flow: rechazar un ajuste no cambia el Owner', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const ctxEduardo = await browser.newContext();
      const pageEduardo = await ctxEduardo.newPage();
      await pageEduardo.goto(base + '/', { waitUntil: 'networkidle' });
      await pageEduardo.waitForSelector('text=Dashboard');
      await pageEduardo.click('text=Tasks');
      await pageEduardo.click('text=+ Nueva Task');
      await pageEduardo.waitForSelector('#modal-title');
      await pageEduardo.fill('#modal-title', 'Caso a no reasignar');
      await pageEduardo.selectOption('#modal-type', 'Operativo');
      await pageEduardo.selectOption('#modal-owner', 'U004');
      await pageEduardo.click('.modal-box button.primary:has-text("Crear")');
      await pageEduardo.waitForSelector('text=Caso a no reasignar');
      const taskId = decodeURIComponent(pageEduardo.url().split('/tasks/')[1]);
      await ctxEduardo.close();

      const ctxAna = await browser.newContext();
      const pageAna = await ctxAna.newPage();
      await pageAna.goto(base + '/?email=' + encodeURIComponent(dev.sharedEmail), { waitUntil: 'networkidle' });
      await pageAna.waitForSelector('#login-user');
      await pageAna.selectOption('#login-user', 'a.torres');
      await pageAna.fill('#login-pin', '1234');
      await pageAna.click('text=Entrar');
      await pageAna.waitForSelector('text=Dashboard');
      await pageAna.goto(base + '/#/tasks/' + taskId);
      await pageAna.waitForSelector('button:has-text("Pedir Ajuste")');
      await pageAna.click('button:has-text("Pedir Ajuste")');
      await pageAna.waitForSelector('#modal-type');
      await pageAna.selectOption('#modal-new-owner', 'U005');
      await pageAna.fill('#modal-reason', 'x');
      await pageAna.click('.modal-box button.primary:has-text("Enviar")');
      await pageAna.waitForSelector('text=Ajustes pendientes');
      await ctxAna.close();

      const ctxMarta = await browser.newContext();
      const pageMarta = await ctxMarta.newPage();
      await pageMarta.goto(base + '/?email=' + encodeURIComponent(dev.sharedEmail), { waitUntil: 'networkidle' });
      await pageMarta.waitForSelector('#login-user');
      await pageMarta.selectOption('#login-user', 'm.moreno');
      await pageMarta.fill('#login-pin', '1234');
      await pageMarta.click('text=Entrar');
      await pageMarta.waitForSelector('text=Dashboard');
      await pageMarta.goto(base + '/#/tasks/' + taskId);
      await pageMarta.waitForSelector('button:has-text("Rechazar")');
      await pageMarta.click('button:has-text("Rechazar")');
      await pageMarta.waitForSelector('#modal-comment');
      await pageMarta.fill('#modal-comment', 'No procede.');
      await pageMarta.click('.modal-box button.primary:has-text("Confirmar")');
      await pageMarta.waitForSelector('text=Ana Torres');
      await ctxMarta.close();
    } finally {
      await browser.close();
    }
  });
});
