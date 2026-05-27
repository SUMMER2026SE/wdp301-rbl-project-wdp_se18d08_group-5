const { test, expect } = require('@playwright/test');

test('verify frontend i18n runtime', async ({ page }) => {
  const base = 'http://127.0.0.1:5173';

  const shots = [
    '/tmp/i18n-home-en.png',
    '/tmp/i18n-home-vi.png',
    '/tmp/i18n-home-ja.png',
    '/tmp/i18n-login-ja.png',
    '/tmp/i18n-register-ja.png',
    '/tmp/i18n-forgot-ja.png',
    '/tmp/i18n-profile-attempt.png',
  ];

  await page.goto(base, { waitUntil: 'networkidle' });
  const homeEnTitle = (await page.locator('h1').first().textContent())?.trim();
  const navbarEn = ((await page.locator('nav').first().textContent()) || '').replace(/\s+/g, ' ').trim();
  await page.screenshot({ path: shots[0], fullPage: true });

  await page.getByRole('button', { name: /EN|VI|日本語/ }).click();
  await page.getByRole('menuitem', { name: 'VI' }).click();
  await page.waitForTimeout(300);
  const homeViTitle = (await page.locator('h1').first().textContent())?.trim();
  const navbarVi = ((await page.locator('nav').first().textContent()) || '').replace(/\s+/g, ' ').trim();
  await page.screenshot({ path: shots[1], fullPage: true });

  await page.getByRole('button', { name: /EN|VI|日本語/ }).click();
  await page.getByRole('menuitem', { name: '日本語' }).click();
  await page.waitForTimeout(300);
  const homeJaTitle = (await page.locator('h1').first().textContent())?.trim();
  const navbarJa = ((await page.locator('nav').first().textContent()) || '').replace(/\s+/g, ' ').trim();
  await page.screenshot({ path: shots[2], fullPage: true });

  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  const loginJaHeading = (await page.locator('h3').first().textContent())?.trim();
  const loginJaForm = ((await page.locator('form').textContent()) || '').replace(/\s+/g, ' ').trim();
  await page.screenshot({ path: shots[3], fullPage: true });

  await page.goto(`${base}/register`, { waitUntil: 'networkidle' });
  const registerJaHeading = (await page.locator('h3').first().textContent())?.trim();
  await page.screenshot({ path: shots[4], fullPage: true });

  await page.goto(`${base}/forgot-password`, { waitUntil: 'networkidle' });
  const forgotJaHeading = (await page.locator('h3').first().textContent())?.trim();
  await page.screenshot({ path: shots[5], fullPage: true });

  await page.goto(`${base}/profile/test-user`, { waitUntil: 'networkidle' });
  const profileBody = ((await page.locator('body').textContent()) || '').replace(/\s+/g, ' ').trim();
  await page.screenshot({ path: shots[6], fullPage: true });

  console.log(JSON.stringify({
    homeEnTitle,
    navbarEn,
    homeViTitle,
    navbarVi,
    homeJaTitle,
    navbarJa,
    loginJaHeading,
    loginJaForm,
    registerJaHeading,
    forgotJaHeading,
    profileBody,
    shots,
  }, null, 2));

  expect(homeEnTitle).toBeTruthy();
  expect(homeViTitle).toBeTruthy();
  expect(homeJaTitle).toBeTruthy();
});
