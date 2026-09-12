'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, withDevServer } = require('./helpers');

// Usa page.clock para adelantar el reloj virtual del navegador en vez de
// esperar 20s reales — el intervalo de polling (Client_State.html) corre
// sobre setInterval, así que fastForward lo dispara igual que el tiempo real.
test('Task Detail: se refresca solo ~20s después de un cambio hecho por otra sesión', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.clock.install();
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Dashboard');

      await page.click('text=Tasks');
      await page.click('text=+ Nueva Task');
      await page.waitForSelector('#modal-title');
      await page.fill('#modal-title', 'Task para probar auto-refresh');
      await page.selectOption('#modal-type', 'Operativo');
      await page.selectOption('#modal-owner', 'U001');
      await page.click('.modal-box button.primary:has-text("Crear")');
      await page.waitForSelector('text=Task para probar auto-refresh');
      const taskId = decodeURIComponent(page.url().split('/tasks/')[1]);

      // "Otra sesión" comenta la Task directo contra el backend del dev
      // server (mismo efecto que otro usuario comentando desde su propio
      // browser) — la pestaña abierta no hizo nada para enterarse.
      dev.ctx.TaskService.addComment(taskId, 'U002', 'Comentario desde otra sesión');
      const commentVisibleBefore = await page.locator('text=Comentario desde otra sesión').count();
      assert.equal(commentVisibleBefore, 0, 'todavía no debería verse: no pasó el intervalo de polling');

      await page.clock.fastForward('00:21');
      await page.waitForSelector('text=Comentario desde otra sesión', { timeout: 5000 });
    } finally {
      await browser.close();
    }
  });
});

test('Tasks: la lista se refresca sola cuando otra sesión crea una Task visible', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.clock.install();
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Dashboard');
      await page.click('text=Tasks');
      await page.waitForSelector('text=0 Task(s)');

      dev.ctx.TaskService.create({ title: 'Creada por otra sesión', type: 'Operativo', department: 'DEP001', ownerId: 'U001' }, 'U001');
      assert.equal(await page.locator('text=Creada por otra sesión').count(), 0);

      await page.clock.fastForward('00:21');
      await page.waitForSelector('text=Creada por otra sesión', { timeout: 5000 });
    } finally {
      await browser.close();
    }
  });
});

test('El polling se pausa mientras la pestaña no está visible y se refresca al volver', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.clock.install();
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Dashboard');
      await page.click('text=Tasks');
      await page.click('text=+ Nueva Task');
      await page.waitForSelector('#modal-title');
      await page.fill('#modal-title', 'Task con la pestaña oculta');
      await page.selectOption('#modal-type', 'Operativo');
      await page.selectOption('#modal-owner', 'U001');
      await page.click('.modal-box button.primary:has-text("Crear")');
      await page.waitForSelector('text=Task con la pestaña oculta');
      const taskId = decodeURIComponent(page.url().split('/tasks/')[1]);

      // Simula la pestaña en segundo plano (no hay forma de setear
      // document.visibilityState nativamente en un test — se redefine el
      // getter, que es exactamente lo que Client_State.html consulta).
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      });

      dev.ctx.TaskService.addComment(taskId, 'U002', 'Comentario mientras estaba oculta');
      await page.clock.fastForward('00:21');
      await page.waitForTimeout(200);
      assert.equal(
        await page.locator('text=Comentario mientras estaba oculta').count(),
        0,
        'con la pestaña oculta no debería haber hecho polling'
      );

      // Vuelve a estar visible: Client_State.html también revisa en el
      // propio evento visibilitychange, sin esperar al próximo tick.
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.waitForSelector('text=Comentario mientras estaba oculta', { timeout: 5000 });
    } finally {
      await browser.close();
    }
  });
});
