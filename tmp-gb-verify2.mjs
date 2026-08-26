import { chromium } from "playwright";

const OUT = "C:/Users/Home2026/AppData/Local/Temp/claude/c--Users-Home2026-Desktop-tessera/cbef404f-0dac-450f-96ce-31176f27d9d8/scratchpad";
const BASE = "http://localhost:3000";
const log = (...a) => console.log(...a);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
page.on("pageerror", (err) => log("[pageerror]", err.message));
page.on("console", (msg) => { if (msg.type() === "error") log("[console.error]", msg.text()); });

await page.goto(`${BASE}/login`, { waitUntil: "load" });
await page.getByText("Ուսուցիչ՝ Ա. Սարգսյան", { exact: true }).click();
await page.waitForURL("**/gradebook*", { timeout: 5000 });
await page.waitForTimeout(1500);
log("landed on:", page.url());

const colCountOrig = await page.locator('button[data-row="0"]').count();
log("original column count:", colCountOrig);

const plusBtn = page.locator("button[title]").filter({ hasText: "+" });

log("--- add column C1 ---");
await plusBtn.click();
await page.waitForTimeout(400);
const afterC1 = await page.locator('button[data-row="0"]').count();
const c1 = afterC1 - 1;
log("column count after C1:", afterC1, "C1 index:", c1);

log("--- add column C2 ---");
await plusBtn.click();
await page.waitForTimeout(400);
const afterC2 = await page.locator('button[data-row="0"]').count();
const c2 = afterC2 - 1;
log("column count after C2:", afterC2, "C2 index:", c2);

const cell = (row, col) => page.locator(`button[data-row="${row}"][data-col="${col}"]`);
const isFocused = async (loc) => loc.evaluate((el) => el === document.activeElement);

await cell(0, c1).click();
log("--- digit 2-9: commit + move down ---");
await page.keyboard.press("5");
await page.waitForTimeout(150);
log("cell(0,C1) text:", await cell(0, c1).textContent(), "| focus->(1,C1):", await isFocused(cell(1, c1)));

log("--- '1' then '0' <400ms => 10, move down ---");
await page.keyboard.press("1");
await page.waitForTimeout(100);
log("cell(1,C1) mid-pending:", await cell(1, c1).textContent());
await page.keyboard.press("0");
await page.waitForTimeout(150);
log("cell(1,C1) after '10':", await cell(1, c1).textContent(), "| focus->(2,C1):", await isFocused(cell(2, c1)));

log("--- lone '1' with >400ms timeout => commits 1, no move ---");
await page.keyboard.press("1");
await page.waitForTimeout(550);
log("cell(2,C1) after timeout:", await cell(2, c1).textContent(), "| focus stayed:", await isFocused(cell(2, c1)));

log("--- Backspace: clears and stays ---");
await page.keyboard.press("Backspace");
await page.waitForTimeout(150);
log("cell(2,C1) after Backspace:", JSON.stringify(await cell(2, c1).textContent()), "| focus stayed:", await isFocused(cell(2, c1)));

log("--- Enter down / Shift+Enter up ---");
await page.keyboard.press("Enter");
await page.waitForTimeout(100);
log("focus->(3,C1):", await isFocused(cell(3, c1)));
await page.keyboard.press("Shift+Enter");
await page.waitForTimeout(100);
log("focus back->(2,C1):", await isFocused(cell(2, c1)));

log("--- ArrowRight/Tab/ArrowLeft/Shift+Tab across columns (pure nav) ---");
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(100);
log("focus->(2,C2) via ArrowRight:", await isFocused(cell(2, c2)));
await page.keyboard.press("Shift+Tab");
await page.waitForTimeout(100);
log("focus back->(2,C1) via Shift+Tab:", await isFocused(cell(2, c1)));
await page.keyboard.press("Tab");
await page.waitForTimeout(100);
log("focus->(2,C2) via Tab:", await isFocused(cell(2, c2)));
await page.keyboard.press("ArrowLeft");
await page.waitForTimeout(100);
log("focus back->(2,C1) via ArrowLeft:", await isFocused(cell(2, c1)));

log("--- Home/End ---");
const rowCount = await page.locator('button[data-col="0"]').count();
const lastRow = rowCount - 1;
await page.keyboard.press("End");
await page.waitForTimeout(100);
log("rowCount:", rowCount, "focus->last row via End:", await isFocused(cell(lastRow, c1)));
await page.keyboard.press("Home");
await page.waitForTimeout(100);
log("focus->row0 via Home:", await isFocused(cell(0, c1)));

log("--- Enter at bottom wraps to next column, row 0 ---");
await cell(lastRow, c1).click();
await page.keyboard.press("Enter");
await page.waitForTimeout(150);
log("focus->(0,C2) via Enter-wrap:", await isFocused(cell(0, c2)));

await page.screenshot({ path: `${OUT}/gb-keyboard.png` });

log("--- Escape on untouched C2 deletes it (no commits ever made to C2) ---");
await page.keyboard.press("Escape");
await page.waitForTimeout(500);
const afterEsc = await page.locator('button[data-row="0"]').count();
log("column count after Escape:", afterEsc, "expected:", afterC1);

await page.screenshot({ path: `${OUT}/gb-after-escape.png` });
await browser.close();
log("DONE");
