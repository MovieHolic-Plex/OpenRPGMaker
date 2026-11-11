// 끝맺음 관문 — 모델이 «끝» 이라 할 때 남은 문제를 모은다: 고칠 수 있는 장소 문제(비평·기계 검사), 게임 검사·출하 차단 줄, 자동 플레이, 그림 생성 시도.
// 할 일 고리(loop/gates.ts)가 이 문제들을 gate·critic 항목으로 덧붙인다. 2026-11-11 리팩토링 R2: verbs.ts 끝에 있던 것을 옮겼다.
import { sceneCraftProblems } from "./sceneCraft";
import { shipBlockers } from "./shipChecks";
import { asksSettingOnly, asksStoreOnly, asksToBeTold, buildsWholeGame } from "../request/readers";
import type { PiAssistantV2Env } from "../shared/env";
import { type StageWrites } from "../shared/stageWrites";
import type { Project } from "@/project/types";
import { audioOnly } from "../request/readers";
import { gameContentProblems } from "./gameChecks";
import { unaskedChanges } from "./sideEffectChecks";
import { AUTOPLAY_GATE_PREFIX, playProblems } from "./playCheck";
import { combatProblems } from "./combatChecks";
import { fieldBattleStrain } from "../story/pathBattleBudget";
import { placeLayoutProblems } from "../place/builders/placeLayout";
import { V2Session } from "../turn/session";
import { placeFixVerbs } from "./placeFix";
import { V2_MAX_REPAIR_ROUNDS } from "../turn/session";
import { stageOpensBattle } from "../story/stageBattle";

/** 음악 요청의 일감인 게임 검사 줄 — 나머지(이미 있던 위협·출하 차단 등)는 음악만 바라는 요청에서 참고다. */
const isMusicWork = (line: string) => /^\[게임 검사 (음악|효과음|실행|부작용)\]/u.test(line);

/** 끝맺음 관문이 짚은 문제 하나 — 할 일 고리(src/ai/v2/loop)가 gate·critic 항목으로 덧붙인다. key 가 같으면 같은 문제다. */
export interface V2GateProblem { readonly key: string; readonly text: string; readonly source: "gate" | "critic" }

const gateKey = (text: string): string => text.replace(/\d+/gu, "#").replace(/\s+/gu, " ").trim().slice(0, 160);

/**
 * 끝맺음 관문의 재료 — 고칠 수 있는 장소 문제(비평 major·기계 검사, 맵당 고치기 상한 전)와 게임 검사·출하 차단 줄.
 * leftovers = 고치기 상한에 닿아 보고로만 갈 장소 문제, missing = 그림·부품이 없어 못 한 것. 사용자에게 물은 실행은 비운다.
 */
/** 게임 내용 검사 글(날씨·엔딩·상태·물건·깃발·부작용 + 전투 + 출하 차단). before = 요청 시작 저장본. */
function gameProblemTexts(before: Project, after: Project, task: string, writes?: StageWrites): string[] {
  let game: string[] = [];
  try { game = [...gameContentProblems(before, after, task), ...unaskedChanges(before, after, task, writes)]; } catch { game = []; }
  // 끝까지 깰 수 있는 전투인가(2026-10-25 판정 J55·J4): 회복 수단 없음·시키지 않은 무작위 조우·첫 구역이 너무 센 조우.
  try { game.push(...combatProblems(before, after, task)); } catch { /* 검사 실패는 무시 */ }
  // 새로 둔 보이는 적을 시작 파티로 재기(2026-10-30 omo-fr-o: 「약한 몬스터」 숲에 승률 93% 무리를 두어 판정자가 졌다) — 청사진 길 밖 전투까지.
  try { game.push(...fieldBattleStrain(before, after, task)); } catch { /* 검사 실패는 무시 */ }
  // 장면 손질(2026-10-31 서사): 새로 쓴 장면의 반복 대사·대사 속 이름·한두 줄짜리 장면·멈춘 화면·혼잣말 대화·제자리 못 찾는 사람.
  try { game.push(...sceneCraftProblems(before, after, task)); } catch { /* 검사 실패는 무시 */ }
  // 출하 차단(2026-10-25 사용자 규칙): 게임을 만드는 요청이면 편집기 기본값·한 줄 엔딩이 남은 채 «다 됐다»고 하지 못한다.
  try { game.push(...shipBlockers(after, task).filter((b) => b.id !== "combat-no-healing" /* combatProblems no-healing 이 같은 것을 짚는다 */).map((b) => `[출하 차단 ${b.id}] ${b.message} 고치지 못하면 «완성»이라고 쓰지 말고 남은 기본값으로 보고한다.`)); } catch { /* 검사 실패는 무시 */ }
  return game;
}

