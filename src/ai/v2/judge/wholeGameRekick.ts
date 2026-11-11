// 게임이 아직 얇거나 안 지어졌다는 신호와 다시 차기 글 — 게임 하나를 만드는 요청에서 모델이 일찍 멈췄을 때 쓴다.
import type { Project } from "@/project/types";
import { isBlankCanvasMap } from "@/project/tilesetBaseline";
import { withoutIntentNote } from "@/ai/piAgent/monsterGameRequest";
import { battleSites, encounterMaps, healingSources, repeatableHealingSources } from "./combatChecks";
import { projectScriptMentionsCmdKind } from "@/project/script/effects";
import { SINGLE_PLACE, ONE_ROOM_GAME } from "../request/scope";
import { allCommands } from "./shipCheckReads";
import { PLACEHOLDER_NAMES, editorDefaultsLeft } from "./shipChecks";

/**
 * 게임이 «아직 안 지어졌다»는 신호 — 뼈대 자리표시만 남았거나 엔딩이 없다, 싸우는데 회복할 길이 없다, 첫 화면(제목·오프닝)이 편집기 기본이다.
 * 기본 HUD·창·전투 곡 같은 나머지 마감 항목은 여기서 보지 않는다(플레이를 막거나 첫인상을 깨지 않는다).
 */
export const WHOLE_GAME_REKICKS = 3;

/** 기록에서 말을 거는 사람(그림이 있고 대사 명령이 있는 이벤트). */
function talkingCharacters(project: Project): number {
  let n = 0;
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    const pages = (ev.pages ?? []) as unknown as { graphic?: { sprite?: unknown; appearanceId?: unknown }; commands?: unknown }[];
    if (pages.some((p) => (p.graphic?.sprite || p.graphic?.appearanceId) && JSON.stringify(p.commands ?? []).includes('"kind":"text"'))) n += 1;
  }
  return n;
}

/**
 * 게임이 너무 얇다 — 플레이할 맵이 한 장이거나, 말 거는 인물이 하나 이하거나, 이벤트가 다섯 개 미만.
 * 실측(2026-11-05 gpt-only-game 1~7차, Terra 혼자): 「학교 연애 게임 만들어줘」는 일곱 번 모두 맵 1장·이벤트 1~2개, 「좀비 생존」은 맵 1장·이벤트 1~7개로
 * 몇 초 만에 끝났다. 판타지·마을(맵 2장·이벤트 11~12개·말 거는 인물 3~9)은 걸리지 않는다. 짧은 요청도 구체적인 변형으로 넓혀 바로 짓게 한다.
 */
export function thinGameSign(project: Project, task = ""): string | undefined {
  const maps = Object.values(project.maps).filter((m) => !isBlankCanvasMap(m) && (m.events ?? []).length > 0);
  const events = maps.reduce((n, m) => n + (m.events ?? []).length, 0);
  const talkers = talkingCharacters(project);
  // 방 하나·혼자 갇힌 게임(「방 하나만 있는 방탈출」)은 요청이 좌은 것이다 — 맵·인물 수는 보지 않고 할 일(이벤트)만 본다.
  const onePlace = SINGLE_PLACE.test(withoutIntentNote(task)) || ONE_ROOM_GAME.test(withoutIntentNote(task));
  const short: string[] = [];
  if (!onePlace && maps.length < 2) short.push(`플레이할 맵이 ${maps.length}장`);
  // 인물이 적어도 할 일이 넉넉하면(이벤트 8개 이상) 얇은 게임이 아니다.
  if (!onePlace && talkers < 2 && events < 8) short.push(`말 거는 인물이 ${talkers}명`);
  if (events < 5) short.push(`이벤트가 ${events}개`);
  if (!short.length) return undefined;
  return `게임이 너무 얇다(${short.join(", ")})`;
}

/** 다 지어진(엔딩·맵·회복) 게임이 얇을 때 한 번 넓혀 짓게 하는 글 — 「덜 지어졌다」가 아니라 「넓힌다」다. */
export function widenGamePrompt(sign: string): string {
  return [
    `[넓혀 짓기] 끝까지 플레이되는 게임이지만 ${sign}.`,
    "짧은 요청이어도 구체적인 변형으로 넓혀 지금 바로 짓는다 — 다시 묻지 않는다:",
    "- 장소를 2~3곳(예: 교실·복도·옥상, 대피소·폐허 거리·탈출구)으로 나눠 문으로 잇는다.",
    "- 말 거는 인물을 2명 이상 둔다.",
    "- 단서·선택·사건 이벤트를 더해 엔딩 전에 해야 할 일이 세 가지 이상 되게 한다.",
    "지금 있는 엔딩·출구·이벤트는 지우지 않고 그 앞에 잇는다.",
  ].join("\n");
}

