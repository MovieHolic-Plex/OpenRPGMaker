// 대사창 고정 틀 — 화자 → 내레이션 → 선택지 → 화자 … 를 넘기는 동안 상자의 위·아래 줄이 움직이지 않는지 잰다.
// 픽스처: dialogue-frame-fixture.mts (DFRAME_WHICH=fallen|astra|firstlove) → .omo/runtime-qa/dframe/<which>.json
// 실행: DFRAME_WHICH=fallen npm run qa:runtime -- --scenario dialogue-frame --out verify-shots/runtime-qa/dialogue-frame-fallen
// 숫자 근거: 페이지 안 rAF 기록기가 매 프레임 상자 사각을 남긴다 → <out>/rects.json (비트 스크린샷은 약 0.2초 간격의 띠).
const which = process.env.DFRAME_WHICH ?? "fallen";
const [vw, vh] = (process.env.DFRAME_VP ?? "960x540").split("x").map(Number);
const outDir = process.env.DFRAME_OUT ?? `verify-shots/runtime-qa/dialogue-frame-${which}`;

// 매 프레임: 보이는 대사창(퇴장 중 제외, 선택지 질문 꼬리표 제외)의 위·아래·높이, 이름표·선택지·초상 유무, 위치 클래스.
const installRecorder = `() => {
  if (window.__dframeLog) return true;
  const log = [];
  const ids = new WeakMap(); let serial = 0;
  window.__dframeLog = log;
  const t0 = performance.now(); window.__dframeT0 = t0;
  const tick = () => {
    const overlay = document.querySelector('.dialogue-overlay');
    const boxes = [...document.querySelectorAll('.dialogue-overlay .dialogue-box')]
      .filter((b) => b.dataset.dialoguePhase !== 'exit' && !b.classList.contains('choices-prompt'));
    // 「상자」= 대사 틀. 선택지 동안은 틀(.choices-frame)이 상자 자리를 지키고, 선택지 칸은 따로 잰다.
    const panel = boxes.find((b) => b.classList.contains('choices'));
    const box = boxes.find((b) => b.classList.contains('choices-frame')) ?? boxes.at(-1);
    if (box && overlay && getComputedStyle(overlay).display !== 'none') {
      const r = box.getBoundingClientRect();
      const plate = box.querySelector('.speaker-nameplate, .speaker');
      const pr = plate ? plate.getBoundingClientRect() : null;
      log.push({
        t: Math.round(performance.now() - t0),
        id: ids.get(box) ?? (ids.set(box, ++serial), serial),
        kind: panel ? 'choices' : (box.classList.contains('has-speaker') ? 'speaker' : 'narration'),
        framed: box.classList.contains('choices-frame'),
        panel: panel && panel !== box ? (() => { const q = panel.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top), Math.round(q.right), Math.round(q.bottom)]; })() : null,
        reason: overlay.dataset.dialoguePositionReason ?? '',
        face: !!box.querySelector('.dialogue-face') || box.classList.contains('has-bust-face'),
        phase: box.dataset.dialoguePhase ?? '',
        pos: [...overlay.classList].find((c) => c.startsWith('position-')) ?? '',
        top: Math.round(r.top * 10) / 10, bottom: Math.round(r.bottom * 10) / 10,
        left: Math.round(r.left * 10) / 10, right: Math.round(r.right * 10) / 10,
        plateTop: pr ? Math.round(pr.top * 10) / 10 : null,
        text: ((panel ?? box).querySelector('.choice-list, .body')?.textContent ?? '').trim().slice(0, 24),
      });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return true;
}`;

// 다음 줄(타자 끝) 또는 선택지가 뜰 때까지 기다린다. 이벤트가 끝나 창이 없으면 그대로 돌아온다.
const waitReady = `async () => {
  for (let i = 0; i < 200; i += 1) {
    const choices = document.querySelector('[data-testid="runtime-choices"]');
    const box = [...document.querySelectorAll('.dialogue-overlay .dialogue-box')].find((b) => b.dataset.dialoguePhase !== 'exit');
    if (choices) { await new Promise((r) => setTimeout(r, 700)); return 'choices'; }
    if (box?.classList.contains('page-ready')) return 'ready';
    if (!box && i > 30) return 'none';
    await new Promise((r) => setTimeout(r, 100));
  }
  return 'timeout';
}`;

const frame = (id) => ({ id, note: id, ops: [{ kind: "hold", dir: null, ms: 200 }], shot: true });
const STEPS = Number(process.env.DFRAME_STEPS ?? 11);
// DFRAME_VIDEO=1: 영상용(QA_RECORD_VIDEO 와 함께) — 스크린샷 없이 창마다 읽는 시간만 두고 넘긴다.
const VIDEO = process.env.DFRAME_VIDEO === "1";
const VIDEO_READ_MS = Number(process.env.DFRAME_READ_MS ?? 900);
// DFRAME_FAST=1: 스타일 행렬용 — 창마다 준비 한 장 + Enter 만(숫자는 rAF 기록이 다 잰다).
const FAST = process.env.DFRAME_FAST === "1";
const fixture = process.env.DFRAME_FIXTURE ?? which;
const beats = [
  { id: "boot", note: "새 게임 → 시험 이벤트 첫 줄", ops: [
    { kind: "evalToFile", fn: installRecorder, out: "/tmp/dframe-install.json" },
    { kind: "pressUntil", key: "Enter", testid: "title-screen", state: "absent", maxPresses: 4, timeoutMs: 60000 },
    { kind: "evalToFile", fn: `async () => { for (let i = 0; i < 1800; i += 1) { if (document.querySelector('.dialogue-overlay .dialogue-box')) return true; await new Promise((r) => setTimeout(r, 100)); } return false; }`, out: "/tmp/dframe-boot.json" },
  ], shot: false },
];
for (let s = 1; s <= STEPS; s += 1) {
  const p = String(s).padStart(2, "0");
  beats.push({ id: `s${p}-ready`, note: `${s}번째 창 준비`, ops: [{ kind: "evalToFile", fn: waitReady, out: `/tmp/dframe-ready-${s}.json` }], shot: !VIDEO });
  if (VIDEO) {
    beats.push({ id: `s${p}-advance`, note: "읽고 Enter", ops: [{ kind: "hold", dir: null, ms: VIDEO_READ_MS }, { kind: "key", key: "Enter" }], shot: false });
    continue;
  }
  if (FAST) {
    beats.push({ id: `s${p}-advance`, note: "Enter", ops: [{ kind: "hold", dir: null, ms: 300 }, { kind: "key", key: "Enter" }], shot: false });
    continue;
  }
  beats.push(frame(`s${p}-f1`), frame(`s${p}-f2`));
  beats.push({ id: `s${p}-advance`, note: "Enter", ops: [{ kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 200 }], shot: true });
  beats.push(frame(`s${p}-f3`));
}
beats.push({ id: "dump", note: "프레임 기록 저장", ops: [
  { kind: "evalToFile", fn: "() => window.__dframeLog ?? []", out: `${outDir}-rects.json` },
  // 영상 자르기용: 기록기 0초가 페이지 시계(navigation 기준)로 몇 ms 인가.
  { kind: "evalToFile", fn: "() => ({ t0: window.__dframeT0 ?? null, now: performance.now() })", out: `${outDir}-t0.json` },
], shot: false });

export default {
  id: `dialogue-frame-${fixture}`,
  projectFixture: `.omo/runtime-qa/dframe/${fixture}.json`,
  viewport: { width: vw, height: vh },
  beats,
};
