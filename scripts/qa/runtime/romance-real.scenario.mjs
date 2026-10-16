// 조수(실제 Argon)가 지은 연애 한 편을 출하 플레이어로 걷는다 — 타이틀 → 교정 필드(HUD·NPC) → NPC 옆 → 대화 → 닫기 → ESC → 실내 맵 순간이동.
// 입력: output/qa/romance-real-<id>/{project,proof}.json (scripts/qa/romance-real/proof.mts). 저작 내용 쓰기 없음.
import fs from "node:fs";
import path from "node:path";
const flag = process.argv.indexOf("--project");
const projectFixture = flag >= 0 ? process.argv[flag + 1] : "output/qa/romance-real/project.json";
const proof = JSON.parse(fs.readFileSync(path.join(path.dirname(projectFixture), "proof.json"), "utf8"));
const stable = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 40, deltaMs: 16 }, { kind: "resumeFrames" }];
const settle = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 150, deltaMs: 16 }, { kind: "resumeFrames" }];
const enter = { kind: "key", key: "Enter" };
const key = (k, times = 1) => ({ kind: "key", key: k, times });
const beats = [
  { id: "title", note: "타이틀", shot: true, expect: { testidPresent: ["title-screen"] } },
  { id: "01-start", note: `새 게임 → ${proof.startName}`, shot: true, ops: [enter, { kind: "waitForRuntime" }, ...settle, ...settle, ...settle, ...settle, ...settle], expect: { mapId: proof.startMapId } },
];
if (proof.walk) {
  beats.push(
    { id: "02-walk", note: `${proof.walk.name} 옆까지 걷는다`, shot: true,
      ops: [{ kind: "playerRoute", moves: proof.walk.moves }, { kind: "waitForPosition", mapId: proof.startMapId, x: proof.walk.arrive.x, y: proof.walk.arrive.y, timeoutMs: 60000 }, ...stable], expect: { x: proof.walk.arrive.x, y: proof.walk.arrive.y } },
    { id: "03-talk", note: `${proof.walk.name} 와 대화`, shot: true,
      ops: [{ kind: "face", dir: proof.walk.face }, { kind: "action" }, { kind: "waitFor", testid: "dialogue-box", state: "present" }, { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.95 }, ...stable], expect: { testidPresent: ["dialogue-box"] } },
    { id: "04-next", note: "한 줄 넘김", shot: true, ops: [enter, ...stable], expect: {} },
    { id: "05-esc", note: "대화를 닫고 ESC 메뉴", shot: true,
      ops: [{ kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 14 }, ...settle, key("Escape"), { kind: "waitFor", testid: "main-menu", state: "present" }, ...stable], expect: { testidPresent: ["main-menu"] } },
    { id: "06-esc-close", note: "메뉴 닫기", shot: false, ops: [{ kind: "pressUntil", key: "Escape", testid: "main-menu", state: "absent", maxPresses: 4 }, ...settle], expect: {} },
  );
}
proof.spots.slice(0, 4).forEach((spot, i) => beats.push({
  id: `07-map-${i + 1}`, note: `${spot.name} (${spot.width}×${spot.height}) 순간이동`, shot: true,
  ops: [{ kind: "teleport", mapId: spot.mapId, x: spot.x, y: spot.y }, ...settle], expect: { mapId: spot.mapId },
}));
// 엔딩 — 뼈대 끝 이벤트 옆으로 순간이동해 말을 걸고 대사를 넘긴다(자동 플레이가 이미 엔딩 도달을 증명, 여기선 화면만 본다).
try {
  const raw = JSON.parse(fs.readFileSync(projectFixture, "utf8"));
  const proj = raw.project ?? raw;
  for (const [mapId, map] of Object.entries(proj.maps ?? {})) {
    const evs = Array.isArray(map.events) ? map.events : Object.values(map.events ?? {});
    const end = evs.find((e) => e.id === "ev_segment_end");
    if (!end) continue;
    beats.push({ id: "08-ending", note: `뼈대 끝 이벤트 「${end.name}」 에 말 걸기(열쇠 스위치 없는 상태)`, shot: true,
      ops: [{ kind: "teleport", mapId, x: end.x - 1, y: end.y }, ...settle, { kind: "face", dir: "right" }, { kind: "action" },
        { kind: "waitFor", testid: "dialogue-box", state: "present" }, ...stable], expect: {} });
    break;
  }
} catch { /* 엔딩 비트는 선택 */ }
export default { id: "romance-real", projectFixture, beats };
