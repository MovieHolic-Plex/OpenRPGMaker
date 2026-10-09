// 꿈 세계 탐험(레인 dream) 장르 시나리오 — 허브 이동, 반복 맵 진입·여닫이, 이펙트 수집 실작동,
// 볼 꼬집기(깨어남 장치) 사용, 엔딩 도달을 출하 플레이어(player.html) 경로로 증명한다.
// 앵커 좌표는 scripts/qa/dream-scenario-anchors.mjs 가 qa-runs/<run>/project.json 에서 뽑은
// scenario-anchors.json 에서 읽는다 — 모델 생성 값이라 하드코딩 금지.
//
// 실행:
//   bun scripts/qa/dream-scenario-anchors.mjs qa-runs/dream-r5
//   npm run qa:runtime -- --scenario dream-explore --project qa-runs/dream-r5/project.json
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const runDir = process.env.DREAM_RUN ?? "qa-runs/dream-r5";
const anchorsPath = join(runDir, "scenario-anchors.json");
if (!existsSync(anchorsPath)) {
  throw new Error(`${anchorsPath} 가 없다 — 먼저 bun scripts/qa/dream-scenario-anchors.mjs ${runDir} 를 돌려라`);
}
const A = JSON.parse(readFileSync(anchorsPath, "utf8"));

const TOWARD = { up: "down", down: "up", left: "right", right: "left" };
/** 앵커의 face 는 이벤트 대비 인접 칸의 방향 — 이벤트를 향해 봐야 하므로 반대다. */
const facing = (anchor) => TOWARD[anchor.face];

const teleport = (anchor) => ({ kind: "teleport", mapId: anchor.mapId, x: anchor.standAt.x, y: anchor.standAt.y });
const arrive = (anchor) => ({ kind: "waitForPosition", mapId: anchor.dest.mapId, x: anchor.dest.x, y: anchor.dest.y });
/** 전이 페이드가 끝날 때까지 게임 시간을 1초 밀어 준다 — 페이드 중 액션은 조용히 먹힌다(r4·r5 실측 간헐 갈림). */
const settle = () => [
  { kind: "pauseFrames" },
  { kind: "stepFrames", frames: 60, deltaMs: 16 },
  { kind: "resumeFrames" },
];
const approach = (anchor) => [teleport(anchor), { kind: "waitForPosition", mapId: anchor.mapId, x: anchor.standAt.x, y: anchor.standAt.y }, { kind: "face", dir: facing(anchor) }];
const talk = () => [{ kind: "action" }, { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 8000 }];
const finishTalk = () => [{ kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 12, timeoutMs: 20_000 }];
/** 조사 한 번: 대사 끝까지 읽고(이펙트 획득·외형 변화 포함). */
const examine = () => [...talk(), ...finishTalk()];

