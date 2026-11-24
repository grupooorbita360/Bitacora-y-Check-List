'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, withDevServer } = require('./helpers');

// docs/15-visibility-assignment-gaps.md: los selectores de "nuevo Owner"/
// "nuevo Participant" no deben ofrecer a alguien cuyo rol no alcanza la
// Visibility de la Task — ni aunque quien abre el modal (Eduardo, Admin)
// sí tenga permiso de reasignar/agregar.

test('Reasignar: el selector de "Nuevo Owner" no ofrece a un Agent en una Task SUPERVISION', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const taskId = dev.ctx.TaskService.create(
        { title: 'Task de Supervisión', type: 'Operativo', department: 'DEP001', ownerId: 'U001', visibility: 'SUPERVISION' },
        'U001'
      )['Task ID'];

      const page = await browser.newPage();
      await page.goto(base + '/', { waitUntil: 'networkidle' }); // Eduardo, DIRECT
      await page.waitForSelector('text=Dashboard');
      await page.goto(base + '/#/tasks/' + taskId);
      await page.waitForSelector('text=Task de Supervisión');

      await page.click('button:has-text("Reasignar")');
      await page.waitForSelector('#modal-owner');
      const optionTexts = await page.locator('#modal-owner option').allTextContents();
      assert.ok(!optionTexts.some((t) => t.trim() === 'Ana'), 'Ana (Agent) no debe estar en el selector: ' + optionTexts.join(', '));
      assert.ok(optionTexts.some((t) => t.trim() === 'Marta'), 'Marta (Supervisor) sí debe estar: ' + optionTexts.join(', '));
    } finally {
      await browser.close();
    }
  });
});

test('Tomar Ownership: el selector tampoco ofrece a un Agent en una Task MANAGEMENT', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const taskId = dev.ctx.TaskService.create(
        { title: 'Tema de Management', type: 'Operativo', department: 'DEP001', ownerId: 'U001', visibility: 'MANAGEMENT' },
        'U001'
      )['Task ID'];

      const page = await browser.newPage();
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Dashboard');
      await page.goto(base + '/#/tasks/' + taskId);
      await page.waitForSelector('text=Tema de Management');

      await page.click('button:has-text("Tomar Ownership")');
      await page.waitForSelector('#modal-owner');
      const optionTexts = await page.locator('#modal-owner option').allTextContents();
      assert.ok(!optionTexts.some((t) => t.trim() === 'Marta'), 'Marta (Supervisor) no alcanza MANAGEMENT: ' + optionTexts.join(', '));
      assert.ok(optionTexts.some((t) => t.trim() === 'Eduardo'), 'Eduardo (Manager+Admin) sí debe estar: ' + optionTexts.join(', '));
    } finally {
      await browser.close();
    }
  });
});

test('Agregar Participante: el selector no ofrece a un Agent en una Task SUPERVISION, y el error del backend se ve claro si se fuerza', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const taskId = dev.ctx.TaskService.create(
        { title: 'Otra de Supervisión', type: 'Operativo', department: 'DEP001', ownerId: 'U001', visibility: 'SUPERVISION' },
        'U001'
      )['Task ID'];

      const page = await browser.newPage();
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Dashboard');
      await page.goto(base + '/#/tasks/' + taskId);
      await page.waitForSelector('text=Otra de Supervisión');

      await page.waitForSelector('#new-participant-select');
      const optionTexts = await page.locator('#new-participant-select option').allTextContents();
      assert.ok(!optionTexts.some((t) => t.trim() === 'Ana'), 'Ana (Agent) no debe estar en el selector de participantes: ' + optionTexts.join(', '));

      // Forzamos el caso de error (ej. datos desincronizados) llamando el
      // backend directo con un Agent, para confirmar que el mensaje es claro.
      assert.throws(
        () => dev.ctx.TaskService.addParticipant(taskId, 'U004', 'U001'),
        /no alcanza la Visibility de esta Task \(SUPERVISION\)/
      );
    } finally {
      await browser.close();
    }
  });
});
