// 조수 v2 «모델이 보는 것» 스냅숏 — 요청 글 × 프로젝트 상태마다 지시문 블록·처음 싣는 도구·나중 싣는 도구를 해시로 찍는다(모델 없음).
// 왜(2026-11-11 구조 재점검): v2 는 낱말 목록 201개로 요청을 갈라 지시문·도구를 바꾼다. 파일을 옮기고 쪼개는 리팩토링이 그 결과를
// 한 글자도 바꾸지 않았는지 보려면 옮기기 전·후를 같은 요청 묶음으로 찍어 대조해야 한다. 테스트 러너가 아니다 — 출력만 한다.
//
//   bun scripts/qa/assistant-v2/golden.mts <out.json>              찍기
//   bun scripts/qa/assistant-v2/golden.mts --diff <a.json> <b.json>  대조(다르면 exit 1, 달라진 요청·칸을 찍는다)
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createBlankProject } from "../../../src/project/defaults";
import { normalizeGameBlueprint } from "../../../src/project/gameBlueprint";
import type { Project } from "../../../src/project/types";
import { createV2Tools } from "../../../src/ai/v2/tools/verbs";
import { V2Session } from "../../../src/ai/v2/turn/session";
import { exposeV2Tools } from "../../../src/ai/v2/tools/toolExposure";
import { buildV2SystemPrompt } from "../../../src/ai/v2/prompt/systemPrompt";
import { buildsWholeGame, wantsWholeGame } from "../../../src/ai/v2/request/readers";
import { wantsGameTools } from "../../../src/ai/v2/request/readers";

/** 요청 묶음 — 작은 일·장소·게임 전체·소리·이어 하기, 그리고 2026-11-11 재점검에서 잘못 갈린 문장들. 더하기만 한다(순서가 열쇠다). */
const REQUESTS: readonly string[] = [
  // 작은 일
  "이 맵에 상점 주인 한 명 세워 줘.", "이 NPC를 두 칸 왼쪽으로 옮겨 줘", "저 상자를 방 안쪽으로 옮겨 줘", "촌장 대사를 좀 더 무뚝뚝하게 바꿔 줘",
  "광장 빈 곳에 나무랑 벤치 좀 놓아 줘", "여기 보물상자 하나 놓고 포션 3개 넣어 줘", "이 문을 지나면 동굴로 가게 이어 줘", "촌장한테 말 걸면 열쇠를 받게 해 줘",
  "슬라임 세 마리와 싸우는 전투 하나 넣어 줘", "오프닝 장면 하나 만들어 줘", "게임 제목을 '별의 노래'로 바꿔 줘", "주인공 이름을 하린으로 바꿔 줘",
  "이 맵 이름을 '안개 마을'로 바꿔 줘", "레버를 당기면 다리가 내려오게 해 줘", "엔딩까지 가는 길에 표지판 하나 세워 줘", "썸네일 그림 하나 골라 줘",
  // 장소 하나
  "여관 1층 하나 지어 줘", "독서실 실내 하나 지어 줘", "작은 마을 하나 만들어 줘", "3층짜리 동굴 던전 만들어 줘", "숲길 하나 만들어 줘", "편의점 앞 밤거리 하나 만들어 줘",
  // 게임 하나
  "판타지 RPG 게임 하나 만들어 줘.", "재밌는 게임 만들어 줘.", "방탈출 게임 만들어 줘.", "추리 게임 하나 만들어 줘", "학교 괴담 모험 게임 하나 만들어 줘.",
  "북방 설원에서 벌어지는 게임 하나 만들어 줘.", "연애 시뮬레이션 게임 만들어 줘", "몬스터를 잡아 모으는 게임 만들어 줘", "카페 경영 게임 만들어 줘", "게임 속 상점 NPC 만들어 줘",
  // 소리·그림·기타
  "마을에 잔잔한 배경 음악 깔아 줘", "엔딩 크레딧 음악 넣고 크레딧에 내 이름도 넣어 줘", "보스 전투 음악을 더 긴박하게 바꿔 줘", "타이틀 화면 그림 새로 그려 줘",
  "사냥터에서 경험치 쌓게 해 줘", "처음부터 끝까지 대사 맞춤법 검토해 줘", "이 게임 뭐가 부족한지 알려 줘",
  // 이어 하기
  "계속", "남은 거 마저 해 줘", "아직 다 안 된 것 같아. 처음에 부탁한 대로 끝까지 만들어 줘. 게임을 처음부터 엔딩까지 실제로 플레이할 수 있게 해 줘.",
  // 2026-11-11 요청 의도(B1) — 이어 하기·이름과 대사 속 낱말·게임의 한 부분·조우
  "끝까지 만들어 줘", "이 대사 계속 나오게 해 줘", "촌장이 \"배경 음악이 참 좋지?\"라고 말하게 해 줘", "여관 주인 추가해 줘", "게임 타이틀 화면 만들어 줘", "풀숲에서 슬라임이 튀어나오게 해 줘",
  // 2026-11-11 지시문·도구 예산(B3) — 휑한 야외 채우기·장비·묘사뿐인 글
  "마을이 좀 허전해. 꾸며 줘", "주인공 무기를 철검으로 바꿔 줘", "폐업 직전 태엽 장난감 가게",
];

