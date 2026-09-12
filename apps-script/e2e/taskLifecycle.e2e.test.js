'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, withDevServer } = require('./helpers');

test('Tasks: crear asignando a otra persona registra CREATED+ASSIGNED; abrir y comentar', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Dashboard');

      await page.click('text=Tasks');
      await page.click('text=+ Nueva Task');
      await page.waitForSelector('#modal-title');
      await page.fill('#modal-title', 'Seguimiento cliente VIP');
      await page.selectOption('#modal-type', 'Operativo');
      await page.selectOption('#modal-owner', 'U004'); // Ana Torres
      await page.click('.modal-box button.primary:has-text("Crear")');
      await page.waitForSelector('text=Seguimiento cliente VIP');
      const taskId = decodeURIComponent(page.url().split('/tasks/')[1]);
      assert.equal(taskId, 'T00001');

      await page.click('text=Historial completo');
      const history = await page.textContent('.panel:has-text("Historial completo")');
      assert.match(history, /Task creada/);
      assert.match(history, /Asignada/);

      await page.click('button:has-text("Abrir")');
      await page.waitForSelector('.badge.status-IN_PROGRESS');

      await page.fill('#new-comment-input', 'Reviso este caso, prioridad alta.');
      await page.click('text=Enviar');
      await page.waitForSelector('text=Reviso este caso, prioridad alta.');
    } finally {
      await browser.close();
    }
  });
});

test('Tasks: crear una Task para uno mismo solo registra CREATED (sin ASSIGNED)', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Dashboard');
      await page.click('text=Tasks');
      await page.click('text=+ Nueva Task');
      await page.waitForSelector('#modal-title');
      await page.fill('#modal-title', 'Nota para mi mismo');
      await page.selectOption('#modal-type', 'Operativo');
      await page.selectOption('#modal-owner', 'U001'); // Eduardo, quien crea
      await page.click('.modal-box button.primary:has-text("Crear")');
      await page.waitForSelector('text=Nota para mi mismo');

      await page.click('text=Historial completo');
      const history = await page.textContent('.panel:has-text("Historial completo")');
      assert.match(history, /Task creada/);
      assert.doesNotMatch(history, /Asignada/);
    } finally {
      await browser.close();
    }
  });
});

test('Tasks: subtareas (crear/completar) y participantes (agregar/quitar)', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Dashboard');
      await page.click('text=Tasks');
      await page.click('text=+ Nueva Task');
      await page.waitForSelector('#modal-title');
      await page.fill('#modal-title', 'Task con subtareas y participantes');
      await page.selectOption('#modal-type', 'Operativo');
      await page.selectOption('#modal-owner', 'U001');
      await page.click('.modal-box button.primary:has-text("Crear")');
      await page.waitForSelector('text=Task con subtareas y participantes');

      await page.fill('#new-subtask-input', 'Llamar al cliente');
      await page.click('button:has-text("Agregar")');
      await page.waitForSelector('text=Llamar al cliente');
      await page.click('input[type=checkbox]:near(:text("Llamar al cliente"))');
      await page.waitForTimeout(300);
      const doneCount = await page.locator('input[type=checkbox][disabled]').count();
      assert.equal(doneCount, 1, 'la subtarea debe quedar marcada como completada (checkbox deshabilitado)');

      const parentStatus = await page.getAttribute('.badge[class*="status-"]', 'class');
      assert.match(parentStatus, /status-PENDING/, 'completar la subtarea no debe completar la Task padre');

      await page.fill('#new-participant-input', 'U006');
      await page.click('.panel:has-text("Participantes") button:has-text("Agregar")');
      await page.waitForSelector('text=U006');
      await page.click('.panel:has-text("Participantes") button:has-text("Quitar")');
      await page.waitForSelector('text=Sin participantes.');
    } finally {
      await browser.close();
    }
  });
});

test('Tasks: SNOOZE exige comentario y fecha de revisión', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Dashboard');
      await page.click('text=Tasks');
      await page.click('text=+ Nueva Task');
      await page.waitForSelector('#modal-title');
      await page.fill('#modal-title', 'Task a posponer');
      await page.selectOption('#modal-type', 'Operativo');
      await page.selectOption('#modal-owner', 'U001');
      await page.click('.modal-box button.primary:has-text("Crear")');
      await page.waitForSelector('text=Task a posponer');

      await page.click('button:has-text("Abrir")');
      await page.waitForSelector('.badge.status-IN_PROGRESS');
      await page.click('button:has-text("Posponer")');
      await page.waitForSelector('#modal-review-date');
      await page.fill('#modal-comment', 'Esperando respuesta del cliente.');
      await page.fill('#modal-review-date', '2026-12-01');
      await page.click('.modal-box button.primary:has-text("Confirmar")');
      await page.waitForSelector('.badge.status-WAITING');
    } finally {
      await browser.close();
    }
  });
});

test('Tasks: Reasignar en bloque desde la lista', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Dashboard');
      await page.click('text=Tasks');
      await page.click('text=+ Nueva Task');
      await page.waitForSelector('#modal-title');
      await page.fill('#modal-title', 'Task para bulk reassign');
      await page.selectOption('#modal-type', 'Operativo');
      await page.selectOption('#modal-owner', 'U001');
      await page.click('.modal-box button.primary:has-text("Crear")');
      await page.waitForSelector('text=Task para bulk reassign');

      await page.click('text=Tasks');
      await page.waitForSelector('text=Reasignar en bloque');
      await page.click('text=Reasignar en bloque');
      await page.waitForSelector('.bulk-task-checkbox');
      await page.check('.bulk-task-checkbox >> nth=0');
      await page.selectOption('#modal-owner', 'U005');
      await page.click('.modal-box button.primary:has-text("Reasignar")');
      await page.waitForSelector('.toast.success');
    } finally {
      await browser.close();
    }
  });
});
