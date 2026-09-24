import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const executablePath = process.env.POINTBACK_BROWSER_PATH ?? "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge";
test("React JSX maps DOM to source only in development", { skip: !existsSync(executablePath) && "Set POINTBACK_BROWSER_PATH to Chromium" }, async () => {
  const root = join(process.cwd(), "examples/react-vite");
  const vite = spawn(join(process.cwd(), "node_modules/.bin/vite"), ["--host", "127.0.0.1", "--port", "5196", "--strictPort"], { cwd: root, stdio: "pipe" });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch("http://127.0.0.1:5196/")).ok) { ready = true; break; } } catch { /* Starting. */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage();
    await page.goto("http://127.0.0.1:5196/");
    const theme = await page.evaluate(() => ({
      page: getComputedStyle(document.documentElement).backgroundColor,
      menu: getComputedStyle(document.querySelector("pointback-overlay")!.shadowRoot!.querySelector("#panel")!).backgroundColor,
    }));
    assert.equal(theme.page, "rgb(16, 23, 34)");
    assert.equal(theme.menu, "rgb(18, 30, 45)");
    const heading = page.locator("h1[data-pointback-id='hero-title']");
    assert.equal(await heading.textContent(), "Pointback");
    assert.match(await page.locator(".local-badge").textContent() ?? "", /Local only/);
    assert.match(await page.locator(".site-footer").textContent() ?? "", /No Pointback cloud/);
    const watermark = await page.locator(".hero-copy").evaluate((element) => ({
      image: getComputedStyle(element, "::before").backgroundImage,
      opacity: Number(getComputedStyle(element, "::before").opacity),
    }));
    assert.match(watermark.image, /pointback-icon\.svg/);
    assert.ok(watermark.opacity > 0 && watermark.opacity < 0.2, "the hero icon stays muted");
    const headerBox = await page.locator(".site-header").boundingBox();
    const previewBox = await page.locator(".preview-panel").boundingBox();
    assert.ok(headerBox && previewBox && previewBox.y - (headerBox.y + headerBox.height) <= 60, "hero top spacing stays compact");
    assert.notEqual(await page.locator(".preview-panel").evaluate((panel) => getComputedStyle(panel).transform), "none", "preview keeps its subtle tilt");
    assert.equal(await page.locator('link[rel="icon"]').getAttribute("href"), "/pointback-icon.svg");
    assert.equal(await page.locator(".brand img").evaluate((image) => (image as HTMLImageElement).naturalWidth > 0), true);
    assert.equal(await page.locator("#preview-feedback").inputValue(), "lol? what is this. just use the same layout as this popup I'm writing with. Prefill with this exact text");
    assert.equal(await page.locator(".preview-grid").count(), 0, "the invented dashboard preview is gone");
    assert.equal(await page.locator(".popup-modes").textContent(), "ElementRegionPage");
    assert.equal(await page.locator("[data-pointback-id='profile-save']").count(), 0, "placeholder Save button is removed");
    assert.match(await page.locator("#why-pointback").textContent() ?? "", /Review the real app/);
    assert.match(await page.locator("#use-cases").textContent() ?? "", /Responsive layouts/);
    assert.match(await page.locator(".hero-footnote").textContent() ?? "", /HMR you already use/);
    assert.match(await page.locator("#how-it-works").textContent() ?? "", /existing HMR setup/);
    assert.doesNotMatch(await page.locator(".site-shell").textContent() ?? "", /Vite/);
    const source = await heading.getAttribute("data-pointback-source");
    assert.match(source ?? "", /^src\/main\.tsx:\d+:\d+$/);
    assert.equal(await heading.getAttribute("data-pointback-component"), "App");
    await page.locator(".primary-cta").click();
    assert.equal(await page.locator("pointback-overlay").locator("#panel").isVisible(), true);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await heading.isVisible(), true);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "tilted preview fits mobile width");
    const production = readdirSync(join(root, "dist/assets")).filter((file) => file.endsWith(".js")).map((file) => readFileSync(join(root, "dist/assets", file), "utf8")).join("\n");
    assert.doesNotMatch(production, /data-pointback-(source|component)/);
  } finally { await browser?.close(); vite.kill(); }
});
