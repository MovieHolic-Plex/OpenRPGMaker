// 연애 첫 만남이 단색 잔디가 아니라 구성기로 깐 현대 캠퍼스에서 열리는지 — 출하 플레이어(player.html + shim)로 본다.
// 입력: output/qa/romance-fix/{project,proof}.json (scripts/qa/romance-fix/stage.mts → route-proof.mts 가 만든다). 저작 내용 쓰기 없음.
import fs from "node:fs";
import path from "node:path";
const flag = process.argv.indexOf("--project");
const projectFixture = flag >= 0 ? process.argv[flag + 1] : "output/qa/romance-fix/project.json";
const proof = JSON.parse(fs.readFileSync(path.join(path.dirname(projectFixture), "proof.json"), "utf8"));
const stable = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 40, deltaMs: 16 }, { kind: "resumeFrames" }];
export default {
  id: "romance-fix-stage",
  projectFixture,
  beats: [
    { id: "title", expect: { testidPresent: ["title-screen"] } },
    { id: "01-start", note: "새 게임 → 캠퍼스 교문 앞 시작(단색 잔디 아님)", shot: true,
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }, ...stable],
      expect: { mapId: proof.mapId, x: proof.start.x, y: proof.start.y, playerSpriteTextureLoaded: true, testidAbsent: ["title-screen"] } },
    { id: "02-walk-to-partner", note: "상대 옆까지 실제로 걷는다(순간이동 없음)", shot: true,
      ops: [{ kind: "playerRoute", moves: proof.moves }, { kind: "waitForPosition", mapId: proof.mapId, x: proof.at.x, y: proof.at.y, timeoutMs: 30000 }, ...stable],
      expect: { mapId: proof.mapId, x: proof.at.x, y: proof.at.y } },
    { id: "03-talk", note: "상대에게 말을 건다 — 대사창·선택지(두 선택)", shot: true,
      ops: [{ kind: "face", dir: proof.face }, { kind: "action" }, { kind: "waitFor", testid: "dialogue-box", state: "present" }],
      expect: { testidPresent: ["dialogue-box"] } },
  ],
};