/**
 * 시작 저장본에 이미 있던 게임 검사 문제의 열쇠(before=after=시작 저장본). 할 일 고리는 이 열쇠와 같은 관문 문제를 «기존 결함»으로 보고에만 싣고
 * 완료를 막지 않는다(2026-10-30 omo-loop-1030: 버들마을 출입구 그림 없음이 세 장면 모두 할 일이 됐다).
 */
export function v2BaselineGameKeys(project: Project, task: string): Set<string> {
  const keys = new Set(gameProblemTexts(project, project, task).map((g) => `game:${gateKey(g)}`));
  for (const p of autoPlayGateProblems(project, task)) keys.add(p.key);
  return keys;
}

/** 끝까지 플레이되는가(2026-11-09 assistant-reward 기준선: 몬스터 수집 두 판이 «완료»인데 엔딩까지 걸어갈 길이 없었다) — 게임을 만드는 요청만. 열쇠는 막힌 실행·단계마다 하나다. */
function autoPlayGateProblems(project: Project, task: string): V2GateProblem[] {
  if (!buildsWholeGame(project, task)) return [];
  try { return playProblems(project).map((p) => ({ key: `${AUTOPLAY_GATE_PREFIX}${p.key}`, text: p.text, source: "gate" as const })); } catch { return []; }
}

/**
 * 연출 비평가는 지도 틀만 본다 — 전투 화면은 그 틀에 없다. 컷신(또는 그 사람)이 지금 전투를 연다면 «싸움이 안 보인다»류 지적은 지난 일이다
 * (2026-10-30 omo-loop-1030b terra boss-room r1·r3: 컷신에 전투를 patch_event_page 로 붙이고 run_scene_test 로 전투 진입까지 확인했는데,
 * 붙이기 전에 받은 연출 비평 «요청한 싸움은 보이지 않는다»가 관문 항목으로 남아 두 판 모두 막힘으로 끝났다).
 */
const FIGHT_WORD = /싸움|싸우|전투|결투|battle|fight/iu;

function withoutStaleFightCritique(project: Project, session: V2Session, open: ReturnType<V2Session["unresolved"]>): ReturnType<V2Session["unresolved"]> {
  return open.map((o) => {
    const st = o.name.includes("컷신(") ? session.stages.get(o.mapId) : undefined;
    if (!st || !stageOpensBattle(project, o.mapId, st.eventIds)) return o;
    return { ...o, problems: o.problems.filter((p) => !(p.startsWith("[연출 비평]") && FIGHT_WORD.test(p))) };
  }).filter((o) => o.problems.length);
}

