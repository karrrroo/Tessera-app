import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const log = (...a) => console.log(...a);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
await page.goto(`${BASE}/login`, { waitUntil: "load" });
await page.getByText("Ուսուցիչ՝ Ա. Սարգսյան", { exact: true }).click();
await page.waitForURL("**/gradebook*", { timeout: 5000 });
await page.waitForTimeout(1500);

const cell = (row, col) => page.locator(`button[data-row="${row}"][data-col="${col}"]`);
await cell(0, 0).click();
log("after click, activeElement data-row/col:", await page.evaluate(() => [document.activeElement?.getAttribute("data-row"), document.activeElement?.getAttribute("data-col")]));

await page.keyboard.press("5");
await page.waitForTimeout(150);
log("after '5', activeElement data-row/col:", await page.evaluate(() => [document.activeElement?.getAttribute("data-row"), document.activeElement?.getAttribute("data-col")]));
log("cell(1,0) outline style (should show focus ring if React state says focused):", await cell(1, 0).evaluate((el) => getComputedStyle(el).outlineStyle + " " + getComputedStyle(el).outlineColor));
log("cell(0,0) outline style:", await cell(0, 0).evaluate((el) => getComputedStyle(el).outlineStyle + " " + getComputedStyle(el).outlineColor));
log("cell(0,0) tabIndex:", await cell(0, 0).evaluate((el) => el.tabIndex));
log("cell(1,0) tabIndex:", await cell(1, 0).evaluate((el) => el.tabIndex));

await browser.close();
