/**
 * 바로 깔기(Fast-Path) 6대 기물·지형·맥락 조경 실증 Playwright QA 스크립트
 *
 * 검증 시나리오 (Before → 바로 깔기 프롬프트 입력 → After):
 *   1. "강 깔아줘" (carve_river — 자연스러운 굽이 물줄기 + 돌다리 횡단교 + 수변 조경)
 *   2. "언덕 만들어줘" (sculpt_hill — 2단 절벽 단차 relief + 남쪽 오르막 돌계단 + 언덕 정상 나무·벤치·화단)
 *   3. "집 두 채 지어줘" (place_house — 서로 다른 외관의 2채 주택 + 문 앞 포석 가지 길 자동 연결)
 *   4. "성채와 성문 세워줘" (place_castle — 석조 성곽 흉벽 + 좌우 원형 망루 + 중앙 쌍둥이 탑 철창 아치 성문 + 안뜰 기사 석상)
 *   5. "전투 흔적과 시체들(백골 유해) 깔아줘" (place_corpses — 백골 유해 더미·해골 무더기·전사자 무덤·칼 꽂은 통·부서진 통·돌무더기·전장 화로)
 *   6. "주변과 어울리게 해줘" (harmonize_region — 주변 마을 길망·잔디·식생 맥락 스캔 후 가지 포석 마당 + 활엽수·벤치·가로등·화단 자동 조경)
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const PORT = Number(process.env.PORT ?? "9898");
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.resolve(process.env.OUT ?? "/home/main/claude-viz/stamp-jrpg/capabilities");
fs.mkdirSync(OUT, { recursive: true });

const MODEL_PLANS = {
  "강 깔아줘": {
    steps: [
      { tool: "carve_river", args: { direction: "horizontal", bridge: true }, label: "굽이치는 강줄기와 돌다리 횡단교" },
    ],
  },
  "언덕 만들어줘": {
    steps: [
      { tool: "sculpt_hill", args: { levels: 2, stairs: true }, label: "2단 절벽 언덕과 오르막 돌계단" },
    ],
  },
  "집 두 채 지어줘": {
    steps: [
      { tool: "place_house", args: { count: 2, size: "medium" }, label: "마을 살림집 2채와 진입로" },
    ],
  },
  "성채와 성문 세워줘": {
    steps: [
      { tool: "place_castle", args: { gate: true, towers: true }, label: "석조 성채·망루·아치 성문" },
    ],
  },
  "성문 없이 성채 세워줘": {
    steps: [
      { tool: "place_castle", args: { gate: false, towers: true }, label: "폐쇄형 성벽과 망루 요새(gate:false)" },
    ],
  },
  "망루 없이 성채 세워줘": {
    steps: [
      { tool: "place_castle", args: { gate: true, towers: false }, label: "평성벽과 철창 성문 요새(towers:false)" },
    ],
  },
  "전투 흔적과 백골 유해 깔아줘": {
    steps: [
      { tool: "place_corpses", args: { count: 6, withDebris: true }, label: "전투 흔적과 백골 유해·무기 잔해" },
    ],
  },
  "주변과 어울리게 해줘": {
    steps: [
      { tool: "harmonize_region", args: {}, label: "주변 바이옴 맞춤 자동 조경" },
    ],
  },
  "이 집 오른쪽으로 4칸 옮겨줘": {
    steps: [
      { tool: "move_object", args: { query: "집", dx: 4, dy: 0 }, label: "집 오른쪽으로 4칸 옮기기" },
    ],
  },
  "성 오른쪽으로 몇 칸 옮겨줘": {
    steps: [
      { tool: "move_object", args: { query: "성" }, label: "성 오른쪽으로 옮기기" },
    ],
  },
  "여기에 마을 경비병과 산책하는 주민 NPC 만들어줘": {
    steps: [],
  },
  "간단한 NPC 만들고 대사도 만들어줘": {
    steps: [],
  },
  "간단한 물약 상점과 상인 NPC 만들어줘": {
    steps: [
      { tool: "place_shop", args: { kind: "potion", name: "물약 상점" }, label: "간단한 물약 상점과 상인 NPC" },
    ],
  },
  "간단한 상점 만들어줘": {
    steps: [],
  },
  "절벽 폭포와 연못 만들고 호수 섬 사당과 돌다리도 놓아줘": {
    steps: [
      { tool: "carve_waterfall_pond", args: { area: { x: 8, y: 1, w: 15, h: 9 } }, label: "절벽 폭포와 폭포수 연못" },
      { tool: "carve_lake_island", args: { area: { x: 8, y: 10, w: 9, h: 9 }, centerpiece: "shrine" }, label: "호수 위 작은 섬과 사당" },
      { tool: "place_bridge", args: { area: { x: 17, y: 10, w: 6, h: 9 }, style: "stone" }, label: "아치 돌다리와 양안 진입로" },
    ],
  },
  "장터 광장과 노점 바자회 만들고 겨울 설원 테마로 바꿔줘": {
    steps: [
      { tool: "retheme_season_biome", args: { area: { x: 8, y: 1, w: 15, h: 7 }, theme: "winter_snow" }, label: "겨울 설원 바이옴 리테마" },
      { tool: "build_market_bazaar", args: { area: { x: 8, y: 8, w: 15, h: 11 }, stallCount: 5 }, label: "장터 광장과 노점 바자회·상인 NPC" },
    ],
  },
  "항구 부두와 어선 만들고 옆에 울타리 농장과 철길 건널목 만들어줘": {
    steps: [
      { tool: "build_farm_ranch", args: { area: { x: 8, y: 1, w: 15, h: 7 } }, label: "목장 울타리·경작지 밭·양떼·농부 NPC" },
      { tool: "build_rail_crossing", args: { area: { x: 8, y: 8, w: 15, h: 5 } }, label: "동서 철길 선로·남북 건널목·간이역·역무원 NPC" },
      { tool: "build_harbor_dock", args: { area: { x: 8, y: 13, w: 15, h: 6 } }, label: "석조 부두 안벽·나무 잔교·정박 어선·선원 NPC" },
    ],
  },
  "여관과 치유 성당, 모험가 길드 게시판과 역마차 정류장 세워줘": {
    steps: [
      { tool: "place_inn", args: { area: { x: 8, y: 1, w: 8, h: 9 }, name: "버들항 여관 주인", price: 20 }, label: "여관 건물과 숙박 회복 주인" },
      { tool: "place_church_healer", args: { area: { x: 16, y: 1, w: 7, h: 9 } }, label: "성당 예배당과 치유·저장 사제" },
      { tool: "place_guild_board", args: { area: { x: 8, y: 10, w: 8, h: 9 } }, label: "모험가 길드 회관과 3분기 의뢰 게시판" },
      { tool: "place_travel_portal", args: { area: { x: 16, y: 10, w: 7, h: 9 }, kind: "carriage" }, label: "역마차 정류장과 마부 이동 이벤트" },
    ],
  },
  "배회하는 몬스터들과 레버 철문, 모닥불 야영지와 미믹 상자 깔아줘": {
    steps: [
      { tool: "place_switch_and_gate", args: { area: { x: 8, y: 1, w: 8, h: 6 } }, label: "레버 스위치와 연동 강철 성문" },
      { tool: "place_camp_rest", args: { area: { x: 16, y: 1, w: 7, h: 7 } }, label: "모험가 야영 천막과 휴식·저장 모닥불" },
      { tool: "place_roaming_enemies", args: { area: { x: 8, y: 8, w: 8, h: 9 }, count: 2, movement: "approach" }, label: "배회 심볼 몬스터 2마리" },
      { tool: "place_mimic_and_sparkles", args: { area: { x: 16, y: 9, w: 7, h: 9 } }, label: "보물상자·미믹 함정 상자·반짝이 유실물" },
    ],
  },
  "석조 성벽으로 둘러싸고 기둥을 일렬로 세우고 좌우 대칭 복사한 뒤 도로망을 자동 연결해줘": {
    steps: [
      { tool: "enclose_with_wall", args: { area: { x: 8, y: 1, w: 15, h: 15 }, style: "stone", gateSide: "south" }, label: "석조 담장 포위 및 남쪽 출입문" },
      { tool: "repeat_line_or_grid", args: { area: { x: 9, y: 2, w: 5, h: 10 }, query: "기둥", count: 3 }, label: "기념 원주 일렬 반복 배치" },
      { tool: "mirror_region", args: { area: { x: 9, y: 2, w: 13, h: 10 }, axis: "horizontal" }, label: "좌우 대칭 복사" },
      { tool: "auto_connect_roads", args: { area: { x: 8, y: 1, w: 15, h: 17 } }, label: "건물 출입구 도로망 자동 연결" },
    ],
  },
  "여관과 상점을 세우고 출입구 도로망을 자동 연결한 뒤 마을 군중으로 북적이게 하고 노을 조명으로 연출해줘": {
    steps: [
      { tool: "place_inn", args: { area: { x: 8, y: 1, w: 8, h: 9 }, name: "여관 주인", price: 20 }, label: "1턴: 여관 건물과 숙박 회복 주인" },
      { tool: "place_shop", args: { area: { x: 16, y: 1, w: 7, h: 9 }, kind: "potion", name: "물약 상점" }, label: "1턴: 물약 상점과 상인 NPC" },
    ],
    needsFollowUp: true,
    remainingGoals: [
      "auto_connect_roads: 출입구 도로망 자동 연결",
      "populate_crowd: 활기찬 마을 군중 배치",
      "set_mood_weather: 날씨·석양/야경 조명 연출",
    ],
  },
  "북쪽에 왕성 본성과 폭포 연못·돌다리·남동쪽 항구 부두를 세우고, 중앙에 여관·치유 성당·물약 상점·모험가 길드·장터 바자회를 지어 모든 출입구 도로망을 자동 연결한 뒤, 남쪽 유적을 석조 성벽으로 둘러싸고 레버 철문·배회하는 몬스터·야영지 모닥불·미믹 상자를 깔고, 서쪽 역마차 정류장·가로등 열주·마을 군중·노을 조명으로 4단계 RPG 월드빌딩해줘": {
    steps: [
      { tool: "place_castle", args: { area: { x: 13, y: 1, w: 19, h: 12 }, archetype: "keep", gate: true, towers: true }, label: "1턴 [성채·수역 기틀]: 북부 안뜰 본성(keep)과 쌍둥이 망루·성문" },
      { tool: "carve_waterfall_pond", args: { area: { x: 32, y: 1, w: 12, h: 7 } }, label: "1턴 [성채·수역 기틀]: 동북부 절벽 폭포와 폭포수 연못" },
      { tool: "place_bridge", args: { area: { x: 32, y: 8, w: 12, h: 5 }, style: "stone", direction: "vertical" }, label: "1턴 [성채·수역 기틀]: 동부 하천과 아치 돌다리 횡단교" },
      { tool: "build_harbor_dock", args: { area: { x: 30, y: 23, w: 13, h: 8 } }, label: "1턴 [성채·수역 기틀]: 남동부 석조 항구 부두·나무 잔교·정박 어선·선원" },
    ],
    needsFollowUp: true,
    remainingGoals: [
      "place_inn: 여관 건물과 숙박 회복 주인",
      "place_church_healer: 성당과 치유 사제",
      "place_shop: 물약 상점과 상인",
      "place_guild_board: 모험가 길드와 의뢰 게시판",
      "build_market_bazaar: 장터 노점 광장",
      "auto_connect_roads: 출입구 도로망 자동 연결",
      "enclose_with_wall: 성벽 포위 시공",
      "place_switch_and_gate: 레버 스위치와 철문",
      "place_roaming_enemies: 배회 심볼 몬스터",
      "place_camp_rest: 야영지 천막과 모닥불",
      "place_mimic_and_sparkles: 미믹 상자와 반짝이 유실물",
      "place_travel_portal: 역마차 정류장",
      "repeat_line_or_grid: 가로등 일렬 배치",
      "populate_crowd: 활기찬 마을 군중 배치",
      "set_mood_weather: 노을 조명 연출",
    ],
  },
};

const MODEL_TURN2_PLANS = {
  "여관과 상점을 세우고 출입구 도로망을 자동 연결한 뒤 마을 군중으로 북적이게 하고 노을 조명으로 연출해줘": {
    steps: [
      { tool: "auto_connect_roads", args: { area: { x: 8, y: 1, w: 15, h: 17 } }, label: "2턴: 건물 출입구 도로망 오토타일 자동 연결" },
      { tool: "populate_crowd", args: { area: { x: 8, y: 10, w: 15, h: 7 }, count: 5 }, label: "2턴: 활기찬 마을 군중 NPC 5명 배치" },
      { tool: "set_mood_weather", args: { area: { x: 8, y: 1, w: 15, h: 17 }, weather: "clear", preset: "sunset" }, label: "2턴: 노을 조명과 가로등·화로 분위기 연출" },
    ],
  },
  "북쪽에 왕성 본성과 폭포 연못·돌다리·남동쪽 항구 부두를 세우고, 중앙에 여관·치유 성당·물약 상점·모험가 길드·장터 바자회를 지어 모든 출입구 도로망을 자동 연결한 뒤, 남쪽 유적을 석조 성벽으로 둘러싸고 레버 철문·배회하는 몬스터·야영지 모닥불·미믹 상자를 깔고, 서쪽 역마차 정류장·가로등 열주·마을 군중·노을 조명으로 4단계 RPG 월드빌딩해줘": {
    steps: [
      { tool: "place_inn", args: { area: { x: 2, y: 14, w: 7, h: 8 }, name: "버들항 여관 주인", price: 20 }, label: "2턴 [마을 상권·도로망]: 버들항 여관과 숙박 회복 주인" },
      { tool: "place_church_healer", args: { area: { x: 10, y: 14, w: 8, h: 8 } }, label: "2턴 [마을 상권·도로망]: 치유 대성당과 사제 엘레나" },
      { tool: "place_shop", args: { area: { x: 19, y: 14, w: 8, h: 8 }, kind: "potion", name: "왕도 연금 물약점" }, label: "2턴 [마을 상권·도로망]: 연금 물약 상점과 약초 매대·상인" },
      { tool: "place_guild_board", args: { area: { x: 28, y: 14, w: 8, h: 8 } }, label: "2턴 [마을 상권·도로망]: 모험가 길드 회관과 3분기 의뢰 게시판" },
      { tool: "build_market_bazaar", args: { area: { x: 2, y: 24, w: 13, h: 7 }, stallCount: 5 }, label: "2턴 [마을 상권·도로망]: 남서부 포석 장터 바자회와 만물상인" },
      { tool: "auto_connect_roads", args: { area: { x: 1, y: 12, w: 41, h: 12 } }, label: "2턴 [마을 상권·도로망]: 전 시설 출입구·성문·항구 포석 도로망 자동 직결" },
    ],
    needsFollowUp: true,
    remainingGoals: [
      "enclose_with_wall: 성벽 포위 시공",
      "place_switch_and_gate: 레버 스위치와 철문",
      "place_roaming_enemies: 배회 심볼 몬스터",
      "place_camp_rest: 야영지 천막과 모닥불",
      "place_mimic_and_sparkles: 미믹 상자와 반짝이 유실물",
      "place_travel_portal: 역마차 정류장",
      "repeat_line_or_grid: 가로등 일렬 배치",
      "populate_crowd: 활기찬 마을 군중 배치",
      "set_mood_weather: 노을 조명 연출",
    ],
  },
};

const MODEL_TURN3_PLANS = {
  "북쪽에 왕성 본성과 폭포 연못·돌다리·남동쪽 항구 부두를 세우고, 중앙에 여관·치유 성당·물약 상점·모험가 길드·장터 바자회를 지어 모든 출입구 도로망을 자동 연결한 뒤, 남쪽 유적을 석조 성벽으로 둘러싸고 레버 철문·배회하는 몬스터·야영지 모닥불·미믹 상자를 깔고, 서쪽 역마차 정류장·가로등 열주·마을 군중·노을 조명으로 4단계 RPG 월드빌딩해줘": {
    steps: [
      { tool: "enclose_with_wall", args: { area: { x: 16, y: 24, w: 13, h: 7 }, style: "stone", gateSide: "north" }, label: "3턴 [던전 기믹·몬스터]: 남부 봉인 유적 석조 성벽 포위(북문 개방)" },
      { tool: "place_switch_and_gate", args: { area: { x: 19, y: 23, w: 7, h: 3 }, leverSide: "north" }, label: "3턴 [던전 기믹·몬스터]: 유적 입구 2상태 레버 스위치와 연동 강철 성문" },
      { tool: "place_roaming_enemies", args: { area: { x: 17, y: 26, w: 6, h: 4 }, count: 2, movement: "approach" }, label: "3턴 [던전 기믹·몬스터]: 유적 내부 배회 심볼 몬스터(슬라임·고블린)" },
      { tool: "place_mimic_and_sparkles", args: { area: { x: 23, y: 26, w: 5, h: 4 } }, label: "3턴 [던전 기믹·몬스터]: 보물상자(80G)·미믹 함정 상자·반짝이 유실물" },
      { tool: "place_camp_rest", args: { area: { x: 36, y: 15, w: 7, h: 7 } }, label: "3턴 [던전 기믹·몬스터]: 동부 강변 모험가 야영 천막과 회복·세이브 모닥불" },
    ],
    needsFollowUp: true,
    remainingGoals: [
      "place_travel_portal: 역마차 정류장",
      "repeat_line_or_grid: 가로등 일렬 배치",
      "populate_crowd: 활기찬 마을 군중 배치",
      "set_mood_weather: 노을 조명 연출",
    ],
  },
};

const MODEL_TURN4_PLANS = {
  "북쪽에 왕성 본성과 폭포 연못·돌다리·남동쪽 항구 부두를 세우고, 중앙에 여관·치유 성당·물약 상점·모험가 길드·장터 바자회를 지어 모든 출입구 도로망을 자동 연결한 뒤, 남쪽 유적을 석조 성벽으로 둘러싸고 레버 철문·배회하는 몬스터·야영지 모닥불·미믹 상자를 깔고, 서쪽 역마차 정류장·가로등 열주·마을 군중·노을 조명으로 4단계 RPG 월드빌딩해줘": {
    steps: [
      { tool: "place_travel_portal", args: { area: { x: 2, y: 10, w: 9, h: 4 }, kind: "carriage" }, label: "4턴 [생동감·군중·황혼]: 서부 가도 역마차 정류장과 마부 빠른 이동" },
      { tool: "repeat_line_or_grid", args: { area: { x: 12, y: 11, w: 20, h: 3 }, query: "가로등", count: 4 }, label: "4턴 [생동감·군중·황혼]: 왕성 앞 대로 가로등 일렬 배치" },
      { tool: "populate_crowd", args: { area: { x: 6, y: 21, w: 28, h: 3 }, count: 6 }, label: "4턴 [생동감·군중·황혼]: 중심가 활기찬 마을 군중 NPC 6명 스폰" },
      { tool: "set_mood_weather", args: { area: { x: 1, y: 1, w: 42, h: 30 }, weather: "clear", preset: "sunset" }, label: "4턴 [생동감·군중·황혼]: 황금빛 노을 조명(sunset)과 화로 연출" },
    ],
  },
};

async function startViteServer() {
  const proc = spawn("./node_modules/.bin/vite", ["--port", String(PORT), "--host", "127.0.0.1"], {
    cwd: process.cwd(),
    env: { ...process.env, VITE_CACHE_DIR: `/tmp/vite-cache-fastpath-${PORT}` },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const baseUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("vite start timeout")), 45_000);
    proc.stdout.on("data", (chunk) => {
      const text = String(chunk).replace(/\x1b\[[0-9;]*m/g, "");
      const m = text.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (m) {
        clearTimeout(timer);
        resolve(m[0]);
      }
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
  return { proc, baseUrl };
}

const { proc: viteProc, baseUrl: ACTUAL_BASE } = await startViteServer();
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  await page.addInitScript(() => {
    localStorage.setItem("oprn:ai-stamp-place", "1");
    localStorage.setItem("oprn:ai-panel-collapsed", "0");
    localStorage.setItem(
      "oprn:ai-config",
      JSON.stringify({
        authMode: "apiKey",
        baseUrl: "http://127.0.0.1:9999/v1",
        model: "gemini-4-argon-medium",
        liteModel: "gemini-4-argon-medium",
        apiKey: "qa-stub-key",
      }),
    );
  });

  const modelCalls = [];
  await page.route("**/v1/chat/completions", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    const messages = body.messages ?? [];
    const users = messages.filter((m) => m.role !== "system");
    let payload = {};
    try {
      payload = JSON.parse(String(users[0]?.content ?? "{}"));
    } catch {
      payload = {};
    }
    let lastPayload = {};
    try {
      lastPayload = JSON.parse(String(users.at(-1)?.content ?? "{}"));
    } catch {
      lastPayload = {};
    }
    const sentence = String(lastPayload.sentence ?? payload.sentence ?? "");
    const turnNum = Number(lastPayload.turn) || (users.length >= 2 ? users.length : 1);
    const plan = turnNum === 4
      ? (MODEL_TURN4_PLANS[sentence] ?? { steps: [] })
      : turnNum === 3
        ? (MODEL_TURN3_PLANS[sentence] ?? { steps: [] })
        : turnNum === 2
          ? (MODEL_TURN2_PLANS[sentence] ?? { steps: [] })
          : (MODEL_PLANS[sentence] ?? { steps: [] });
    modelCalls.push({ sentence, turn: turnNum, plan });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "qa-capabilities",
        model: body.model ?? "stub",
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(plan) } }],
      }),
    });
  });

  await page.goto(`${ACTUAL_BASE}/?blankProject=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 120_000 });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await page.waitForFunction(() => typeof window.__oprnEditorTool === "function", null, { timeout: 30_000 });

  // AI 패널이 접혀 있으면 펼치기
  const expandBtn = page.locator("button[aria-label='AI 패널 펼치기']").first();
  if (await expandBtn.isVisible().catch(() => false)) {
    await expandBtn.click();
    await page.waitForTimeout(400);
  }

  await page.evaluate(async () => {
    const { setStampPlaceOn } = await import("/src/editor/stampPlaceMode.ts");
    setStampPlaceOn(true);
  });
  await page.waitForTimeout(400);

  async function resetBaseMap(caseId, name, extraSetup, mapSize) {
    const mapId = `map_${caseId}`;
    const W = mapSize?.w ?? 24;
    const H = mapSize?.h ?? 20;
    await page.evaluate(
      async ({ mapId, name, extraSetup, W, H }) => {
        const t = window.__oprnEditorTool;
        const must = (toolName, args) => {
          const r = t(toolName, args);
          if (!r.ok) throw new Error(`${toolName} failed: ${r.summary}`);
          return r;
        };
        must("create_map", { name, id: mapId, width: W, height: H, tilesetId: "beodeul_city" });
        must("fill_region", { mapId, rect: { x: 0, y: 0, w: W, h: H }, material: "버들항 풀밭" });
        // 기본 마을 문맥: 좌측 상단 집 1채 + 중앙 가로 포석 길 + 우물 + 나무
        must("stamp_tileset_object", { mapId, objectId: "bd-house-h103_1", at: { x: 1, y: 2 }, overwrite: true });
        must("stamp_tileset_object", { mapId, objectId: "bd-prop-well_roofed", at: { x: W === 27 ? 2 : 6, y: W === 27 ? 11 : 5 }, overwrite: true });
        must("stamp_tileset_object", { mapId, objectId: "bd-tree-3e8732", at: { x: 1, y: Math.min(H - 5, 15) }, overwrite: true });
        if (W === 44 && H === 32) {
          must("stamp_tileset_object", { mapId, objectId: "bd-tree-03a8f7", at: { x: 8, y: 1 }, overwrite: true });
          must("stamp_tileset_object", { mapId, objectId: "bd-pick-coast-cliff-road-fir-m", at: { x: 6, y: 1 }, overwrite: true });
          must("stamp_tileset_object", { mapId, objectId: "bd-pick-wizard-tower-bed-flower", at: { x: 9, y: 5 }, overwrite: true });
          must("stamp_tileset_object", { mapId, objectId: "bd-pick-mountain-pass-boulder-m", at: { x: 7, y: 7 }, overwrite: true });
          must("stamp_tileset_object", { mapId, objectId: "bd-mpart-bush-e", at: { x: 10, y: 7 }, overwrite: true });
          must("stamp_tileset_object", { mapId, objectId: "bd-tree-f4f319", at: { x: 0, y: 20 }, overwrite: true });
          must("stamp_tileset_object", { mapId, objectId: "bd-tree-f4f319", at: { x: 0, y: 28 }, overwrite: true });
          must("stamp_tileset_object", { mapId, objectId: "bd-mpart-bush-c", at: { x: 41, y: 15 }, overwrite: true });
          must("stamp_tileset_object", { mapId, objectId: "bd-tree-f4f319", at: { x: 41, y: 18 }, overwrite: true });
        }
        const p = window.__oprnEditorStore.getCurrent();
        const ts = p.tilesets.beodeul_city;
        const roadTile = ts.autotileGroups?.find((g) => g.id === "beodeul_road_autotile")?.memberTileIds?.[0] ?? 1008;
        const roadY = H === 32 ? 13 : H >= 36 ? 36 : H >= 22 ? 19 : W === 27 ? 18 : 9;
        const roadCells = [];
        for (let x = 1; x <= (W === 27 ? 6 : 10); x++) {
          roadCells.push({ x, y: roadY }, { x, y: roadY + 1 });
          if (roadY !== 9 && roadY !== 13 && W !== 27) roadCells.push({ x, y: 9 }, { x, y: 10 });
        }
        must("paint_tiles", { mapId, layer: "lower", mode: "cells", tile: roadTile, cells: roadCells });

        if (extraSetup === "harmonize_raw_patch") {
          must("stamp_tileset_object", { mapId, objectId: "bd-prop-lamp_crook", at: { x: 9, y: 6 }, overwrite: true });
          must("stamp_tileset_object", { mapId, objectId: "bd-pick-wizard-tower-bed-flower", at: { x: 5, y: 12 }, overwrite: true });
          must("fill_region", { mapId, rect: { x: 11, y: 8, w: 10, h: 7 }, material: "버들항 모랫길" });
        }
        if (extraSetup === "move_house_setup") {
          must("stamp_tileset_object", { mapId, objectId: "bd-house-h103_2", at: { x: 11, y: 2 }, overwrite: true });
        }
        if (extraSetup === "move_castle_setup") {
          const { runStampPlace } = await import("/src/editor/stampPlaceRunner.ts");
          await runStampPlace({
            text: "망루 초소 성채 세워줘",
            mapId,
            selection: { mapId, x: 9, y: 2, width: 11, height: 9 },
            variation: 3,
            chat: async () => ({
              message: {
                role: "assistant",
                content: JSON.stringify({
                  steps: [{ tool: "place_castle", args: { archetype: "outpost", gate: true, towers: true } }],
                }),
              },
            }),
          });
        }

        const { editorState } = await import("/src/editor/editorState.ts");
        editorState.set({ currentMapId: mapId, selection: null });
      },
      { mapId, name, extraSetup: extraSetup ?? null, W, H },
    );

    await page.waitForFunction(
      (id) => typeof window.__oprnEditWorldToClient === "function" && window.__oprnEditMapViewport?.()?.mapId === id,
      mapId,
      { timeout: 60_000 },
    );
    await page.evaluate(async ({ id, W, H }) => {
      const { editorState } = await import("/src/editor/editorState.ts");
      editorState.set({
        layer: "lower",
        tool: "select",
        zoom: W <= 27 && H <= 22 ? 2 : 1,
      });
      const { requestEditorCameraFocus } = await import("/src/editor/editorCameraFocus.ts");
      requestEditorCameraFocus({
        mapId: id,
        tileX: W / 2,
        tileY: H / 2,
        ...(W > 27 || H > 22 ? { bounds: { x: 0, y: 0, width: W, height: H } } : {}),
        immediate: true,
      });
    }, { id: mapId, W, H });
    await page.waitForTimeout(500);
    return mapId;
  }

  const CASES = [
    {
      id: "case1-river",
      mapName: "버들항 들판 — ① 강 깔기",
      sel: { x: 4, y: 11, w: 18, h: 8 },
      prompt: "강 깔아줘",
    },
    {
      id: "case2-hill",
      mapName: "버들항 들판 — ② 언덕과 계단 만들기",
      sel: { x: 10, y: 2, w: 13, h: 10 },
      prompt: "언덕 만들어줘",
    },
    {
      id: "case3-houses",
      mapName: "버들항 마을 — ③ 집 두 채 짓기",
      sel: { x: 9, y: 2, w: 14, h: 9 },
      prompt: "집 두 채 지어줘",
    },
    {
      id: "case4-castle",
      mapName: "버들항 변경 — ④ 성채와 성문 세우기",
      sel: { x: 9, y: 2, w: 14, h: 11 },
      prompt: "성채와 성문 세워줘",
    },
    {
      id: "case4b-castle-keep",
      mapName: "버들항 변경 — ④-B 성채 변주 1 (19×16 안뜰 본성 keep)",
      mapSize: { w: 27, h: 20 },
      sel: { x: 7, y: 1, w: 19, h: 16 },
      prompt: "성채와 성문 세워줘",
    },
    {
      id: "case4d-castle-outpost",
      mapName: "버들항 변경 — ④-D 성채 변주 2 (19×16 망루 초소 outpost)",
      mapSize: { w: 27, h: 20 },
      sel: { x: 7, y: 1, w: 19, h: 16 },
      prompt: "성채와 성문 세워줘",
    },
    {
      id: "case4b-castle-moat",
      mapName: "버들항 변경 — ④-C 성채 변주 3 (19×16 해자 성문루 gatehouse)",
      mapSize: { w: 27, h: 20 },
      sel: { x: 7, y: 1, w: 19, h: 16 },
      prompt: "성채와 성문 세워줘",
    },
    {
      id: "case4c-castle-citadel",
      mapName: "버들항 왕도 — ④-A 왕성 원형 풀 키트 (34×34 citadel)",
      mapSize: { w: 44, h: 40 },
      sel: { x: 9, y: 1, w: 34, h: 34 },
      prompt: "성채와 성문 세워줘",
    },
    {
      id: "case4-opt-nogate",
      mapName: "버들항 변경 — 성문 없는 요새 (gate:false)",
      sel: { x: 9, y: 2, w: 14, h: 11 },
      prompt: "성문 없이 성채 세워줘",
    },
    {
      id: "case4-opt-notowers",
      mapName: "버들항 변경 — 망루 없는 성벽과 성문 (towers:false)",
      sel: { x: 9, y: 2, w: 14, h: 11 },
      prompt: "망루 없이 성채 세워줘",
    },
    {
      id: "case5-corpses",
      mapName: "버들항 옛 전장 — ⑤ 시체들(백골 유해) 깔기",
      sel: { x: 9, y: 11, w: 13, h: 8 },
      prompt: "전투 흔적과 백골 유해 깔아줘",
    },
    {
      id: "case6-harmony",
      mapName: "버들항 마을 — ⑥ 주변과 어울리게 해줘",
      sel: { x: 10, y: 7, w: 12, h: 9 },
      prompt: "주변과 어울리게 해줘",
      extraSetup: "harmonize_raw_patch",
    },
    {
      id: "case7-move-right",
      mapName: "버들항 마을 — ⑦ 집 오른쪽으로 4칸 옮기기",
      sel: { x: 10, y: 1, w: 13, h: 8 },
      prompt: "이 집 오른쪽으로 4칸 옮겨줘",
      extraSetup: "move_house_setup",
    },
    {
      id: "case7b-move-castle",
      mapName: "버들항 변경 — ⑦-B 성 오른쪽으로 몇 칸 옮기기",
      sel: { x: 9, y: 2, w: 14, h: 9 },
      prompt: "성 오른쪽으로 몇 칸 옮겨줘",
      extraSetup: "move_castle_setup",
    },
    {
      id: "case8-simple-npc",
      mapName: "버들항 마을 — ⑧ 경비병과 산책하는 주민 NPC 만들기",
      sel: { x: 9, y: 3, w: 12, h: 7 },
      prompt: "여기에 마을 경비병과 산책하는 주민 NPC 만들어줘",
    },
    {
      id: "case8b-npc-dialogue",
      mapName: "버들항 마을 — ⑧-B 간단한 NPC 만들고 대사도 만들어줘",
      sel: { x: 9, y: 3, w: 10, h: 6 },
      prompt: "간단한 NPC 만들고 대사도 만들어줘",
    },
    {
      id: "case9-simple-shop",
      mapName: "버들항 장터 — ⑨ 간단한 물약 상점과 상인 NPC 만들기",
      sel: { x: 10, y: 1, w: 13, h: 9 },
      prompt: "간단한 물약 상점과 상인 NPC 만들어줘",
    },
    {
      id: "case9b-simple-shop-weapon",
      mapName: "버들항 장터 — ⑨-B 간단한 상점 만들어줘",
      sel: { x: 10, y: 1, w: 13, h: 9 },
      prompt: "간단한 상점 만들어줘",
    },
    {
      id: "case10-bridge-waterfall",
      mapName: "버들항 계곡 — ⑩ 절벽 폭포·연못 + 호수 섬 사당 + 아치 돌다리",
      sel: { x: 8, y: 1, w: 15, h: 18 },
      prompt: "절벽 폭포와 연못 만들고 호수 섬 사당과 돌다리도 놓아줘",
    },
    {
      id: "case11-market-bazaar",
      mapName: "버들항 광장 — ⑪ 겨울 설원 리테마 + 장터 바자회 노점·상인",
      sel: { x: 8, y: 1, w: 15, h: 18 },
      prompt: "장터 광장과 노점 바자회 만들고 겨울 설원 테마로 바꿔줘",
    },
    {
      id: "case12-harbor-farm",
      mapName: "버들항 해안 — ⑫ 울타리 농장 + 철길 건널목·간이역 + 항구 부두·어선",
      sel: { x: 8, y: 1, w: 15, h: 18 },
      prompt: "항구 부두와 어선 만들고 옆에 울타리 농장과 철길 건널목 만들어줘",
    },
    {
      id: "case13-inn-church-guild",
      mapName: "버들항 중심가 — ⑬ 여관(회복) + 성당(힐·저장) + 길드 게시판(3분기) + 역마차",
      sel: { x: 8, y: 1, w: 15, h: 18 },
      prompt: "여관과 치유 성당, 모험가 길드 게시판과 역마차 정류장 세워줘",
    },
    {
      id: "case14-enemies-switch-camp",
      mapName: "버들항 변경 — ⑭ 레버·철문 + 야영지 모닥불 + 배회 몬스터 + 미믹·반짝이",
      sel: { x: 8, y: 1, w: 15, h: 18 },
      prompt: "배회하는 몬스터들과 레버 철문, 모닥불 야영지와 미믹 상자 깔아줘",
    },
    {
      id: "case15-wall-repeat-mirror-roads",
      mapName: "버들항 성역 — ⑮ 성벽 포위 + 기둥 일렬 반복 + 좌우 대칭 복사 + 도로 자동 연결",
      sel: { x: 8, y: 1, w: 15, h: 17 },
      prompt: "석조 성벽으로 둘러싸고 기둥을 일렬로 세우고 좌우 대칭 복사한 뒤 도로망을 자동 연결해줘",
    },
    {
      id: "case16-crowd-weather-2turn",
      mapName: "버들항 번화가 — ⑯ [LLM 2턴 연쇄 시공] 1턴 여관·상점 → 2턴 도로망 연결·군중 5명·노을 조명",
      sel: { x: 8, y: 1, w: 15, h: 17 },
      prompt: "여관과 상점을 세우고 출입구 도로망을 자동 연결한 뒤 마을 군중으로 북적이게 하고 노을 조명으로 연출해줘",
    },
    {
      id: "case17-multiturn-rpg-worldbuild",
      mapName: "버들항 왕국 변경 — ⑰ [4턴 연쇄 RPG 월드빌딩] 성채·폭포·항구 → 마을 상권·도로망 → 봉인 유적·레버·몬스터 → 역마차·군중·노을",
      mapSize: { w: 44, h: 32 },
      sel: { x: 1, y: 1, w: 42, h: 30 },
      prompt: "북쪽에 왕성 본성과 폭포 연못·돌다리·남동쪽 항구 부두를 세우고, 중앙에 여관·치유 성당·물약 상점·모험가 길드·장터 바자회를 지어 모든 출입구 도로망을 자동 연결한 뒤, 남쪽 유적을 석조 성벽으로 둘러싸고 레버 철문·배회하는 몬스터·야영지 모닥불·미믹 상자를 깔고, 서쪽 역마차 정류장·가로등 열주·마을 군중·노을 조명으로 4단계 RPG 월드빌딩해줘",
    },
  ];

  const results = [];
  const onlySet = process.env.ONLY_CASES ? new Set(process.env.ONLY_CASES.split(",")) : null;

  for (const c of CASES) {
    if (onlySet && !onlySet.has(c.id)) continue;
    const mapId = await resetBaseMap(c.id, c.mapName, c.extraSetup, c.mapSize);
    const tileSize = 16;
    const toClient = (tx, ty) =>
      page.evaluate(([x, y, size]) => window.__oprnEditWorldToClient?.(x * size + size / 2, y * size + size / 2) ?? null, [
        tx,
        ty,
        tileSize,
      ]);
    const a = await toClient(c.sel.x, c.sel.y);
    const b = await toClient(c.sel.x + c.sel.w - 1, c.sel.y + c.sel.h - 1);
    if (!a || !b) throw new Error("world->client 변환 실패");

    await page.mouse.move(a.x, a.y);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up({ button: "right" });

    const chipPrompt = page.getByTestId("selection-chip-prompt");
    await chipPrompt.waitFor({ state: "visible", timeout: 15_000 });
    await chipPrompt.fill(c.prompt);
    await page.waitForTimeout(300);

    const beforeSnap = await page.evaluate(
      ({ mapId }) => {
        const m = window.__oprnEditorStore.getCurrent().maps[mapId];
        return {
          lower: [...m.lowerTiles],
          upper: [...m.upperTiles],
          reliefLevels: m.relief?.levels ? [...m.relief.levels] : [],
          reliefRamps: m.relief?.ramps ? [...m.relief.ramps] : [],
          placements: (m.structurePlacements ?? []).length,
        };
      },
      { mapId },
    );

    await page.mouse.move(10, 10);
    // Before 스크린샷 캡처 (선택 영역 + 입력된 프롬프트가 보이는 상태)
    await page.screenshot({ path: path.join(OUT, `${c.id}-before.png`), animations: "disabled", timeout: 60_000 });
    const prevMaxOrder = await page.evaluate(() => {
      const nums = [...document.body.innerText.matchAll(/#(\d+)\s+[^\n]+—\s*(?:완료|일부 적용|실패)/g)].map((m) => Number(m[1]));
      return nums.length ? Math.max(...nums) : 0;
    });
    // Enter 키로 바로 깔기 실행
    await chipPrompt.focus();
    await chipPrompt.press("Enter");
    await page.waitForFunction(
      (prev) => {
        const nums = [...document.body.innerText.matchAll(/#(\d+)\s+[^\n]+—\s*(?:완료|일부 적용|실패)/g)].map((m) => Number(m[1]));
        const cur = nums.length ? Math.max(...nums) : 0;
        return cur > prev;
      },
      prevMaxOrder,
      { timeout: 60_000 },
    );
    await page.evaluate(async (caseId) => {
      const { editorState } = await import("/src/editor/editorState.ts");
      const showEvents = /^(?:case8|case9|case11|case12|case13|case14|case16|case17)/.test(caseId);
      editorState.set({
        selection: null,
        ...(showEvents ? { layer: "event", tool: "select" } : {}),
      });
    }, c.id);
    await page.mouse.move(10, 10);
    await page.waitForTimeout(300);
    // After 스크린샷 캡처 (선택 칩·브러시 호버 가림 없이 시공 결과 전체 노출)
    await page.screenshot({ path: path.join(OUT, `${c.id}-after.png`), animations: "disabled", timeout: 60_000 });

    if (c.id === "case17-multiturn-rpg-worldbuild") {
      // 1) Turn 1 → Turn 2 → Turn 3 → Turn 4 단계별 점진적 시공 스크린샷 캡처
      const stageMapId = await resetBaseMap("case17_stages", c.mapName, null, c.mapSize);
      const stagePlans = [
        MODEL_PLANS[c.prompt],
        MODEL_TURN2_PLANS[c.prompt],
        MODEL_TURN3_PLANS[c.prompt],
        MODEL_TURN4_PLANS[c.prompt],
      ];
      for (let tIdx = 0; tIdx < stagePlans.length; tIdx++) {
        const stagePlan = stagePlans[tIdx];
        await page.evaluate(
          async ({ stageMapId, stagePlan, sel, tIdx, promptText }) => {
            const { runStampPlace } = await import("/src/editor/stampPlaceRunner.ts");
            await runStampPlace({
              text: promptText,
              mapId: stageMapId,
              selection: { mapId: stageMapId, x: sel.x, y: sel.y, width: sel.w, height: sel.h },
              maxLlmTurns: 1,
              variation: 10 + tIdx,
              chat: async () => ({
                message: {
                  role: "assistant",
                  content: JSON.stringify({ steps: stagePlan.steps }),
                },
              }),
            });
            const { editorState } = await import("/src/editor/editorState.ts");
            editorState.set({ currentMapId: stageMapId, selection: null, layer: "event", tool: "select", zoom: 1 });
          },
          { stageMapId, stagePlan, sel: c.sel, tIdx, promptText: c.prompt },
        );
        await page.mouse.move(10, 10);
        await page.waitForTimeout(350);
        await page.screenshot({
          path: path.join(OUT, `${c.id}-turn${tIdx + 1}.png`),
          animations: "disabled",
          timeout: 60_000,
        });
      }

      // 다시 최종 4턴 통합 맵으로 복귀
      await page.evaluate(async (id) => {
        const { editorState } = await import("/src/editor/editorState.ts");
        editorState.set({ currentMapId: id, selection: null, layer: "event", tool: "select", zoom: 1 });
      }, mapId);
      await page.waitForTimeout(250);

      // 2) 완성된 44×32 RPG 월드 타운을 실런타임(openTestPlayModal)에서 바로 부팅하여 길드 의뢰 게시판 3분기 대화창/선택지 상호작용 캡처
      await page.evaluate(async (targetMapId) => {
        const { openTestPlayModal, closeTestPlayModal } = await import("/src/editor/panels/testPlayModal.ts");
        const proj = window.__oprnEditorStore.getCurrent();
        const targetMap = proj.maps[targetMapId];
        const guildEv = targetMap?.events?.find((e) => e.name.includes("길드 의뢰 게시판"));
        const startPos = guildEv
          ? { mapId: targetMapId, x: guildEv.x, y: Math.min(targetMap.height - 1, guildEv.y + 1) }
          : { mapId: targetMapId, x: 22, y: 22 };
        window.__closeCase17PlayModal = closeTestPlayModal;
        await openTestPlayModal(startPos);
      }, mapId);
      await page.waitForFunction(
        (expectedMapId) => window.__oprnDebug?.readState?.()?.currentMapId === expectedMapId,
        mapId,
        { timeout: 60_000 },
      );
      await page.waitForTimeout(800);
      // 북쪽(길드 의뢰 게시판 방향)을 바라보고 액션으로 3분기 의뢰 게시판 대화창 및 선택지 오픈
      await page.evaluate(() => {
        window.__oprnInput?.face?.("up");
        window.__oprnInput?.action?.();
      });
      await page.waitForTimeout(1400);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(OUT, `${c.id}-playtest.png`),
        animations: "disabled",
        timeout: 60_000,
      });
      await page.evaluate(() => {
        window.__closeCase17PlayModal?.();
      });
      await page.waitForTimeout(250);
    }
    const afterSnap = await page.evaluate(
      ({ mapId }) => {
        const m = window.__oprnEditorStore.getCurrent().maps[mapId];
        return {
          lower: [...m.lowerTiles],
          upper: [...m.upperTiles],
          reliefLevels: m.relief?.levels ? [...m.relief.levels] : [],
          reliefRamps: m.relief?.ramps ? [...m.relief.ramps] : [],
          placements: (m.structurePlacements ?? []).length,
        };
      },
      { mapId },
    );

    let changedTiles = 0;
    for (let i = 0; i < beforeSnap.lower.length; i++) {
      if (beforeSnap.lower[i] !== afterSnap.lower[i] || beforeSnap.upper[i] !== afterSnap.upper[i]) changedTiles++;
    }
    let changedRelief = 0;
    const maxLen = Math.max(beforeSnap.reliefLevels.length, afterSnap.reliefLevels.length);
    for (let i = 0; i < maxLen; i++) {
      if ((beforeSnap.reliefLevels[i] ?? 0) !== (afterSnap.reliefLevels[i] ?? 0) || (beforeSnap.reliefRamps[i] ?? 0) !== (afterSnap.reliefRamps[i] ?? 0)) {
        changedRelief++;
      }
    }

    const lastBubbleText = await page.evaluate(() => {
      const text = document.body.innerText;
      const matches = [...text.matchAll(/(#\d+\s+[^\n]+—\s*(?:완료|일부 적용|실패)[\s\S]*?)(?=\n#\d+\s+|\n바로 깔기 —|$)/g)];
      return (matches.at(-1)?.[1] ?? "").trim();
    });

    console.log(`[${c.id}] "${c.prompt}" -> changedTiles=${changedTiles}, changedRelief=${changedRelief}, placements=${beforeSnap.placements}->${afterSnap.placements}`);
    console.log(`   bubble: ${lastBubbleText.replace(/\s+/g, " ")}`);
    results.push({
      id: c.id,
      prompt: c.prompt,
      sel: c.sel,
      changedTiles,
      changedRelief,
      placementsBefore: beforeSnap.placements,
      placementsAfter: afterSnap.placements,
      lastBubbleText,
    });
  }

  const reportPath = path.join(OUT, "capabilities-report.json");
  let existingResults = [];
  if (fs.existsSync(reportPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(reportPath, "utf8"));
      if (Array.isArray(prev.results)) existingResults = prev.results;
    } catch {
      existingResults = [];
    }
  }
  const byId = new Map(existingResults.map((r) => [r.id, r]));
  for (const r of results) byId.set(r.id, r);
  const mergedResults = CASES.map((c) => byId.get(c.id)).filter(Boolean);
  fs.writeFileSync(reportPath, JSON.stringify({ results: mergedResults, pageErrors }, null, 2));
} finally {
  if (browser) await browser.close();
  viteProc.kill("SIGTERM");
}
