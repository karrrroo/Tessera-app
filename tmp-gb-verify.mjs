import { chromium } from "playwright";

const OUT = "C:/Users/Home2026/AppData/Local/Temp/claude/c--Users-Home2026-Desktop-tessera/cbef404f-0dac-450f-96ce-31176f27d9d8/scratchpad";
const BASE = "http://localhost:3000";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
page.on("pageerror", (err) => console.log("[pageerror]", err.message));

await page.goto(`${BASE}/login`, { waitUntil: "load" });
await page.getByText("Ուսուցիչ՝ Ա. Սարգսյան", { exact: true }).click();
await page.waitForURL("**/overview", { timeout: 5000 });
await page.goto(`${BASE}/gradebook`, { waitUntil: "load" });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/gb-initial.png` });
console.log("url:", page.url());

const pillTexts = await page.locator("button").allTextContents();
console.log("pills/buttons found:", pillTexts.slice(0, 10));

await browser.close();
