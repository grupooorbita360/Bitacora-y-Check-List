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

test('Logout (DIRECT): bootApp() vuelve a correr la detección en vez de quedar congelado en "Verificando sesión…"', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Dashboard');

      await page.click('button:has-text("Salir")');
      // Antes del fix, logout() solo cambiaba de pantalla sin volver a
      // llamar Api.startLogin() — App.loginState se quedaba en
      // {mode:'LOADING'} (nunca actualizado tras un login exitoso) y la
      // vista quedaba congelada en "Verificando sesión…" hasta refrescar
      // la página a mano. Con bootApp() re-ejecutando la detección
      // DIRECT/SELECT_PIN/DENIED, Eduardo (email único) vuelve a entrar
      // solo, sin quedarse pegado.
      await page.waitForSelector('text=Dashboard', { timeout: 3000 });
      const userName = await page.textContent('.user-info strong');
      assert.equal(userName, 'Eduardo Lopez');
    } finally {
      await browser.close();
    }
  });
});

test('Logout (SELECT_PIN): vuelve a mostrar el selector de usuario, no una pantalla congelada, y permite reingresar', async () => {
  await withDevServer(async (dev, base) => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.goto(base + '/?email=' + encodeURIComponent(dev.sharedEmail), { waitUntil: 'networkidle' });
      await page.waitForSelector('#login-user');
      await page.selectOption('#login-user', 'm.moreno');
      await page.fill('#login-pin', '1234');
      await page.click('text=Entrar');
      await page.waitForSelector('text=Dashboard');

      await page.click('button:has-text("Salir")');
      await page.waitForSelector('#login-user', { timeout: 3000 });

      await page.selectOption('#login-user', 'a.torres');
      await page.fill('#login-pin', '1234');
      await page.click('text=Entrar');
      await page.waitForSelector('text=Dashboard');
      assert.equal(await page.textContent('.user-info strong'), 'Ana Torres');
    } finally {
      await browser.close();
    }
  });
});