const sha = (value: unknown): string => createHash("sha1").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex").slice(0, 10);

/** 프로젝트 상태 — 빈 프로젝트 / 이벤트가 하나 있는 프로젝트 / 게임 하나를 만든 적 있는 프로젝트(청사진에 첫 요청이 남아 있다). */
const STATES: Readonly<Record<string, () => Project>> = {
  blank: () => createBlankProject(),
  oneEvent: () => withEvent(createBlankProject()),
  builtGame: () => {
    const project = withEvent(createBlankProject());
    project.gameBlueprint = normalizeGameBlueprint({
      title: "시험 게임", genre: "판타지 RPG", playerGoal: "샘을 되찾자.", request: "판타지 RPG 게임 하나 만들어 줘.",
      steps: [{ id: "s1", place: "시작", event: "촌장", action: "촌장에게 묻는다", gives: "실마리", needs: [], feeling: "궁금함" }, { id: "s2", place: "시작", event: "샘", action: "샘을 살핀다", gives: "끝", needs: ["실마리"], feeling: "안도" }],
      ending: { name: "끝", how: "샘을 살핀다", feeling: "안도" },
    });
    return project;
  },
};

function withEvent(project: Project): Project {
  const map = project.maps[project.startMapId]!;
  map.events = [...(map.events ?? []), { id: "ev_golden_npc", name: "촌장", x: 2, y: 2, pages: [{ id: "ev_golden_npc_p1", conditions: [], trigger: { kind: "action" }, commands: [{ kind: "text", body: "어서 오게." }] }] } as never];
  return project;
}

/** 맵 이름을 보는 분류(이미 있는 맵 둘을 잇기) — 두 맵짜리 상태에서 이 요청들만 찍는다. */
const TWO_MAP_REQUESTS: readonly string[] = [
  "잿불 마을 동쪽 끝에서 동쪽 들판으로 넘어갈 수 있게 해 줘. 들판에서 마을로 돌아오는 길도 만들어 줘",
  "잿불 마을 옆에 새 마을을 만들고 동쪽 들판과 이어 줘",
];
function twoMaps(): Project {
  const project = withEvent(createBlankProject());
  const village = project.maps[project.startMapId]!;
  village.name = "잿불 마을";
  project.maps.map_golden_field = { ...structuredClone(village), id: "map_golden_field", name: "동쪽 들판", events: [] };
  return project;
}

/** 청사진의 단계가 다 지어진 게임(GameBlueprintStep.built) — 게임 하나를 잇는 요청의 처음 목록이 고치는 도구로 줄어드는 상태. 이 요청들만 찍는다. */
const PATH_BUILT_REQUESTS: readonly string[] = [
  "아직 다 안 된 것 같아. 처음에 부탁한 대로 끝까지 만들어 줘. 게임을 처음부터 엔딩까지 실제로 플레이할 수 있게 해 줘.",
  "계속",
];
function pathBuilt(): Project {
  const project = STATES.builtGame!();
  for (const step of project.gameBlueprint!.steps) step.built = { mapId: project.startMapId, eventId: "ev_golden_npc" };
  return project;
}