export function v2GateProblems(session: V2Session, env?: PiAssistantV2Env): { problems: V2GateProblem[]; leftovers: string[]; missing: string[] } {
  if (session.questions.length) return { problems: [], leftovers: [], missing: [] };
  const open = env ? withoutStaleFightCritique(env.ctx.project, session, session.unresolved()) : session.unresolved();
  const missing = [...session.missingArt];
  const fixable = open.filter((o) => o.rounds < V2_MAX_REPAIR_ROUNDS);
  // 게임 내용 검사(날씨·엔딩·상태·물건 고르기·깃발·부작용) — 요청 낱말과 실제로 바뀐 이벤트를 맞댄다.
  let game: string[] = env ? gameProblemTexts(env.request.project, env.ctx.project, env.request.task, session.stageWrites) : [];
  // 아무것도 안 바꾸고 «도구가 없다»며 끝내기(2026-10-24 g3-edit-move: 대장장이 옮기기를 묻기만 했다, g3-apple-count: 그림 카드만 남겼다).
  // 설정이 이미 기본값(켜짐)이면 set_project_settings 가 아무것도 안 바꾸는 것이 맞다(2026-10-25 데모 과업: 탭 걷기·팡파레·빠른 달려들기는 기본 켜짐).
  const settingOnly = asksSettingOnly(env?.request.task ?? "");
  // 스토어 평가 읽기·답글·소식 카드는 프로젝트를 바꾸지 않는 것이 맞다(2026-10-25).
  // «내 게임 평가에 답글 달아 줘»처럼 «게임» 낱말이 섞여도 만들기·고치기 동사가 없으면 스토어 일로 본다.
  const storeOnly = asksStoreOnly(env?.request.task ?? "");
  if (env && !settingOnly && !storeOnly && !asksToBeTold(env.request.task)) {
    const pick = (p: typeof env.ctx.project) => JSON.stringify([p.maps, p.database, p.endings ?? null, p.commonEvents ?? null, p.switches, p.variables, p.startMapId, p.startPos ?? null, p.system ?? null, p.dialogueDesk ?? null]);
    try {
      if (pick(env.request.project) === pick(env.ctx.project)) game.push("[게임 검사 실행] 이 요청으로 맵·데이터가 하나도 바뀌지 않았다. 묻거나 «도구가 없다»·«도구 호출 횟수 초과»라고 끝내지 말고 실행한다(도구 호출 횟수 제한은 없다 — 2026-10-29 3c Argon 이 room_parts 한 번 뒤 «호출 횟수 초과»라며 짓지 않았다). 장소·방은 make_place(방은 zones[].design 을 채워서)로 짓는다. 있는 NPC·물건은 move_event·upsert_event·patch_event_page 로 고치고, 새 것은 add_people·add_event·upsert_event 로 만든다. 꼭 맞는 그림이 없으면 가장 비슷한 기존 그림·물건으로 두고 보고에 적는다(아이템·이벤트·대사는 그림과 상관없이 만든다).");
    } catch { /* 비교 실패는 무시 */ }
  }
  // 음악만 바라는 요청: 음악 밖 지적(이미 있던 체크포인트 위협·출하 차단…)은 일감이 아니다 — 한 바퀴를 더 돌리지 않고 기록에만 남긴다.
  if (env && audioOnly(env.request.task)) {
    const outside = game.filter((g) => !isMusicWork(g));
    game = game.filter(isMusicWork);
    if (outside.length) env.emit({ type: "execution_status", name: "v2.music-only.notes", ok: true, summary: `음악 요청 밖 참고 ${outside.length}건 — 고치지 않음`, data: { notes: outside } });
  }
  // 작은 수정·음악 요청 턴이 «게임으로 시작한 프로젝트»의 옛 맵 화면 그림 때문에 막히지 않게: 이번 턴이 게임 하나를 짓는 일(buildsWholeGame — 이어 하기 턴도)이거나 시작 저장본에는 없던 map-view 일 때만.
  if (env && (buildsWholeGame(env.ctx.project, env.request.task) || mapViewArtProblems(env.request.project, session, !!env.generateImage, env.request.task).length === 0)) game.push(...mapViewArtProblems(env.ctx.project, session, !!env.generateImage, env.request.task));
  const problems: V2GateProblem[] = [
    ...game.map((g) => ({ key: `game:${gateKey(g)}`, text: g, source: "gate" as const })),
    ...(env && !settingOnly && !storeOnly ? autoPlayGateProblems(env.ctx.project, env.request.task) : []),
    // 열쇠는 맵(과 장소/컷신)마다 하나 — 고칠 때마다 문제 글이 바뀌어도 같은 항목이 다시 열려 시도 상한(3)이 센다.
    ...fixable.map((o) => ({ key: `place:${o.mapId}:${o.name.includes("컷신(") ? "stage" : "place"}`, text: `${o.name}(${o.mapId}) 고치기 — ${placeFixVerbs(session, env?.ctx.project, o.mapId)}, 컷신은 add_event: ${o.problems.slice(0, 5).join(" / ")}`,
      source: o.problems.some((p) => p.startsWith("[비평")) ? "critic" as const : "gate" as const })),
  ];
  // 칸 배치 장소(placeLayout.ts): 배치 항목이 맵에 있나·이어짐·보스 앞방·문앞 길·자기 비평 두 바퀴 — 지금 맵에서 다시 잰다.
  if (env) problems.push(...placeLayoutProblems(env.ctx.project, session, (m) => (session.places.get(m)?.rounds ?? 0) < V2_MAX_REPAIR_ROUNDS));
  const leftovers = open.filter((o) => o.rounds >= V2_MAX_REPAIR_ROUNDS).map((o) => `${o.name}: ${o.problems.slice(0, 4).join(" / ")}`);
  return { problems, leftovers, missing };
}

