// 진단용 — 채팅 로그 DOM/폰트/역할 구분 실측.
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const PORT = process.env.PORT ?? "9888";
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "basic"));
await page.goto(`http://127.0.0.1:${PORT}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
const guest = page.getByTestId("login-guest");
if (await guest.isVisible().catch(() => false)) await guest.click();
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90_000 }).catch(() => {});
for (const label of ["건너뛰기", "닫기", "그만 보기"]) {
  const b = page.getByRole("button", { name: label }).first();
  if (await b.isVisible().catch(() => false)) await b.click().catch(() => {});
}
const restore = page.getByTestId("ai-collapsed-restore");
if (await restore.isVisible().catch(() => false)) await restore.click().catch(() => {});
await page.waitForTimeout(1200);

const input = page.getByTestId("ai-input");
await input.fill("테스트 지시");
await input.press("Enter");
await page.waitForTimeout(2500);

const dump = await page.evaluate(() => {
  const log = document.querySelector("[data-testid='ai-chat-log'], .ai-chat-log");
  const rows = [];
  const walk = (node, depth) => {
    if (depth > 4 || !(node instanceof HTMLElement)) return;
    for (const child of Array.from(node.children)) {
      const s = getComputedStyle(child);
      const r = child.getBoundingClientRect();
      rows.push({
        depth,
        tag: child.tagName.toLowerCase(),
        cls: child.className?.toString().slice(0, 90) ?? "",
        testid: child.dataset?.testid ?? null,
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        fontFamily: s.fontFamily.slice(0, 80),
        fontSize: s.fontSize,
        letterSpacing: s.letterSpacing,
        color: s.color,
        bg: s.backgroundColor,
        textAlign: s.textAlign,
        alignSelf: s.alignSelf,
        marginLeft: s.marginLeft,
        marginRight: s.marginRight,
        borderRadius: s.borderRadius,
        before: (() => {
          const b = getComputedStyle(child, "::before");
          return b.content && b.content !== "none" ? { content: b.content, fontFamily: b.fontFamily.slice(0, 60), color: b.color } : null;
        })(),
        text: (child.textContent ?? "").trim().slice(0, 70),
      });
      walk(child, depth + 1);
    }
  };
  if (log) walk(log, 0);

  const sendBtn = document.querySelector(".ai-chat-send");
  const sendInfo = sendBtn
    ? (() => {
        const s = getComputedStyle(sendBtn);
        const r = sendBtn.getBoundingClientRect();
        const icon = sendBtn.firstElementChild;
        const ir = icon?.getBoundingClientRect();
        return {
          rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
          html: sendBtn.innerHTML.slice(0, 200),
          overflow: s.overflow,
          padding: s.padding,
          gap: s.gap,
          fontFamily: s.fontFamily.slice(0, 80),
          scroll: [sendBtn.scrollWidth, sendBtn.clientWidth],
          iconRect: ir ? [Math.round(ir.x), Math.round(ir.y), Math.round(ir.width), Math.round(ir.height)] : null,
          iconFont: icon ? getComputedStyle(icon).fontFamily.slice(0, 60) : null,
        };
      })()
    : null;

  const ta = document.querySelector("[data-testid='ai-input']");
  const taStyle = ta ? getComputedStyle(ta) : null;

  return {
    logRows: rows,
    sendInfo,
    textarea: taStyle
      ? {
          rows: ta.getAttribute("rows"),
          minHeight: taStyle.minHeight,
          height: taStyle.height,
          inlineHeight: ta.style.height,
          padding: taStyle.padding,
          lineHeight: taStyle.lineHeight,
          scrollHeight: ta.scrollHeight,
          fontFamily: taStyle.fontFamily.slice(0, 80),
        }
      : null,
    bodyFont: getComputedStyle(document.body).fontFamily.slice(0, 120),
  };
});

writeFileSync("verify-shots/chat-probe/dom.json", JSON.stringify(dump, null, 2), "utf8");
console.log("bodyFont:", dump.bodyFont);
console.log("\n== send ==\n", JSON.stringify(dump.sendInfo, null, 2));
console.log("\n== textarea ==\n", JSON.stringify(dump.textarea, null, 2));
console.log("\n== log rows ==");
for (const r of dump.logRows) {
  console.log(
    `${"  ".repeat(r.depth)}${r.tag}.${r.cls || "-"}${r.testid ? `[${r.testid}]` : ""} rect=${JSON.stringify(r.rect)} font=${r.fontFamily} ls=${r.letterSpacing} bg=${r.bg} radius=${r.borderRadius} before=${r.before ? r.before.content : "-"} | ${r.text}`,
  );
}
await browser.close();
