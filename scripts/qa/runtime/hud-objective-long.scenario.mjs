// 긴 「현재 목표」 줄이 HUD 에서 다 읽히는지(2026-10-29 vm3 argon jrpg 판정 major 「목표 문구가 '동굴 입구를 막고 있는 결계를 푼다 (' 까지만 보임」).
//
//   QA_OUT=<폴더> QA_TALK_AT=x,y,dir node scripts/runtime-qa.mjs --scenario hud-objective-long --project <vm3 argon jrpg web.json> --netns
//
// 1-start / 2-after : 목표 줄 글·보이는 글(innerText)·상자 크기·넘침(scroll vs client)·화면 안에 다 들어오는지.
const OUT = process.env.QA_OUT ?? "/tmp/hud-objective-long";
const MAP = process.env.QA_MAP ?? "map_blank_start";
const [tx, ty, tdir] = (process.env.QA_TALK_AT ?? "4,12,up").split(",");
const probe = `() => {
  const el = document.querySelector(".zone-feedback-objective");
  if (!el || el.hidden) return { objective: null };
  const r = el.getBoundingClientRect(); const stage = (el.closest(".play-stage, [data-testid='play-stage']") ?? document.body).getBoundingClientRect();
  const cs = getComputedStyle(el);
  return { text: el.textContent, visibleText: el.innerText, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    stage: { x: Math.round(stage.x), y: Math.round(stage.y), w: Math.round(stage.width), h: Math.round(stage.height) },
    overflowX: el.scrollWidth - el.clientWidth, overflowY: el.scrollHeight - el.clientHeight, whiteSpace: cs.whiteSpace, textOverflow: cs.textOverflow, overflow: cs.overflow,
    maxWidth: cs.maxWidth, maxHeight: cs.maxHeight, lineClamp: cs.webkitLineClamp, inside: r.right <= stage.right + 1 && r.bottom <= stage.bottom + 1 && r.x >= stage.x - 1 };
}`;
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const hudObjectiveLongScenario = {
  id: "hud-objective-long",
  beats: [
    { id: "start", note: "새 게임 → 시작 목표", ops: [
      { kind: "pressUntilJs", key: "Enter", fn: "() => !document.querySelector(\"[data-testid='title-screen']\")", maxPresses: 4, settleMs: 2500 },
      { kind: "waitForRuntime", timeoutMs: 240000 },
      { kind: "pressUntilJs", key: "Escape", fn: "() => !/건너뛰기/.test(document.body.innerText)", maxPresses: 6, settleMs: 900 },
      { kind: "pressUntilJs", key: "Enter", fn: "() => !document.querySelector('.dialogue-overlay .dialogue-box')", maxPresses: 40, settleMs: 700 },
      { kind: "hold", dir: null, ms: 1200 },
      { kind: "evalToFile", out: `${OUT}/1-start.json`, fn: probe },
    ], shot: true },
    { id: "after", note: "촌장과 대화 → 긴 목표", ops: [
      { kind: "teleport", mapId: MAP, x: Number(tx), y: Number(ty) }, { kind: "face", dir: tdir }, { kind: "action" },
      { kind: "pressUntilJs", key: "Enter", fn: "() => !document.querySelector('.dialogue-overlay .dialogue-box')", maxPresses: 40, settleMs: 700 },
      { kind: "hold", dir: null, ms: 1200 },
      { kind: "evalToFile", out: `${OUT}/2-after.json`, fn: probe },
    ], shot: true },
  ],
};