/**
 * 오너 2026-11-09 「인게임 스크린샷은 AI 가 그림을 그릴 수 없을 때로만」: 타이틀·엔딩 그림이 맵 화면(map-view)이면, 이 실행에 그림 생성 경로가 있는 한
 * generate_art 를 먼저 시도해야 한다. 시도가 오류/불가로 기록돼 있으면(artAttempts) 그 실패가 증거라 맵 화면을 받아 준다.
 * 시도가 성공했는데 그림이 여전히 맵 화면이면(그 뒤에 다시 덮어씀) 다시 열린다.
 */
export function mapViewArtProblems(project: Project, session: V2Session, canGenerate: boolean, task: string): string[] {
  if (!canGenerate || !buildsWholeGame(project, task)) return [];
  const out: string[] = [];
  const isView = (id: string | undefined): boolean => typeof id === "string" && id.startsWith("map-view:");
  const attempt = (t: "title" | "ending") => session.artAttempts.get(t);
  // 열리는 경우: 이 실행에 생성기가 없었다(unavailable) 또는 같은 대상에서 두 번 실패(failed ≥ 2). 성공(ok)은 문을 열지 않는다.
  const accepted = (t: "title" | "ending") => { const a = attempt(t); return !!a && (a.status === "unavailable" || (a.status === "failed" && (a.failures ?? 1) >= 2)); };
  const title = (project.system.titleScreen ?? {}) as { backgroundResourceId?: string };
  const titleBg = title.backgroundResourceId ?? ((project.system as unknown as { titleResourceId?: string }).titleResourceId);
  if (isView(titleBg) && !accepted("title")) out.push("[출하 차단 art-generation] 타이틀 그림이 게임 속 맵 화면(" + titleBg + ")이다 — 그림을 만들 수 있으니 맵 화면으로 두지 않는다. generate_art{target:\"title\", prompt:<이 이야기의 장면>} 으로 그림을 만든다. 생성이 오류로 실패하면(기록됨) 그때는 맵 화면을 받아 준다. 고치지 못하면 «완성» 이라고 하지 않는다.");
  for (const ending of project.endings ?? []) {
    const bg = ending.presentation?.backgroundResourceId;
    if (isView(bg) && !accepted("ending")) { out.push("[출하 차단 art-generation] 엔딩 「" + (ending.name || ending.id) + "」 그림이 게임 속 맵 화면(" + bg + ")이다 — generate_art{target:\"ending\", prompt:<엔딩 장면>} 으로 그림을 만든다. 생성이 오류로 실패하면(기록됨) 그때는 맵 화면을 받아 준다."); break; }
  }
  return out;
}
