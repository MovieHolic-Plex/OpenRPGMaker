// 『폴른 스타』 첫 10분 — 타이틀 → 오프닝(건너뛰지 않고 컷마다 한 장) → 포고 → 하넬 → 숲 → 은빛 관 퍼즐 → 이리스 → (보스 시작까지).
// 오프닝 뒤 구간은 fallen-audit 의 비트를 그대로 쓴다(같은 출입구·같은 대사 판정).
import audit from "./fallen-audit.scenario.mjs";

const opening = [
  { id: "op-1-town", note: "오프닝 ① 밤의 도시", ops: [{ kind: "pressUntil", key: "Enter", testid: "cinematic-sequence", state: "present", maxPresses: 4, timeoutMs: 12000 }, { kind: "hold", dir: null, ms: 3000 }], shot: true },
  { id: "op-2-fall", note: "오프닝 ② 떨어지는 별", ops: [{ kind: "hold", dir: null, ms: 7000 }], shot: true },
  { id: "op-3-obs", note: "오프닝 ③ 천문대", ops: [{ kind: "hold", dir: null, ms: 6500 }], shot: true },
  { id: "op-4-crash", note: "오프닝 ④ 추락지(관으로 다가감)", ops: [{ kind: "hold", dir: null, ms: 9300 }], shot: true },
  { id: "op-5-morning", note: "오프닝 ⑤ 아침", ops: [{ kind: "hold", dir: null, ms: 4200 }], shot: true },
  { id: "boot", note: "오프닝 끝 → 광장", ops: [
    { kind: "pressUntil", key: "Escape", testid: "cinematic-sequence", state: "absent", maxPresses: 6 },
    { kind: "waitForRuntime", timeoutMs: 120000 }, { kind: "hold", dir: null, ms: 1500 },
  ], shot: true },
];
const rest = audit.beats.filter((b) => b.id !== "title" && b.id !== "boot");
const stop = rest.findIndex((b) => b.id === (process.env.FS_FIRST10_STOP ?? "battle"));
export default {
  ...audit,
  id: "fallen-first10",
  beats: [audit.beats[0], ...opening, ...(stop >= 0 ? rest.slice(0, stop + 1) : rest)],
};
