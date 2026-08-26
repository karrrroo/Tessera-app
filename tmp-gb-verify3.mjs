import { chromium } from "playwright";

const OUT = "C:/Users/Home2026/AppData/Local/Temp/claude/c--Users-Home2026-Desktop-tessera/cbef404f-0dac-450f-96ce-31176f27d9d8/scratchpad";
const BASE = "http://localhost:3000";
const log = (...a) => console.log(...a);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const page = await context.newPage();
page.on("pageerror", (err) => log("[pageerror]", err.message));
page.on("console", (msg) => { if (msg.type() === "error" && !msg.text().includes("401")) log("[console.error]", msg.text()); });

await page.goto(`${BASE}/login`, { waitUntil: "load" });
await page.getByText("Ուսուցիչ՝ Ա. Սարգսյան", { exact: true }).click();
await page.waitForURL("**/gradebook*", { timeout: 5000 });
await page.waitForTimeout(1500);

const cell = (row, col) => page.locator(`button[data-row="${row}"][data-col="${col}"]`);
const plusBtn = page.locator("button[title]").filter({ hasText: "+" });

log("=== PUBLISH DIALOG ===");
await plusBtn.click();
await page.waitForTimeout(400);
const colCount = await page.locator('button[data-row="0"]').count();
const newCol = colCount - 1;
await cell(0, newCol).click();
await page.keyboard.press("8");
await page.waitForTimeout(150);
await cell(1, newCol).click();
await page.keyboard.press("6");
await page.waitForTimeout(700); // let the flush debounce fire so drafts are on the server
log("draft banner text:", await page.locator("text=/[0-9]+ /").first().textContent().catch(() => "(not found)"));

const sendBtn = page.locator("button").filter({ hasText: /^(Հրապարակել|Publish|Опубликовать)$/ }).first();
await sendBtn.click();
await page.waitForTimeout(300);
const dialogVisible = await page.locator('[role="dialog"]').isVisible().catch(() => false);
log("publish dialog visible:", dialogVisible);
if (dialogVisible) {
  const dialogText = await page.locator('[role="dialog"]').textContent();
  log("publish dialog text:", dialogText);
  await page.screenshot({ path: `${OUT}/gb-publish-dialog.png` });
  const confirmBtn = page.locator('[role="dialog"] button').last();
  await confirmBtn.click();
  await page.waitForTimeout(600);
  log("dialog closed after confirm:", !(await page.locator('[role="dialog"]').isVisible().catch(() => false)));
  await page.screenshot({ path: `${OUT}/gb-after-publish.png` });
  // check no toast appeared (GB roadmap: sweep with no toast)
  const toastCount = await page.locator('[role="status"], [role="alert"], .toast').count();
  log("toast-like elements after publish (should be 0):", toastCount);
}

log("=== SUPERSEDE DIALOG ===");
// the cell we just published (row0,newCol) should now be published (isPublished -> click opens correction)
await cell(0, newCol).click();
await page.waitForTimeout(300);
const supersedeDialogVisible = await page.locator('[role="dialog"]').isVisible().catch(() => false);
log("supersede dialog opened on published-cell click:", supersedeDialogVisible);
if (supersedeDialogVisible) {
  await page.screenshot({ path: `${OUT}/gb-supersede-dialog.png` });
  const saveBtn = page.locator('[role="dialog"] button').last();
  const disabledBeforeReason = await saveBtn.isDisabled();
  log("save button disabled with no reason/no value change:", disabledBeforeReason);
  // pick a different value
  await page.locator('[role="dialog"] button').filter({ hasText: "3" }).first().click();
  const stillDisabledNoReason = await saveBtn.isDisabled();
  log("still disabled with value changed but no reason:", stillDisabledNoReason);
  await page.locator('[role="dialog"] textarea').fill("Great error correction test");
  const enabledNow = await saveBtn.isDisabled();
  log("enabled once reason provided (isDisabled should be false):", enabledNow);
  await saveBtn.click();
  await page.waitForTimeout(600);
  log("supersede dialog closed:", !(await page.locator('[role="dialog"]').isVisible().catch(() => false)));
  await page.screenshot({ path: `${OUT}/gb-after-supersede.png` });
}

log("=== CELL HISTORY SHEET ===");
const historyIcon = page.locator('span[aria-label="history"]').first();
const historyExists = (await historyIcon.count()) > 0;
log("a history (pencil) icon exists after supersede:", historyExists);
if (historyExists) {
  await historyIcon.click();
  await page.waitForTimeout(400);
  const sheetVisible = await page.locator('[role="dialog"]').isVisible().catch(() => false);
  log("cell history sheet visible:", sheetVisible);
  if (sheetVisible) {
    const sheetText = await page.locator('[role="dialog"]').textContent();
    log("history sheet text:", sheetText);
    await page.screenshot({ path: `${OUT}/gb-history-sheet.png` });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    log("history sheet closed via Escape:", !(await page.locator('[role="dialog"]').isVisible().catch(() => false)));
  }
}

await browser.close();
log("DONE");