type Shot = { whole: boolean; wholeWithProject: boolean; game: boolean; sysChars: number; sys: string[]; upFront: string[]; lazy: string[] };

function shoot(task: string, project: Project): Shot {
  // 숲길 도구 설명은 실행마다 다른 설계 과제를 뽑는다(forestBrief.ts — 일부러 그렇게 했다). 스냅숏에서는 같은 씨앗으로 고정한다.
  let seed = 20261111;
  Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000);
  const ctx = { project, currentMapId: project.startMapId, assistantRun: true };
  const env = { ctx, request: { task, provider: "local-cli:claude", mapIds: [], project, projectKey: "golden-key" }, emit: () => {}, record: () => {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {} } as never;
  const tools = createV2Tools(env, new V2Session());
  const exposure = exposeV2Tools(env, tools);
  const sys = buildV2SystemPrompt(project, project.startMapId, task, undefined, "golden-key");
  const mark = (t: { name: string; description?: string; parameters?: unknown }) => `${t.name}:${sha({ d: t.description, p: t.parameters })}`;
  return {
    whole: wantsWholeGame(task), wholeWithProject: buildsWholeGame(project, task), game: wantsGameTools(task),
    sysChars: sys.reduce((n, block) => n + block.length, 0), sys: sys.map((block) => sha(block)),
    upFront: exposure.tools.map((t) => mark(t as never)), lazy: [...exposure.lazy.values()].map((t) => mark(t as never)).sort(),
  };
}

function diff(aPath: string, bPath: string): number {
  const a = JSON.parse(readFileSync(aPath, "utf8")) as Record<string, Shot>, b = JSON.parse(readFileSync(bPath, "utf8")) as Record<string, Shot>;
  let changed = 0;
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[key], y = b[key];
    if (!x || !y) { changed += 1; console.log(`${key}: ${x ? "뒤에 없음" : "앞에 없음"}`); continue; }
    const fields = (Object.keys(x) as (keyof Shot)[]).filter((f) => JSON.stringify(x[f]) !== JSON.stringify(y[f]));
    if (!fields.length) continue;
    changed += 1;
    const names = (list: string[]) => new Set(list.map((entry) => entry.split(":")[0]!));
    const detail = fields.map((f) => {
      if (f === "upFront" || f === "lazy") {
        const before = names(x[f]), after = names(y[f]);
        const gone = [...before].filter((n) => !after.has(n)), came = [...after].filter((n) => !before.has(n));
        const reshaped = x[f].filter((entry) => after.has(entry.split(":")[0]!) && !y[f].includes(entry)).map((entry) => entry.split(":")[0]!);
        return `${f}(빠짐 ${gone.join(",") || "-"} · 생김 ${came.join(",") || "-"} · 글/스키마 바뀜 ${reshaped.join(",") || "-"}${!gone.length && !came.length && !reshaped.length ? " · 순서만" : ""})`;
      }
      if (f === "sys") return `sys(블록 ${x.sys.length}→${y.sys.length}, 달라진 자리 ${x.sys.map((h, i) => (h === y.sys[i] ? "" : String(i))).filter(Boolean).join(",") || "끝"})`;
      return `${f}(${String(x[f])}→${String(y[f])})`;
    });
    console.log(`${key}: ${detail.join(" · ")}`);
  }
  console.log(changed ? `달라진 요청 ${changed}/${Object.keys(a).length}` : `같다 (${Object.keys(a).length} 요청)`);
  return changed ? 1 : 0;
}

const args = process.argv.slice(2);
if (args[0] === "--diff") process.exit(diff(args[1]!, args[2]!));
const out: Record<string, Shot> = {};
for (const [state, make] of Object.entries(STATES)) for (const task of REQUESTS) out[`${state} | ${task}`] = shoot(task, make());
for (const task of TWO_MAP_REQUESTS) out[`twoMaps | ${task}`] = shoot(task, twoMaps());
for (const task of PATH_BUILT_REQUESTS) out[`pathBuilt | ${task}`] = shoot(task, pathBuilt());
writeFileSync(args[0] ?? "/dev/stdout", JSON.stringify(out, null, 1));
if (args[0]) console.log(`${args[0]}: ${Object.keys(out).length} 요청 × 상태`);
