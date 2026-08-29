// 진단용 — 패널 자식 트리 + flex 기여도. 도크별 컨테인먼트 차이를 본다.
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const PORT = process.env.PORT ?? "9988";
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "basic"));
await page.goto(`http://127.0.0.1:${PORT}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
const g = page.getByTestId("login-guest");
if (await g.isVisible().catch(() => false)) await g.click();
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 }).catch(() => {});
for (const l of ["건너뛰기", "닫기", "그만 보기"]) {
  const b = page.getByRole("button", { name: l }).first();
  if (await b.isVisible().catch(() => false)) await b.click().catch(() => {});
}
const r = page.getByTestId("ai-collapsed-restore");
if (await r.isVisible().catch(() => false)) await r.click().catch(() => {});
await page.waitForTimeout(1200);
const input = page.getByTestId("ai-input");
await input.fill("테스트 지시");
await input.press("Enter");
await page.waitForTimeout(2600);

const tree = () =>
  page.evaluate(() => {
    const lines = [];
    const walk = (node, depth) => {
      if (depth > 3) return;
      for (const c of Array.from(node.children)) {
        const s = getComputedStyle(c);
        const b = c.getBoundingClientRect();
        if (s.display === "none") {
          lines.push(`${"  ".repeat(depth)}${c.tagName.toLowerCase()}.${(c.className || "").toString().split(" ")[0]} — display:none`);
          continue;
        }
        lines.push(
          `${"  ".repeat(depth)}${c.tagName.toLowerCase()}.${(c.className || "").toString().split(" ").slice(0, 2).join(".")}` +
            ` y=${Math.round(b.y)} h=${Math.round(b.height)}` +
            ` flex=${s.flexGrow}/${s.flexShrink}/${s.flexBasis} minH=${s.minHeight} maxH=${s.maxHeight}` +
            ` pos=${s.position} ovf=${s.overflowY}` +
            (c.dataset?.testid ? ` [${c.dataset.testid}]` : ""),
        );
        walk(c, depth + 1);
      }
    };
    const panel = document.querySelector("[data-testid='ai-panel']");
    const ps = getComputedStyle(panel);
    lines.unshift(
      `PANEL h=${Math.round(panel.getBoundingClientRect().height)} display=${ps.display} dir=${ps.flexDirection} dock=${panel.dataset.chatDock}`,
    );
    walk(panel, 0);
    return lines.join("\n");
  });

const out = [];
out.push("########## dock=glass\n" + (await tree()));
for (let i = 0; i < 2; i += 1) {
  await page.getByTestId("chat-dock-toggle").evaluate((n) => n.click());
  await page.waitForTimeout(900);
  const dock = await page.getByTestId("ai-panel").getAttribute("data-chat-dock");
  out.push(`########## dock=${dock}\n` + (await tree()));
}
const text = out.join("\n\n");
writeFileSync("verify-shots/shell-consistency/tree.txt", text, "utf8");
console.log(text);
await browser.close();