/** @type {import("../../../scripts/lib/runtimeQa.d.mts").RuntimeQaScenario} */
const scenario = {
  id: "dream-explore",
  projectFixture: join(runDir, "project.json"),
  // 이 시나리오는 workbench 스킨(ESC 직후 아이템 작업 패널)의 계약이다 — 기본 스킨이 pixel 로 바뀐 뒤에도 같은 화면을 본다.
  systemPatch: { menuUiStyle: "workbench" },
  seed: 1,
  beats: [
    {
      id: "title",
      note: "타이틀 — 《잠의 서랍》",
      expect: { testidPresent: ["title-screen"] },
      shot: true,
    },
    {
      id: "field-start",
      note: "현실: 서리의 방에서 시작, 볼 꼬집기(깨어남 장치)를 시작부터 보유",
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }, { kind: "seed", seed: 1 }],
      expect: {
        mapId: A.start.mapId,
        x: A.start.x,
        y: A.start.y,
        playerSpriteTextureLoaded: true,
        testidAbsent: ["title-screen"],
        inventoryCounts: { [A.pinch.id]: A.pinch.startQty },
      },
      shot: true,
    },
    {
      id: "sleep-approach",
      note: "침대 앞에 서고 바라보기",
      ops: approach(A.sleep),
      expect: { mapId: A.sleep.mapId, x: A.sleep.standAt.x, y: A.sleep.standAt.y },
      shot: true,
    },
    {
      id: "sleep-talk",
      note: "잠들기 대사",
      ops: talk(),
      expect: { testidPresent: ["dialogue-box"] },
      shot: true,
    },
    {
      id: "hub-arrival",
      note: "세계 간 전환 1/2: 방 → 문 복도(허브)",
      ops: [...finishTalk(), { kind: "waitForPosition", mapId: A.sleepDest.mapId, x: A.sleepDest.x, y: A.sleepDest.y }, ...settle()],
      expect: { mapId: A.sleepDest.mapId, x: A.sleepDest.x, y: A.sleepDest.y, testidAbsent: ["dialogue-box"] },
      shot: true,
    },
    {
      id: "door-forest-talk",
      note: "허브 이동: 촛불 숲의 문",
      ops: [...approach(A.doors.forest), ...talk()],
      expect: { testidPresent: ["dialogue-box"] },
      shot: true,
    },
    {
      id: "forest-arrival",
      note: "세계 간 전환 2/2: 문 복도 → 끝없는 촛불 숲(반복 맵)",
      ops: [...finishTalk(), arrive(A.doors.forest), ...settle()],
      expect: { mapId: A.doors.forest.dest.mapId, x: A.doors.forest.dest.x, y: A.doors.forest.dest.y },
      shot: true,
    },
    {
      id: "loop-wrap",
      note: "반복 맵: 왼쪽 끝에서 넘어가면 오른쪽 끝으로 이어진다",
      ops: [
        { kind: "teleport", mapId: A.loop.mapId, x: A.loop.from.x, y: A.loop.from.y },
        { kind: "waitForPosition", mapId: A.loop.mapId, x: A.loop.from.x, y: A.loop.from.y },
        { kind: "face", dir: "left" },
        { kind: "hold", dir: "left", ms: 1200 },
        { kind: "waitForPosition", mapId: A.loop.mapId, x: A.loop.wrapped.x, y: A.loop.wrapped.y, timeoutMs: 15_000 },
      ],
      expect: { mapId: A.loop.mapId, x: A.loop.wrapped.x, y: A.loop.wrapped.y },
      shot: true,
    },
    {
      id: "effect-candle-take",
      note: "이펙트 수집 실작동: 타오르는 촛대 조사 → 효과 아이템 획득 + 외형 변화",
      ops: [...approach(A.effects.candle), ...examine()],
      expect: {
        mapId: A.effects.candle.mapId,
        testidAbsent: ["dialogue-box"],
        inventoryCounts: { item_effect_candle: 1 },
      },
      shot: true,
    },
    {
      id: "wake-menu",
      note: "깨어남 장치 사용 화면: 메뉴에서 볼 꼬집기 선택",
      ops: [
        { kind: "key", key: "Escape" },
        { kind: "waitFor", testid: "main-menu", state: "present" },
        {
          kind: "pressUntil",
          key: "ArrowDown",
          testid: `status-menu-item-${A.pinch.id}`,
          state: "present",
          attr: "aria-current",
          value: "true",
          maxPresses: 30,
          timeoutMs: 20_000,
        },
      ],
      expect: { testidPresent: ["main-menu", `status-menu-item-${A.pinch.id}`] },
      shot: true,
    },
    {
      id: "wake-used",
      note: "볼 꼬집기로 깨어남 — 자동 공통 이벤트가 방으로 되돌린다(#1372·#1374 계약)",
      ops: [
        // 미리보기에서 Enter 는 상세 진입, 한 번 더가 사용(→ / Enter 선택 계약). 메뉴가 닫힐 때까지 연타.
        { kind: "pressUntil", key: "Enter", testid: "main-menu", state: "absent", maxPresses: 4, timeoutMs: 20_000 },
        { kind: "waitFor", testid: "main-menu", state: "absent", timeoutMs: 20_000 },
        { kind: "waitForPosition", mapId: A.start.mapId, x: 10, y: 7, timeoutMs: 20_000 },
        ...settle(),
      ],
      expect: { mapId: A.start.mapId, x: 10, y: 7, testidAbsent: ["main-menu"] },
      shot: true,
    },
    {
      id: "wake-settle",
      note: "프로브: 깨어남 직후 — 메뉴·대사 잔존 없음, 위치 안정",
      ops: [],
      expect: { mapId: A.start.mapId, x: 10, y: 7, testidAbsent: ["main-menu", "dialogue-box"] },
      shot: true,
    },
    {
      id: "input-probe",
      note: "프로브: 깨어나기 후 이동 입력이 살아 있는가(막히면 x 변화 없음)",
      ops: [
        { kind: "teleport", mapId: A.start.mapId, x: 10, y: 6 },
        { kind: "waitForPosition", mapId: A.start.mapId, x: 10, y: 6 },
        { kind: "hold", dir: "left", ms: 500 },
      ],
      expect: { mapId: A.start.mapId, xNot: 10 },
      shot: true,
    },
    {
      id: "re-dream-arrival",
      note: "다시 잠들어 허브로 재진입 — 깨어나기 후에도 꿈 세계가 다시 돈다",
      ops: [...approach(A.sleep), ...examine(), { kind: "waitForPosition", mapId: A.sleepDest.mapId, x: A.sleepDest.x, y: A.sleepDest.y }, ...settle()],
      expect: { mapId: A.sleepDest.mapId, x: A.sleepDest.x, y: A.sleepDest.y },
      shot: true,
    },
    {
      id: "snow-arrival",
      note: "눈 오는 계단 바다 진입",
      ops: [...approach(A.doors.snow), ...examine(), arrive(A.doors.snow), ...settle()],
      expect: { mapId: A.doors.snow.dest.mapId, x: A.doors.snow.dest.x, y: A.doors.snow.dest.y },
      shot: true,
    },
    {
      id: "effect-umbrella-take",
      note: "우산 이펙트 획득",
      ops: [...approach(A.effects.umbrella), ...examine()],
      expect: { inventoryCounts: { item_effect_candle: 1, item_effect_umbrella: 1 } },
      shot: true,
    },
    {
      id: "desert-arrival",
      note: "시계 눈알 사막 진입",
      ops: [...approach(A.doors.desert), ...examine(), arrive(A.doors.desert), ...settle()],
      expect: { mapId: A.doors.desert.dest.mapId, x: A.doors.desert.dest.x, y: A.doors.desert.dest.y },
      shot: true,
    },
    {
      id: "effect-catears-take",
      note: "고양이 귀 이펙트 획득 — 세 효과 완료",
      ops: [...approach(A.effects.catears), ...examine()],
      expect: { inventoryCounts: { item_effect_candle: 1, item_effect_umbrella: 1, item_effect_catears: 1 } },
      shot: true,
    },
    {
      id: "ending",
      note: "엔딩: 복도 끝 거울 — 대사·에필로그 say 를 끝까지 넘겨 엔딩 화면",
      ops: [
        ...approach(A.mirror),
        { kind: "action" },
        { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 8000 },
        // triggerEnding 은 에필로그 say(대사창)를 먼저 흘린다 — ending-screen 이 뜰 때까지 연타.
        { kind: "pressUntil", key: "Enter", testid: "ending-screen", state: "present", maxPresses: 24, timeoutMs: 40_000 },
        { kind: "waitFor", testid: "ending-screen", state: "present", timeoutMs: 10_000 },
      ],
      expect: { testidPresent: ["ending-screen"] },
      shot: true,
    },
  ],
};

export default scenario;
