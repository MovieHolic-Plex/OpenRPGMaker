// 맵 배경(파노라마) 견본을 출하 플레이어에서 1배·2배로 본다 — 모서리만 확대·검은 빈칸·시차를 눈으로 판정.
//
// 기본 픽스처는 map-background 와 같은 등불 마을(위쪽 6행 비움, OPRN 「노을」 세트)이다. 실제 장면은
// `--project` 로 넣는다(편집기에서 견본을 깐 프로젝트를 JSON 으로 뽑은 것). 시작 칸에서 오른쪽으로 걸어
// 카메라가 움직일 때 층마다 다르게 흐르는지 세 장(제자리·걸은 뒤·더 걸은 뒤)으로 남긴다.
//
//   node scripts/runtime-qa.mjs --scenario map-panorama --project <장면.json> --out verify-shots/runtime-qa/pano-<이름>
//   PANO_VIEWPORT=640x480 … — 기본 320×240(게임 논리 화면 = 1배).
// 이 박스에서는 크롬이 ERR_NETWORK_CHANGED 로 백지가 되므로 `unshare -rn` 안에서 돌렸다(2026-10-21).
import { writeMapBackgroundFixture } from "./map-background-fixture.mjs";

const [vw, vh] = String(process.env.PANO_VIEWPORT ?? "320x240").split("x").map(Number);
const walk = (id, note, frames) => ({
  id,
  note,
  ops: [
    { kind: "dir", dir: "right" },
    { kind: "stepFrames", frames, deltaMs: 17 },
    { kind: "dir", dir: null },
    { kind: "stepFrames", frames: 12, deltaMs: 17 },
  ],
  expect: { testidAbsent: ["title-screen"] },
  shot: true,
});

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const mapPanoramaScenario = {
  id: "map-panorama",
  viewport: { width: vw || 320, height: vh || 240 },
  projectFixture: writeMapBackgroundFixture(),
  beats: [
    { id: "title", note: "타이틀 화면이 뜬다", expect: { testidPresent: ["title-screen"] } },
    {
      id: "start",
      note: "새 게임 → 시작 칸. 비운 칸·맵 바깥에 배경이 화면을 꽉 채운다(검은 빈칸·모서리 확대 없음)",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 1 },
        { kind: "pauseFrames" },
        { kind: "stepFrames", frames: 30, deltaMs: 17 },
      ],
      expect: { testidAbsent: ["title-screen", "dialogue-box"] },
      shot: true,
    },
    walk("walk-1", "오른쪽으로 걸은 뒤 — 먼 층은 조금, 가까운 층은 더 움직인다", 120),
    walk("walk-2", "더 걸은 뒤 — 반복 이음매·빈 자리가 생기지 않는다", 120),
    { id: "resume", note: "정상 루프로 돌려놓는다(샷 없음)", ops: [{ kind: "resumeFrames" }] },
  ],
};

export default mapPanoramaScenario;
