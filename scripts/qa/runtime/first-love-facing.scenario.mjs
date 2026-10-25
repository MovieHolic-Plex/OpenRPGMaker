// 『첫사랑』 바라보는 방향 기록 — first-love 시나리오의 경로(FL_PATH=A|B|C)를 체크포인트 d1-arrive(월요일 승강장,
// 오프닝 뒤)에서 시작해 끝까지 돌며, 대사가 바뀔 때마다 한 장·인물이 걷는 동안 0.2초마다 한 장을 찍고 배우 배치를 남긴다.
// 실행: FL_PATH=A FL_VP=480x270 node scripts/qa/runtime/fl-play.mjs --scenario first-love-facing --checkpoint d1-arrive --parallel 1 --out verify-shots/runtime-qa/fl-facing-A
// 판정: node scripts/qa/runtime/facing-audit.mjs verify-shots/runtime-qa/fl-facing-A/d1-arrive
import base from "./first-love.scenario.mjs";

const SKIP = new Set(["title", "opening-1", "opening-2", "opening-4", "state"]);
const frameMs = Number(process.env.FL_FRAME_MS ?? 200);

function convert(beat) {
  if (SKIP.has(beat.id) || beat.id.startsWith("menu-")) return null;
  const ops = [];
  for (const op of beat.ops) {
    if (op.kind === "pressUntilJs" && (op.key ?? "Enter") === "Enter") {
      ops.push({ kind: "recordUntilJs", key: "Enter", fn: op.fn, maxPresses: op.maxPresses ?? 60, frameMs, dir: beat.id });
      continue;
    }
    if (op.kind === "pressUntilJs" && op.key === "Escape") continue; // 오프닝 넘기기
    // 문을 밟은 뒤의 긴 쉼(1.4초)은 기록하지 않고 지나가 버린다 — 문이 열리고 닫히는 장면을 기록기가 찍도록 뺀다.
    // 엔딩 화면은 예외 — 쉼이 있어야 검은 첫 장 대신 엔딩 카드(배지·제목)를 찍는다(VQA r10 「엔딩 카드 없음」은 이 쉼을 뺀 탓).
    if (op.kind === "hold" && op.dir === null && (op.ms ?? 0) >= 1400 && !beat.id.startsWith("ending-")) continue;
    if (op.kind === "waitFor" && op.testid === "dialogue-box") {
      // 문을 밟은 뒤 첫 대사까지(걷기·돌아서기)도 기록한다.
      ops.push({ kind: "recordUntilJs", key: "Enter", fn: "() => !!document.querySelector(\"[data-testid='dialogue-box']\")", maxPresses: 0, frameMs, dir: beat.id });
      continue;
    }
    ops.push(op);
  }
  return { ...beat, ops };
}

const beats = base.beats.map(convert).filter(Boolean);
beats.unshift({ id: "boot", note: "체크포인트 부팅", ops: [{ kind: "waitForRuntime", timeoutMs: 120000 }], shot: false });

export default {
  ...base,
  id: `${base.id}-facing`,
  checkpointSet: "first-love",
  checkpointBeats: (checkpoint) => (checkpoint.id === "d1-arrive" ? beats : undefined),
  beats,
};
