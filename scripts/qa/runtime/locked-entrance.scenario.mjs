// 들어갈 수 없는 건물 입구의 한 줄은 조사 키에만 답한다 — 문에 부딪힐 때마다 대사창이 뜨지 않는다.
// 픽스처·좌표: scripts/qa/runtime/locked-entrance-fixture.mts (좌표 파일 RUNTIME_QA_POINTS, 기본 /tmp/locked-entrance/project.json.points.json)
// 주인공은 문 앞 칸에서 시작한다: 문 쪽으로 두 번 밀어 보고(대사창 없음) → 조사 키(대사창) → 닫는다.
// 접촉(playerTouch)으로 세운 옛 픽스처를 주면 같은 걸음에서 무엇이 달랐는지를 그대로 적는다(밀 때마다 대사창, 조사 키에는 무응답).
import { readFileSync } from "node:fs";

const at = JSON.parse(readFileSync(process.env.RUNTIME_QA_POINTS ?? "/tmp/locked-entrance/project.json.points.json", "utf8"));
const here = { mapId: at.mapId, x: at.front.x, y: at.front.y };
const onBump = at.trigger === "playerTouch";
const shown = { ...here, testidPresent: ["dialogue-box"], textPresent: [at.line] };
const quiet = { ...here, testidAbsent: ["dialogue-box"] };
const close = [{ kind: "key", key: "Enter" }, { kind: "key", key: "Enter" }, { kind: "waitFor", testid: "dialogue-box", state: "absent" }];
const push = [{ kind: "hold", dir: "up", ms: 900 }];
const beats = [
  { id: "boot", note: "타이틀 넘기기 — 문 앞 칸에서 시작", ops: [{ kind: "key", key: "Enter" }, { kind: "waitFor", testid: "title-screen", state: "absent" }, { kind: "waitForRuntime" }, { kind: "waitForPosition", ...here, timeoutMs: 15000 }], expect: quiet, shot: true },
  { id: "push-1", note: `문 (${at.door.x},${at.door.y}) 쪽으로 민다`, ops: push, expect: onBump ? shown : quiet, shot: true },
  ...(onBump ? [{ id: "push-1-close", note: "대사창 닫기", ops: close, expect: quiet, shot: false }] : []),
  { id: "push-2", note: "다시 민다", ops: push, expect: onBump ? shown : quiet, shot: true },
  ...(onBump ? [{ id: "push-2-close", note: "대사창 닫기", ops: close, expect: quiet, shot: false }] : []),
  { id: "action", note: "문을 보고 조사 키", ops: [{ kind: "face", dir: "up" }, { kind: "action" }, { kind: "hold", dir: null, ms: 600 }], expect: onBump ? quiet : shown, shot: true },
];
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const lockedEntranceScenario = { id: "locked-entrance", beats };
