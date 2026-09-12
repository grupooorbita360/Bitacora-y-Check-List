'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { launchBrowser, withDevServer } = require('./helpers');

test('Auth: email único entra DIRECT sin PIN', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Dashboard');
      const userName = await page.textContent('.user-info strong');
      assert.equal(userName, 'Eduardo Lopez');
    } finally {
      await browser.close();
    }
  });
});

test('Auth: email compartido pide selector + PIN, PIN incorrecto rechaza sin entrar', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/?email=' + encodeURIComponent(dev.sharedEmail), { waitUntil: 'networkidle' });
      await page.waitForSelector('#login-user');

      await page.selectOption('#login-user', 'm.moreno');
      await page.fill('#login-pin', '9999');
      await page.click('text=Entrar');
      await page.waitForSelector('#login-error:has-text("PIN incorrecto")');

      await page.fill('#login-pin', '1234');
      await page.click('text=Entrar');
      await page.waitForSelector('text=Dashboard');
      const userName = await page.textContent('.user-info strong');
      assert.equal(userName, 'Marta Elvira Moreno');
    } finally {
      await browser.close();
    }
  });
});

test('Auth: un correo sin usuarios activos muestra la pantalla DENIED', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/?email=nadie@example.test', { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Acceso no configurado');
    } finally {
      await browser.close();
    }
  });
});
