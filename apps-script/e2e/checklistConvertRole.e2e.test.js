'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, withDevServer } = require('./helpers');

// Sección 36 del prompt maestro: convertir un Checklist con problema en
// Task de seguimiento es acción de Supervisor, no de Agent — el Agent solo
// reporta. Ver docs/14-checklist-convert-role.md.

test('Checklist: un Agent que reporta un problema NO ve la oferta de convertir en Task', async () => {
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

      await page.click('text=Checklist');
      await page.click('tr:has-text("Conteo de caja chica") button:has-text("Registrar")');
      await page.waitForSelector('#modal-valor');
      await page.fill('#modal-valor', '150.00');
      await page.selectOption('#modal-resultado', 'PROBLEMA');
      await page.click('.modal-box button.primary:has-text("Registrar")');
      await page.fill('#modal-comment', 'Faltante en caja.');
      await page.click('.modal-box button.primary:has-text("Registrar")');

      // No debe ofrecerle el modal de conversión — solo un toast avisando
      // que un Supervisor debe convertirlo.
      await page.waitForSelector('.toast.success:has-text("Un Supervisor deberá convertirlo")');
      assert.equal(await page.locator('.modal-box:has-text("Problema registrado")').count(), 0, 'no debe aparecer el modal de conversión para un Agent');
      assert.equal(await page.locator('button:has-text("Crear Task")').count(), 0);
    } finally {
      await browser.close();
    }
  });
});

test('Checklist: un Supervisor sí ve la oferta de convertir en Task y puede completarla', async () => {
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

      await page.click('text=Checklist');
      await page.click('tr:has-text("Conteo de caja chica") button:has-text("Registrar")');
      await page.waitForSelector('#modal-valor');
      await page.fill('#modal-valor', '150.00');
      await page.selectOption('#modal-resultado', 'PROBLEMA');
      await page.click('.modal-box button.primary:has-text("Registrar")');
      await page.fill('#modal-comment', 'Faltante en caja.');
      await page.click('.modal-box button.primary:has-text("Registrar")');
      await page.waitForSelector('text=Problema registrado');

      await page.click('.modal-box button.primary:has-text("Crear Task")');
      await page.waitForSelector('h2:has-text("Seguimiento")');
    } finally {
      await browser.close();
    }
  });
});