export function unbuiltGameSigns(project: Project, _task: string): string[] {
  const out: string[] = [];
  const skeleton = (project.endings ?? []).filter((e) => PLACEHOLDER_NAMES.has(e.name.trim()));
  const real = (project.endings ?? []).filter((e) => !PLACEHOLDER_NAMES.has(e.name.trim()));
  if (skeleton.length && !real.length) out.push(`엔딩이 뼈대 자리표시(${skeleton.map((e) => `「${e.name}」`).join("·")})뿐이다 — 요청한 이야기의 엔딩이 없다`);
  // 게임 하나를 만드는 요청(호출자가 wantsWholeGame 으로 거른다)에 엔딩이 없으면 끝낼 수 없는 게임이다 — 요청에 「엔딩」 낱말이 없어도.
  // 실측(2026-11-05 gpt-only-game, Terra 혼자): 「좀비 생존 게임 만들어줘」가 오프닝만 짓고 엔딩·맵 없이 턴을 끝냈는데 이어 짓기가 돌지 않았다.
  else if (!real.length) out.push("엔딩이 하나도 없다");
  if (!Object.values(project.maps).some((map) => !isBlankCanvasMap(map))) out.push("플레이할 맵이 없다 — 손대지 않은 빈 시작 맵뿐이다");
  // 실측(2026-11-05 gpt-only-game 9차 좀비, Terra 혼자): 야영지·보급로는 지었는데 마지막 구간(상자·좀비 전투·봉쇄문·탈출 엔딩)을
  // 풀밭 한 가지뿐인 빈 시작 맵(「빈 맵」)에 놓았다 — 플레이어는 엔딩 직전을 빈 풀밭에서 논다. 다른 맵을 지었을 때만 본다
  // (맵 한 장뿐인 게임은 위·thinGameSign 이 다룬다).
  const bare = Object.values(project.maps).filter((map) => (map.events ?? []).length > 0 && isBlankCanvasMap({ ...map, events: [] }));
  if (bare.length && Object.values(project.maps).some((map) => !isBlankCanvasMap({ ...map, events: [] }))) {
    out.push(`맵 ${bare.slice(0, 2).map((m) => `「${m.name}」(${m.id}, 이벤트 ${m.events.length}개)`).join("·")}은 사건이 놓였는데 바닥 한 가지뿐인 빈 캔버스다 — `
      + "그 맵에 이야기에 맞는 장소(길·건물·지형)를 까고 이름을 붙인다. 이벤트·문·엔딩은 지우지 말고 두거나 다른 지은 맵으로 옮긴다.");
  }
  const skeletonEvents = Object.values(project.maps).flatMap((m) => (m.events ?? []).filter((ev) => PLACEHOLDER_NAMES.has(String(ev.name ?? "").trim())).map((ev) => `「${ev.name}」(${m.name})`));
  if (skeletonEvents.length && !real.length) out.push(`뼈대 이벤트가 그대로다: ${skeletonEvents.slice(0, 3).join(" · ")}`);
  // 실측(2026-11-05 gpt-only-game, Terra 혼자): 엔딩까지 지은 게임도 실제 플레이에서 막혔다 — 「마을부터」는 숲길 슬라임 조우에 회복 수단이 0이라
  // 두 번째 전투에서 게임 오버, 판타지·고양이는 첫 화면이 기본 오프닝(「강을 낀 왕국…」), 마을은 타이틀이 「새 프로젝트」였다. v2 끝맺음은 이것을 채우지만 v1 은 못 본다.
  const sites = battleSites(project);
  if (sites.length && !healingSources(project).length) out.push(`전투가 있는데(${sites.slice(0, 2).join(", ")}) 회복 수단이 하나도 없다 — 몇 번 싸우면 게임 오버다. place_savepoint{mapId:시작 맵, heal:true} 나 set_session_start{inventory:{item_potion:3}} 로 회복 길을 넣는다`);
  else if (encounterMaps(project).length && !repeatableHealingSources(project).length) {
    // 실측(2026-11-05 「마을부터」 4차): 숲길 무작위 조우(18%)에 회복은 상자 회복약 하나뿐 — 돌아오는 길 네 번째 전투에서 게임 오버.
    // 조우는 끝이 없으니 한 번 주는 회복약·시작 소지품으로는 모자라다 — 되풀이되는 회복(여관·회복 세이브·상점·드롭·회복 기술)이 있어야 한다.
    out.push(`무작위 조우(${encounterMaps(project).slice(0, 2).map((id) => project.maps[id]?.name ?? id).join(", ")})가 끝없이 나오는데 회복은 한 번 주는 것뿐이다 — 오가다 게임 오버다. place_savepoint{heal:true} 를 조우 맵 입구나 마을에 두거나 회복약 파는 상점을 둔다`);
  }
  for (const left of editorDefaultsLeft(project)) {
    if (left.id === "title-name" || left.id === "opening") out.push(left.message);
  }
  // 실측(2026-11-05 「좀비 생존」 4차): 이야기를 다 지은 뒤 고치기 두르기에서 author_dungeon{rebuild:true} 가 맵 이벤트를 전부 지워
  // 엔딩을 부르는 출구·열쇠 상자가 사라졌다. 엔딩은 남아 「엔딩이 없다」는 안 떠 이어 짓기가 멈췄다.
  if (real.length && !allCommands(project).some((r) => r.cmd.kind === "triggerEnding" || r.cmd.kind === "ending")
    && !projectScriptMentionsCmdKind(project, "triggerEnding") && !projectScriptMentionsCmdKind(project, "ending")) {
    out.push(`엔딩(${real.slice(0, 2).map((e) => `「${e.name}」`).join("·")})은 있는데 어떤 이벤트도 부르지 않는다 — 끝낼 수 없는 게임이다. 마지막 사건 이벤트에 {kind:"triggerEnding", endingId:"${real[0]!.id}"} 를 넣는다`);
  }
  return out;
}

export function wholeGameRekickPrompt(missing: readonly string[]): string {
  return [
    "[이어 짓기] 게임이 아직 다 지어지지 않았다:",
    ...missing.map((m) => `- ${m}`),
    "다음에 할 일을 말로 적고 멈추지 말고, 지금 바로 도구를 불러 요청한 게임(장소·인물·사건·엔딩)을 이어 짓는다. 뼈대 자리표시(기억의 조각·첫 구간 끝)는 요청한 이야기의 장면으로 바꾸거나 지운다.",
    "정말 더 지을 수 없으면(도구가 거절·제공자 오류) 지은 것과 못 지은 것을 사실대로 보고하고 끝낸다.",
  ].join("\n");
}
