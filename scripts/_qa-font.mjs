import { chromium } from "@playwright/test";
const b = await chromium.launch({ args: ["--no-sandbox","--use-gl=swiftshader","--disable-gpu"] });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
await p.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode","basic"));
await p.goto("http://127.0.0.1:9988/?freshProject=1", { waitUntil:"domcontentloaded", timeout:60000 });
const g = p.getByTestId("login-guest"); if (await g.isVisible().catch(()=>false)) await g.click();
await p.getByTestId("edit-canvas").waitFor({state:"visible",timeout:90000}).catch(()=>{});
for (const l of ["건너뛰기","닫기","그만 보기"]) { const x=p.getByRole("button",{name:l}).first(); if (await x.isVisible().catch(()=>false)) await x.click().catch(()=>{}); }
const r = p.getByTestId("ai-collapsed-restore"); if (await r.isVisible().catch(()=>false)) await r.click().catch(()=>{});
await p.waitForTimeout(1200);
const out = await p.evaluate(() => {
  const mk = (font, size) => { const s=document.createElement("span"); s.style.cssText=`position:absolute;visibility:hidden;white-space:pre;font:${size}px ${font}`; s.textContent="테스트 지시"; document.body.append(s); const w=s.getBoundingClientRect().width; s.remove(); return Math.round(w*10)/10; };
  const mono = getComputedStyle(document.querySelector(".ai-chat-panel")||document.body);
  const tok = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim();
  // 개별 글자 advance — 모노 폴백이면 한글 폭이 전부 동일
  const probe = (font) => { const out=[]; for (const ch of "테스가힣A") { const s=document.createElement("span"); s.style.cssText=`position:absolute;visibility:hidden;white-space:pre;font:14px ${font}`; s.textContent=ch; document.body.append(s); out.push(Math.round(s.getBoundingClientRect().width*10)/10); s.remove(); } return out; };
  return {
    tokenFontMono: tok,
    widthMono: mk(tok, 14),
    widthBody: mk('system-ui, Pretendard, "Apple SD Gothic Neo", sans-serif', 14),
    advMono: probe(tok),
    advBody: probe('system-ui, Pretendard, "Apple SD Gothic Neo", sans-serif'),
    fontsCheck: { cascadia: document.fonts.check('14px "Cascadia Mono"'), jetbrains: document.fonts.check('14px "JetBrains Mono"'), cascadiaKo: document.fonts.check('14px "Cascadia Mono"', "테스트") },
  };
});
console.log(JSON.stringify(out,null,2));
await b.close();
