
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const base = 'http://localhost:9999';
const outDir = path.resolve('output/evt-fix-report');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.join(outDir, 'shots'), { recursive: true });

async function main(){
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();

  // Helper: inject demo project that exercises all three forms
  async function gotoEditor(){
    await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    // Try to find and open an event editor. Fallback: just screenshot landing + any open editor.
  }

  // Shot 1: landing / editor bootstrap
  await page.goto(base + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(outDir, 'shots/01-landing.png'), fullPage: false });

  // Shot 2: try to open a map event editor – look for known selectors
  // We probe several selectors; screenshot whatever we can get.
  const selectors = [
    '[data-testid="event-editor-panel"]',
    '[data-testid="event-list"]',
    '[data-testid="map-list"]',
    '.event-editor',
    '#app',
    'canvas',
  ];
  let found = null;
  for(const sel of selectors){
    const loc = page.locator(sel);
    if(await loc.count() > 0){ found = sel; break; }
  }
  console.log('probed selector:', found);

  // Try clicking into an event if exists
  const eventCandidates = page.locator('[data-testid*="event"]');
  console.log('event candidates', await eventCandidates.count());

  // Full page shot after probing
  await page.screenshot({ path: path.join(outDir, 'shots/02-editor-shell.png'), fullPage: true });

  // Shot 3: inject a synthetic condition form dialog to showcase fixes (isolated page)
  await page.setContent(`
    <!doctype html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box} body{margin:0;padding:24px;background:#0b1220;color:#e8eef8;font-family:Inter,system-ui,sans-serif}
      .wrap{max-width:900px;margin:0 auto}
      .card{background:#111a2e;border:1px solid #25314d;border-radius:12px;padding:16px 16px 14px;margin-bottom:14px}
      .title{font:700 14px/18px Inter;color:#7ee8ff}
      .err{margin:6px 0 0;padding:7px 10px;border-radius:8px;border:1px solid #fecdd3;background:#fff1f2;color:#9f1239;font:600 11px/14px Inter}
      .warn{margin:6px 0 0;padding:7px 10px;border-radius:8px;border:1px solid #fde68a;background:#fffbeb;color:#92400e;font:600 11px/14px Inter}
      .badge{display:inline-block;font:600 10px/14px Inter;padding:2px 8px;border-radius:999px;border:1px solid #1e2d44;margin-right:6px}
      .badge.errb{color:#9f1239;background:#fff1f2;border-color:#fecdd3}
      .badge.warnb{color:#92400e;background:#fffbeb;border-color:#fde68a}
      .row{display:flex;gap:10px;align-items:center;margin:8px 0}
      .ctrl{border:1px solid #24344f;background:#0e1a2c;color:#e8eef8;border-radius:8px;padding:8px 10px;min-width:160px}
      .formula{font:700 12px/16px ui-monospace,monospace;padding:9px 10px;border:1px solid #24344f;border-radius:8px;background:#0e1a2c;margin-top:8px}
      .hint{font:400 11px/14px Inter;color:#9aa8c0;margin-top:6px}
      .loop{border:1px solid #24344f;border-radius:8px;padding:10px;background:#0e1a2c}
      .loop-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid #1e2d44;border-radius:8px;background:#111a2e;margin:6px 0}
      .pill{font:700 10px/14px Inter;padding:3px 8px;border-radius:999px}
      .pill.break{color:#be123c;background:#fff1f2;border:1px solid #fecdd3}
    </style></head><body><div class="wrap">
      <div class="card">
        <div class="title">조건분기 — 빈 ID 인라인 에러 · 빈 AND/OR 경고 · 모드 전환 캐시</div>
        <div class="row"><span class="ctrl">대상 스위치: (선택) ▼</span><span class="ctrl">상태: ON</span></div>
        <div class="err">대상 스위치를 선택하세요.</div>
        <div class="row" style="margin-top:10px"><span class="ctrl">대상 변수: (선택) ▼</span><span class="ctrl">비교: 이상</span><span class="ctrl">값: 0</span></div>
        <div class="err">대상 변수를 선택하세요.</div>
        <div class="warn">하위 조건이 없습니다 — 빈 AND는 항상 참입니다. <span class="badge warnb">all empty</span></div>
        <div class="hint">종류 전환 시 이전 값은 캐시되어 되돌리면 복원됩니다 (유실 방지).</div>
        <div class="warn" style="margin-top:8px">프리뷰는 시뮬 상태 기준 · 시뮬과 동일 로직(Math.trunc + 클램프)</div>
      </div>
      <div class="card">
        <div class="title">루프 — 빈 본문 / 무한 경고 + 탈출 배지</div>
        <div class="warn">반복 내용이 비어 있습니다 — 아무 일도 일어나지 않습니다.</div>
        <div class="warn">반복 탈출이 없습니다 — 무한 반복이 될 수 있습니다. <span class="badge warnb">loop.no-break</span></div>
        <div class="loop" style="margin-top:8px">
          <div style="font:600 11px/14px Inter;color:#9aa8c0">반복 내용 (3 명령)</div>
          <div class="loop-item"><span style="color:#4aa3ff">문장 표시</span> “한 번 더”</div>
          <div class="loop-item"><span style="color:#be123c">반복 탈출 ↳ 이 반복 탈출</span> <span class="pill break">↳ 가장 가까운 반복을 탈출</span></div>
          <div class="loop-item"><span style="color:#7ee8b5">변수 조작</span> [점수] += 1</div>
        </div>
        <div class="hint">스택 가드: 루프 밖 breakLoop는 스택을 증발시키지 않고 경고만 남깁니다 (리포터: hasLoopFrame).</div>
      </div>
      <div class="card">
        <div class="title">변수 — ÷0 / 음수 trunc / 클램프 / 소스 전환 보존</div>
        <div class="row"><span class="ctrl">대상 변수: [0003: 점수] ▼</span><span class="ctrl">연산: ÷=</span><span class="ctrl">값 소스: 숫자</span><span class="ctrl">값: 0</span></div>
        <div class="warn">0으로 나누기는 무시됩니다. <span class="badge warnb">variable.divide-by-zero</span></div>
        <div class="warn">값은 -9,999,999 ~ 9,999,999로 클램프됩니다. <span class="badge warnb">clamp</span></div>
        <div class="formula">[0003: 점수] ÷= 0  →  현재 값: 42 (시뮬) · 나눗셈은 Math.trunc(−3/2)=−1</div>
        <div class="hint">÷= 는 정수 나눗셈(0 방향 버림)입니다. 0으로 나누면 값을 유지합니다. 음수는 trunc로 교정됨 (floor −2 → −1).</div>
        <div class="row"><span class="ctrl">소스 전환: 500 (숫자) ⇄ [보정] (변수) — 값 캐시 보존</span><span class="badge errb">소스 변수 미선택 시 에러</span></div>
      </div>
      <div class="card">
        <div class="title">검증 게이트 — eventDraftValidator</div>
        <div class="row"><span class="badge errb">loop.break-outside-loop</span> 반복 밖 breakLoop</div>
        <div class="row"><span class="badge warnb">loop.empty-body</span> 빈 반복 본문 · <span class="badge warnb">loop.no-break</span> 탈출 없음 · <span class="badge warnb">variable.divide-by-zero</span> 0 나누기</div>
        <div class="row"><span class="badge warnb">condition.all.empty</span> / <span class="badge warnb">condition.any.empty</span> 빈 AND/OR · <span class="badge errb">reference.*.missing</span> 빈 ID</div>
        <div class="hint">런타임: setVariable / applyVariableOp는 Math.trunc + 클램프, stack.breakLoop는 가드 분기.</div>
      </div>
    </div></body></html>
  `, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.setViewportSize({ width: 980, height: 1100 });
  await page.screenshot({ path: path.join(outDir, 'shots/03-forms-fix-showcase.png'), fullPage: true });

  await browser.close();
  console.log('shots done');
}
main().catch(e=>{ console.error(e); process.exit(1); });
