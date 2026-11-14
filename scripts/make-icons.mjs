// Erzeugt icons/icon-192.png und icon-512.png aus icons/icon.svg (benötigt Playwright + Chromium).
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

// Playwright lokal oder global (NODE_PATH) laden
const { chromium } = await import('playwright').catch(() => createRequire(import.meta.url)('playwright'));

const svg = await readFile(new URL('../icons/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  // Vollflächig (maskable-tauglich): grüner Hintergrund, Motiv mit Sicherheitsabstand
  await page.setContent(`<html><body style="margin:0;background:#15803d;display:grid;place-items:center;height:100vh">
    <div style="width:80%;height:80%">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`);
  await page.screenshot({ path: new URL(`../icons/icon-${size}.png`, import.meta.url).pathname });
  await page.close();
}
await browser.close();
console.log('Icons erzeugt.');
