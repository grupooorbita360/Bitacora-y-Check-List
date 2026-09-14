'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, withDevServer } = require('./helpers');

test('Tasks: una fila cuyo Task ID trae un apóstrofo (Sheet editado a mano) sigue siendo clicable', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Dashboard');
      await page.click('text=Tasks');
      await page.click('text=+ Nueva Task');
      await page.waitForSelector('#modal-title');
      await page.fill('#modal-title', 'Task con ID con comilla');
      await page.selectOption('#modal-type', 'Operativo');
      await page.selectOption('#modal-owner', 'U001');
      await page.click('.modal-box button.primary:has-text("Crear")');
      await page.waitForSelector('text=Task con ID con comilla');
      const originalId = decodeURIComponent(page.url().split('/tasks/')[1]);

      // Simula un Task ID con un apóstrofo, como podría quedar si alguien
      // editó la fila a mano en el Sheet real (nextSequentialId nunca
      // genera uno así, pero el render no debe asumirlo). Antes del fix,
      // el apóstrofo sin escapar rompía el JS del onclick inline y la fila
      // dejaba de responder al click sin ningún otro síntoma visible.
      const weirdId = originalId + "'A";
      new dev.ctx.TasksRepository().update(originalId, { 'Task ID': weirdId });

      await page.click('text=Tasks');
      await page.waitForSelector('tr:has-text("Task con ID con comilla")');
      await page.click('tr:has-text("Task con ID con comilla")');

      await page.waitForSelector('h2:has-text("Task con ID con comilla")', { timeout: 3000 });
      assert.equal(decodeURIComponent(page.url().split('/tasks/')[1]), weirdId);
    } finally {
      await browser.close();
    }
  });
});

test('Layout: el topbar queda fijo (sticky) al hacer scroll en la lista de Tasks', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Dashboard');

      // Suficientes Tasks para que la lista sea más alta que el viewport.
      for (let i = 0; i < 30; i++) {
        dev.ctx.TaskService.create(
          { title: 'Task de relleno ' + i, type: 'Operativo', department: 'DEP001', ownerId: 'U001' },
          'U001'
        );
      }
      await page.click('text=Tasks');
      await page.waitForSelector('text=Task de relleno 29');

      const position = await page.evaluate(() => getComputedStyle(document.querySelector('.topbar')).position);
      assert.equal(position, 'sticky');

      const topBefore = (await page.locator('.topbar').boundingBox()).y;
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(100);
      const topAfter = (await page.locator('.topbar').boundingBox()).y;
      assert.equal(topAfter, topBefore, 'el topbar no debe moverse verticalmente al hacer scroll');
      assert.ok(topAfter >= 0, 'el topbar debe seguir dentro del viewport (no desaparecer hacia arriba)');
    } finally {
      await browser.close();
    }
  });
});

test('Dashboard: Agent ve solo sus Tasks, Manager/Admin ve el panorama del departamento', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      // Eduardo (Manager+Admin, DIRECT) crea Tasks para Ana y Bruno — ninguna es suya.
      dev.ctx.TaskService.create({ title: 'Para Ana', type: 'Operativo', department: 'DEP001', ownerId: 'U004' }, 'U001');
      dev.ctx.TaskService.create({ title: 'Para Bruno', type: 'Operativo', department: 'DEP001', ownerId: 'U005' }, 'U001');

      const page = await browser.newPage();
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Dashboard');
      await page.waitForSelector('text=Resumen de las Tasks visibles para tu rol');
      const eduardoPending = await page.textContent('.stat-card:has-text("Pendientes") .value');
      assert.equal(eduardoPending.trim(), '2', 'Eduardo (Manager/Admin) debe ver el panorama del departamento, no solo lo suyo');
      await page.close();

      // Ana (Agent) entra por el correo compartido con su PIN — debe ver
      // solo su propia Task, no la de Bruno.
      const anaPage = await browser.newPage();
      await anaPage.goto(base + '/?email=' + encodeURIComponent(dev.sharedEmail), { waitUntil: 'networkidle' });
      await anaPage.waitForSelector('#login-user');
      await anaPage.selectOption('#login-user', 'a.torres');
      await anaPage.fill('#login-pin', '1234');
      await anaPage.click('text=Entrar');
      await anaPage.waitForSelector('text=Dashboard');
      await anaPage.waitForSelector('text=Resumen de tus Tasks');
      const anaPending = await anaPage.textContent('.stat-card:has-text("Pendientes") .value');
      assert.equal(anaPending.trim(), '1', 'Ana (Agent) solo debe contar su propia Task');
      await anaPage.close();
    } finally {
      await browser.close();
    }
  });
});
