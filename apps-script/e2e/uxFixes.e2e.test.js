'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, withDevServer } = require('./helpers');

test('Task Detail: "Agregar Participante" es un selector de nombres, no texto libre', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Dashboard');
      await page.click('text=Tasks');
      await page.click('text=+ Nueva Task');
      await page.waitForSelector('#modal-title');
      await page.fill('#modal-title', 'Task para probar el selector de participantes');
      await page.selectOption('#modal-type', 'Operativo');
      await page.selectOption('#modal-owner', 'U001');
      await page.click('.modal-box button.primary:has-text("Crear")');
      await page.waitForSelector('text=Task para probar el selector de participantes');

      // No debe quedar ningún input de texto libre para el participante.
      assert.equal(await page.locator('#new-participant-input').count(), 0);
      const select = page.locator('#new-participant-select');
      await select.waitFor();

      // Las opciones muestran nombres, nunca el User ID crudo.
      const optionTexts = await select.locator('option').allTextContents();
      assert.ok(optionTexts.some((t) => t.trim() === 'Carla'), 'las opciones deben mostrar Nombre Corto, no el User ID');
      assert.ok(!optionTexts.some((t) => /^U00\d$/.test(t.trim())), 'ninguna opción debe mostrar el User ID crudo como texto');

      await select.selectOption('U006'); // Carla Jimenez — el User ID viaja "por debajo", nunca lo escribe el usuario
      await page.click('.panel:has-text("Participantes") button:has-text("Agregar")');
      await page.waitForSelector('.panel:has-text("Participantes") >> text=Carla');

      // Ya agregada, Carla no debe poder elegirse de nuevo en el selector.
      const optionTextsAfter = await page.locator('#new-participant-select option').allTextContents();
      assert.ok(!optionTextsAfter.some((t) => t.trim() === 'Carla'), 'un participante activo no debe reaparecer en el selector');
    } finally {
      await browser.close();
    }
  });
});

test('Dashboard: clic en una tarjeta navega a Tasks con ese estado como filtro activo', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      dev.ctx.TaskService.create({ title: 'Pendiente 1', type: 'Operativo', department: 'DEP001', ownerId: 'U001' }, 'U001');
      const enProgreso = dev.ctx.TaskService.create({ title: 'En progreso 1', type: 'Operativo', department: 'DEP001', ownerId: 'U001' }, 'U001');
      dev.ctx.TaskService.transition(enProgreso['Task ID'], 'OPEN', 'U001');

      const page = await browser.newPage();
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Dashboard');

      await page.click('.stat-card:has-text("En Progreso")');
      await page.waitForSelector('text=1 Task(s)');
      assert.match(page.url(), /#\/tasks$/);
      await page.waitForSelector('tr:has-text("En progreso 1")');
      assert.equal(await page.locator('tr:has-text("Pendiente 1")').count(), 0, 'el filtro de estado activo no debe mostrar la Task Pendiente');
    } finally {
      await browser.close();
    }
  });
});

test('Dashboard: clic en "Vencidas" navega a Tasks con el filtro de vencidas activo', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const overdue = dev.ctx.TaskService.create(
        { title: 'Tarea vencida', type: 'Operativo', department: 'DEP001', ownerId: 'U001', dueDate: '2020-01-01' },
        'U001'
      );
      dev.ctx.TaskService.transition(overdue['Task ID'], 'OPEN', 'U001');
      dev.ctx.TaskService.create({ title: 'Tarea al día', type: 'Operativo', department: 'DEP001', ownerId: 'U001' }, 'U001');

      const page = await browser.newPage();
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Dashboard');

      await page.click('.stat-card.overdue');
      await page.waitForSelector('text=1 Task(s)');
      await page.waitForSelector('tr:has-text("Tarea vencida")');
      assert.equal(await page.locator('tr:has-text("Tarea al día")').count(), 0);

      const overdueCheckbox = page.locator('label:has-text("Vencidas") input[type=checkbox]');
      assert.equal(await overdueCheckbox.isChecked(), true, 'el filtro de Vencidas debe quedar visiblemente activo');
    } finally {
      await browser.close();
    }
  });
});

test('Checklist: registrar OK, y registrar un problema ofrece convertirlo en Task de seguimiento', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Dashboard');

      await page.click('text=Checklist');
      await page.waitForSelector('text=Revisión de correos pendientes');

      // CHECK: sin campo Valor.
      await page.click('tr:has-text("Revisión de correos pendientes") button:has-text("Registrar")');
      await page.waitForSelector('#modal-resultado');
      assert.equal(await page.locator('#modal-valor').count(), 0, 'un ítem tipo CHECK no debe pedir Valor');
      await page.click('.modal-box button.primary:has-text("Registrar")');
      await page.waitForSelector('.toast.success');

      // DATA con problema: pide Valor + Comentario obligatorio, y ofrece
      // convertir la ejecución en una Task de seguimiento.
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
      assert.match(page.url(), /#\/tasks\//, 'debe navegar al detalle de la Task recién creada');
    } finally {
      await browser.close();
    }
  });
});
