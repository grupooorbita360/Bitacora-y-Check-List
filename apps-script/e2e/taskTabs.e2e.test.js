'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, withDevServer } = require('./helpers');

test('Tasks: Agent ve Mis Tasks/Equipo/En espera/Completadas (sin Supervisión ni Management)', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/?email=' + encodeURIComponent(dev.sharedEmail), { waitUntil: 'networkidle' });
      await page.waitForSelector('#login-user');
      await page.selectOption('#login-user', 'a.torres'); // Ana Torres, Agent
      await page.fill('#login-pin', '1234');
      await page.click('text=Entrar');
      await page.waitForSelector('text=Dashboard');

      await page.click('text=Tasks');
      await page.waitForSelector('.task-tabs');
      const labels = (await page.locator('.task-tabs button').allTextContents()).map((t) => t.trim());
      assert.deepEqual(labels, ['Mis Tasks', 'Equipo', 'En espera', 'Completadas']);
    } finally {
      await browser.close();
    }
  });
});

test('Tasks: Supervisor agrega la pestaña Supervisión', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/?email=' + encodeURIComponent(dev.sharedEmail), { waitUntil: 'networkidle' });
      await page.waitForSelector('#login-user');
      await page.selectOption('#login-user', 'm.moreno'); // Marta Moreno, Supervisor
      await page.fill('#login-pin', '1234');
      await page.click('text=Entrar');
      await page.waitForSelector('text=Dashboard');

      await page.click('text=Tasks');
      await page.waitForSelector('.task-tabs');
      const labels = (await page.locator('.task-tabs button').allTextContents()).map((t) => t.trim());
      assert.deepEqual(labels, ['Mis Tasks', 'Equipo', 'En espera', 'Completadas', 'Supervisión']);
    } finally {
      await browser.close();
    }
  });
});

test('Tasks: Manager/Director agregan Departamento (en vez de Equipo) y Management', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/', { waitUntil: 'networkidle' }); // Eduardo, Manager+Admin, DIRECT
      await page.waitForSelector('text=Dashboard');

      await page.click('text=Tasks');
      await page.waitForSelector('.task-tabs');
      const labels = (await page.locator('.task-tabs button').allTextContents()).map((t) => t.trim());
      assert.deepEqual(labels, ['Mis Tasks', 'Departamento', 'En espera', 'Completadas', 'Supervisión', 'Management']);
    } finally {
      await browser.close();
    }
  });
});

test('Tasks: la pestaña Departamento muestra el desglose por persona y permite filtrar por una sola', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      dev.ctx.TaskService.create({ title: 'Para Ana 1', type: 'Operativo', department: 'DEP001', ownerId: 'U004' }, 'U001');
      dev.ctx.TaskService.create({ title: 'Para Ana 2', type: 'Operativo', department: 'DEP001', ownerId: 'U004' }, 'U001');
      dev.ctx.TaskService.create({ title: 'Para Bruno', type: 'Operativo', department: 'DEP001', ownerId: 'U005' }, 'U001');

      const page = await browser.newPage();
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Dashboard');
      await page.click('text=Tasks');
      await page.click('.task-tabs button:has-text("Departamento")');
      await page.waitForSelector('.team-breakdown');

      // El desglose usa 'Owner' (el nombre completo que ya trae cada Task,
      // igual que la columna Owner de la tabla), no 'Nombre Corto'.
      const chipTexts = (await page.locator('.team-breakdown .chip').allTextContents()).map((t) => t.trim());
      assert.ok(chipTexts.indexOf('Ana Torres: 2') !== -1, 'debe mostrar el conteo de Ana: ' + chipTexts.join(', '));
      assert.ok(chipTexts.indexOf('Bruno Castillo: 1') !== -1, 'debe mostrar el conteo de Bruno: ' + chipTexts.join(', '));
      assert.ok(chipTexts.some((t) => /^Todos \(\d+\)$/.test(t)));

      await page.click('.team-breakdown .chip:has-text("Ana Torres: 2")');
      await page.waitForSelector('text=2 Task(s)');
      assert.equal(await page.locator('tr:has-text("Para Bruno")').count(), 0, 'filtrar por Ana no debe mostrar Tasks de Bruno');
      await page.waitForSelector('tr:has-text("Para Ana 1")');
      await page.waitForSelector('tr:has-text("Para Ana 2")');

      await page.click('.team-breakdown .chip:has-text("Todos")');
      await page.waitForSelector('text=3 Task(s)');
      await page.waitForSelector('tr:has-text("Para Bruno")');
    } finally {
      await browser.close();
    }
  });
});

test('Tasks: la pestaña Supervisión agrupa las Tasks de Checklist con problema, sin mezclarlas en Departamento', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Dashboard');

      await page.click('text=Checklist');
      await page.click('tr:has-text("Conteo de caja chica") button:has-text("Registrar")');
      await page.waitForSelector('#modal-valor');
      await page.fill('#modal-valor', '150.00');
      await page.selectOption('#modal-resultado', 'PROBLEMA');
      await page.click('.modal-box button.primary:has-text("Registrar")');
      await page.waitForSelector('.form-error:has-text("Describe el problema")');
      await page.fill('#modal-comment', 'Faltante en caja.');
      await page.click('.modal-box button.primary:has-text("Registrar")');
      await page.waitForSelector('text=Problema registrado');
      await page.click('.modal-box button.primary:has-text("Crear Task")');
      await page.waitForSelector('h2:has-text("Seguimiento")');

      await page.click('text=Tasks');
      await page.click('.task-tabs button:has-text("Departamento")');
      await page.waitForSelector('.toolbar');
      assert.equal(
        await page.locator('tr:has-text("Seguimiento: Conteo de caja chica")').count(),
        0,
        'no debe mezclarse en Departamento'
      );

      await page.click('.task-tabs button:has-text("Supervisión")');
      await page.waitForSelector('tr:has-text("Seguimiento: Conteo de caja chica")');
    } finally {
      await browser.close();
    }
  });
});
