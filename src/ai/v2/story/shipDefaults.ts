// 조수 v2 출하 기본값 채우기 — 싼 모델이 끝내 못 고쳐 출하가 막히거나 경고만 남는 출하 검사 여섯(2026-10-29 vm1 측정):
import { blueprintPlaceName } from "@/project/blueprintAssembly";
import type { Project } from "@/project/types";
import { editorDefaultsLeft, endingClosureProblems, endingConditionsUnset, emptySparkles, selfLoopTransfers, silentLockedExits, writtenStateIds } from "../judge/shipChecks";
import { defaultPlaceLeaks } from "../judge/shipArtChecks";
import { strayStepCopies } from "./blueprint";
import { offArtEntrances } from "../judge/discoverability";
import { lateStartObjective, repeatingStartObjectives } from "../judge/objectivePlan";
import { normalizeGameOverSettings } from "@/project/cinematicSettings";
import { fieldMenu, storyFieldMenu } from "@/project/fieldMenu";
import { syncMenuFeatures, syncMenuUiStyle } from "@/project/menuSystem";
import { FACTORY_HERO_ARMS } from "../genreDefaults";
import { fitGateLevelCurve, fitRouteLevelsToGates } from "./monsterRouteLevels";
import { fitRequiredBattlesToStarters } from "./monsterRequiredBattles";
import { equipMonsterCampaign } from "./monsterCampaignGifts";
import { beginFitBudget, enterFastFit, FitBudgetExceeded, restoreFitState, snapshotFitState } from "./monsterFitBudget";
import { Obj, fillFieldHud, premiseOf, fillBattleBgm, fillBattleBackgrounds, fillPartyLooks, fillPartyNames, fillWindowLook } from "./shipLookDefaults";
import { moveEntrancesOntoArt, fillStaleObjectives, moveRepeatingStartObjective, pullBackStartObjective, fillGymArrivalObjectives, hasFinal } from "./shipObjectiveDefaults";

/** 출하 기본값을 채운다. 바꾼 항목 설명을 돌려준다(없으면 빈 배열). task 는 실행 지시문(앞선 요청 메모 포함). */
export function applyShipDefaults(project: Project, task = project.gameBlueprint?.request ?? ""): string[] {
  const applied = applyLookDefaults(project);
  if (offArtEntrances(project).length) applied.push(...moveEntrancesOntoArt(project));
  if (repeatingStartObjectives(project).length) applied.push(...moveRepeatingStartObjective(project));
  if (lateStartObjective(project)) applied.push(...pullBackStartObjective(project));
  applied.push(...fillStaleObjectives(project));
  applied.push(...fillGymArrivalObjectives(project));
  // 레벨 맞춤 전에: 경험치 나누기·체육관 회복 지점(깎기보다 먼저 쓰는 수단).
  applied.push(...equipMonsterCampaign(project));
  // 곡선 → 스타터 맞춤(선물 동료·기술·깎기)을 바뀌는 것이 없을 때까지(최대 3바퀴). 선물 동료가 생기면 다음 바퀴 곡선이 관문을 더 올릴 수 있다 —
  // 한 바퀴만 돌면 두 번째 끝맺음이 관문을 또 올렸다(멱등 아님).
  // 맞춤은 시간 예산이 있다(monsterRouteLevels FIT_BUDGET_MS) — 모의전이 워커 이벤트 루프를 수백 초 막아 턴이 끊겼다(2026-11-09 monster).
  // 예산을 넘으면 거기서 멈추고 «미완» 을 한 줄로 남긴다(침묵 금지; 끝맺음 단계가 session.fitIncomplete 로 옮겨 최종 보고가 읽는다).
  beginFitBudget(project);
  // 바퀴마다 맞춤이 건드리는 부분(적·트룹·종 기술 레벨·맵 조우표·이벤트 — 시험으로 바꿨다 되돌리는 값, 선물 동료 splice 포함)을 먼저 떠 둔다.
  // 예산이 시험 한가운데서 터지면(대부분 그렇다) 되돌리기 코드를 건너뛰어 퇴짜 맞은 종·레벨이 출하된다(2026-11-09 ultrabrain 검토) —
  // 그래서 끊긴 바퀴는 통째로 버리고 «마지막으로 끝난 바퀴» 상태로 돌아간다. 그 바퀴까지의 applied 줄은 그대로 남는다.
  for (let round = 0; round < 3; round += 1) {
    // 싼 단계(관문 곡선 → 길 맞춤)는 예산 없이 끝까지 돌고 바로 확정한다(실측 gate 2.5초·route 5ms — 곡선은 맞는다).
    const cheap = [...fitGateLevelCurve(project), ...fitRouteLevelsToGates(project)];
    applied.push(...cheap);
    // 비싼 필수전투 단계(실측 174~343초, 전체의 80%)에만 시간 예산을 건다. 시험 한가운데서 터지면 이 단계만 되돌리고(싼 단계 결과는 남긴다),
    // 빠른 모드(표본 10)로 한 번 더 시도한다. 그래도 넘으면 이 단계만 버리고 «미완» 을 기록한다.
    let required: string[] = [];
    const snap = snapshotFitState(project);
    try { required = fitRequiredBattlesToStarters(project); }
    catch (error) {
      if (!(error instanceof FitBudgetExceeded)) throw error;
      restoreFitState(project, snap);
      enterFastFit(project);
      try { required = fitRequiredBattlesToStarters(project); applied.push(`필수 전투 맞춤: 정밀 모의전(40판)이 ${Math.round(error.spentMs / 1000)}초를 넘겨 빠른 모드(10판)로 다시 맞췄다`); }
      catch (again) {
        if (!(again instanceof FitBudgetExceeded)) throw again;
        restoreFitState(project, snap);
        // 앞 바퀴의 필수전투 맞춤이 이미 끝나 남아 있으면 «미완» 이 아니다(접두 줄은 finish 단계가 session.fitIncomplete 로 읽는다).
        if (round > 0) applied.push(`필수 전투 맞춤: ${round + 1}번째 바퀴는 시간이 모자라 버리고 앞 ${round}바퀴의 맞춤을 그대로 두었다`);
        else applied.push(`${again.message} — 필수 전투 맞춤을 ${round + 1}번째 바퀴에서 멈췄다(빠른 모드도 ${Math.round(again.spentMs / 1000)}초 넘음). 첫 관문 승률이 보정되지 않았을 수 있다`);
        break;
      }
    }
    applied.push(...required);
    if (!cheap.length && !required.length) break;
  }
  if (endingConditionsUnset(project).length) applied.push(...dropDeadEndingConditions(project));
  if (selfLoopTransfers(project).length) applied.push(...dropSelfLoopTransfers(project));
  if (emptySparkles(project).length) applied.push(...dropEmptySparkles(project));
  if (strayStepCopies(project).length) applied.push(...dropStrayStepCopies(project));
  if (silentLockedExits(project).length) applied.push(...explainLockedExits(project));
  applied.push(...attachEndingToLastStep(project));
  // 목표 줄이 있는데 필드 HUD 가 「현재 목표」 줄을 숨기면 켠다(출하 검사 objective-missing — 2026-10-29 vm4 argon 탈출, 목표 글은 다 있었다).
  {
    const hud = project.system.fieldHud as { objective?: boolean } | undefined;
    if (hud && hud.objective === false && JSON.stringify(project.maps).includes('"surface":"objectiveChip"')) { hud.objective = true; applied.push("필드 HUD 「현재 목표」 줄 켬"); }
  }
  applied.push(...forkStackedEndingCalls(project));
  if (endingClosureProblems(project).length) applied.push(...fillEndingClosure(project));
  // 기본 지명 걷어내기는 엔딩 글을 채운 뒤에 — 채운 글(청사진 느낌 칸)에도 그 지명이 들 수 있다.
  applied.push(...removeDefaultPlaceWords(project, task));
  return applied;
}

/**
 * 겉모습 기본값만 채운다 — 전투 곡·전투 배경·파티 모습/얼굴/이름·창 모양·게임 오버·전투 없는 게임의 전투 메뉴. 이벤트·목표·엔딩은 건드리지 않는다.
 * applyShipDefaults 의 앞부분이고, v1 조수(piAgentRuntime)도 게임 하나를 만드는 요청의 끝에서 부른다 — 실측(2026-11-05 gpt-only-game, Terra 혼자 v1):
 * 다섯 판 모두 엔딩까지 플레이되는데 전투 곡·전투 배경·게임 오버·창 모양이 편집기 기본으로 남았다(v2 끝맺음만 이것을 채웠다).
 */
export function applyLookDefaults(project: Project, story = ""): string[] {
  // 청사진 없는 v1 게임은 요청 글(story)을 이야기로 읽는다 — 제목만으로는 성별·장르를 못 고른다.
  const applied: string[] = [];
  const left = new Set(editorDefaultsLeft(project).map((b) => b.id));
  if (left.has("battle-bgm")) applied.push(...fillBattleBgm(project, story));
  if (left.has("battle-background")) applied.push(...fillBattleBackgrounds(project, editorDefaultsLeft(project).find((b) => b.id === "battle-background")?.evidence ?? ""));
  if (left.has("hero-look") || left.has("party-faces")) applied.push(...fillPartyLooks(project, story));
  // 이름은 모습 뒤(고른 칩의 성별로 이름을 고른다), 엔딩 맺음 앞(맺음 글이 새 이름을 쓴다).
  if (left.has("party-names")) applied.push(...fillPartyNames(project, story));
  if (left.has("window-look")) applied.push(...fillWindowLook(project, story));
  if (left.has("game-over")) applied.push(...fillGameOver(project, story));
  applied.push(...keepProgressOnDefeat(project));
  if (left.has("combat-leftovers")) applied.push(...clearCombatLeftovers(project));
  if (left.has("hud")) applied.push(...fillFieldHud(project, story));
  // 제목 그림·엔딩 그림은 함수가 번들 스틸로 대신 깔지 않는다 — 출하 검사(title-image·ending-bg·ending-screen)가 막고 모델이 그림 단계에서 고르거나 만든다.
  return applied;
}

/**
 * 이름 붙은 triggerEnding 이 줄줄이 붙어 있으면(「평범」 엔딩 → 「혼자」 엔딩) 첫 호출만 돈다 — 이름 붙은 호출은 엔딩 조건을 보지 않고 그 엔딩으로 끝낸다
 * (selectEnding). 모델은 「호감이 되면 평범, 아니면 혼자」를 뜻했다. 앞 엔딩에 조건이 있으면 그 조건으로 가르는 fork 사슬로 바꾼다
 * (조건 없는 엔딩에서 사슬이 끝난다). 2026-10-29 standin romance 「다음 주에도, 단골손님」 뒤 「커피 한 잔의 거리」가 영영 안 열렸다.
 */
/**
 * 엔딩이 정의됐는데 어떤 명령도 엔딩을 부르지 않으면(출하 검사 no-ending-trigger) 청사진 마지막 단계 이벤트에 붙인다 —
 * 그 이벤트가 전투를 하면 승리 갈래 끝에, 아니면 첫 페이지 끝에. 조건 없는 엔딩을 먼저 고른다.
 * 왜(2026-10-29 vm4 argon jrpg): 마지막 단계가 마왕 전투였고 경로 짓기는 «전투가 든 이벤트라 다시 짓지 않음»으로 건너뛰어, 엔딩이 정의만 있고 끝낼 수 없었다.
 */
function attachEndingToLastStep(project: Project): string[] {
  const endings = project.endings ?? [];
  const steps = project.gameBlueprint?.steps ?? [];
  if (!endings.length || !steps.length) return [];
  let calls = false;
  const scan = (node: unknown): void => {
    if (calls || !node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(scan); return; }
    const o = node as Obj;
    if (o.kind === "triggerEnding" || o.kind === "ending") { calls = true; return; }
    Object.values(o).forEach(scan);
  };
  for (const map of Object.values(project.maps)) scan(map.events ?? []);
  scan(project.commonEvents ?? []);
  if (calls) return [];
  const last = steps.at(-1)!;
  const place = Object.values(project.maps).find((m) => m.id === last.place || m.name === last.place);
  const maps = place ? [place, ...Object.values(project.maps).filter((m) => m !== place)] : Object.values(project.maps);
  let hit: { map: (typeof maps)[number]; event: NonNullable<(typeof maps)[number]["events"]>[number] } | undefined;
  for (const map of maps) {
    const event = (map.events ?? []).find((e) => e.id === last.event || e.name === last.event);
    if (event) { hit = { map, event }; break; }
  }
  if (!hit) return [];
  const ending = endings.find((e) => !(e.conditions ?? []).length) ?? endings[0]!;
  const call = { kind: "triggerEnding", endingId: ending.id };
  const isVictoryFork = (c: Obj) => c.kind === "fork" && (c.condition as Obj | undefined)?.kind === "battleResult" && (c.condition as Obj).result === "victory" && Array.isArray(c.then);
  for (const page of hit.event.pages ?? []) {
    const commands = page.commands as unknown as Obj[] | undefined;
    if (!Array.isArray(commands)) continue;
    const fork = commands.find(isVictoryFork);
    if (fork) { (fork.then as unknown[]).push(call); return [`엔딩 「${ending.name}」을 마지막 단계 「${hit.event.name ?? hit.event.id}」 승리 뒤에 붙임`]; }
    const battle = commands.find((c) => c.kind === "battleProcessing");
    if (battle) {
      if (battle.branchOnResult === true && Array.isArray(battle.victoryBranch)) (battle.victoryBranch as unknown[]).push(call);
      else commands.splice(commands.indexOf(battle) + 1, 0, { kind: "fork", condition: { kind: "battleResult", result: "victory" }, then: [call] });
      return [`엔딩 「${ending.name}」을 마지막 단계 「${hit.event.name ?? hit.event.id}」 승리 뒤에 붙임`];
    }
  }
  const first = hit.event.pages?.[0];
  if (!first || !Array.isArray(first.commands)) return [];
  (first.commands as unknown as Obj[]).push(call);
  return [`엔딩 「${ending.name}」을 마지막 단계 「${hit.event.name ?? hit.event.id}」 끝에 붙임`];
}

function forkStackedEndingCalls(project: Project): string[] {
  const endings = new Map((project.endings ?? []).map((e) => [e.id, e]));
  const out: string[] = [];
  const named = (c: unknown): string | undefined => {
    const o = c as Obj | undefined;
    return o && o.kind === "triggerEnding" && typeof o.endingId === "string" && endings.has(o.endingId) ? o.endingId : undefined;
  };
  const fixList = (list: unknown[], where: string): void => {
    for (let i = 0; i < list.length; i++) {
      const first = named(list[i]);
      if (!first) continue;
      let j = i + 1;
      while (j < list.length && named(list[j])) j++;
      const run = list.slice(i, j).map((c) => named(c)!);
      if (run.length < 2 || !(endings.get(first)!.conditions ?? []).length) continue;
      let chain: unknown[] = [{ kind: "triggerEnding", endingId: run[run.length - 1] }];
      for (const id of run.slice(0, -1).reverse()) {
        const conds = structuredClone(endings.get(id)!.conditions ?? []);
        chain = conds.length ? [{ kind: "fork", condition: conds.length === 1 ? conds[0] : { kind: "all", conditions: conds }, then: [{ kind: "triggerEnding", endingId: id }], else: chain }] : [{ kind: "triggerEnding", endingId: id }];
      }
      list.splice(i, run.length, ...chain);
      out.push(`${where}: 엔딩 ${run.map((id) => endings.get(id)!.name).join(" → ")} 를 조건으로 가름`);
    }
    for (const c of list) visit(c, where);
  };
  const visit = (node: unknown, where: string): void => {
    if (!node || typeof node !== "object") return;
    for (const v of Object.values(node as Obj)) {
      if (Array.isArray(v)) { if (v.some((x) => x && typeof x === "object" && "kind" in (x as Obj))) fixList(v, where); else for (const x of v) visit(x, where); }
      else if (v && typeof v === "object") visit(v, where);
    }
  };
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) for (const page of event.pages ?? []) {
    const commands = page.commands as unknown[] | undefined;
    if (Array.isArray(commands)) fixList(commands, `${map.name ?? map.id} ${event.name ?? event.id}`);
  }
  for (const common of (project.commonEvents ?? []) as unknown as Obj[]) {
    if (Array.isArray(common.commands)) fixList(common.commands as unknown[], `공통 ${String(common.name ?? common.id)}`);
  }
  return out;
}

/**
 * 전투 없는 게임의 전투 기본값(출하 검사 combat-leftovers 와 같은 판정): ESC 메뉴를 이야기용(configure_field_menu{preset:'story'} 와 같은 항목)으로 —
 * 저작한 메뉴가 있으면 스킬·장비·상태·진형·전투 기록 칸만 뺀다 — 하고, 파티의 공장 기본 무기·방어구(검·방패…)만 뺀다(고른 장비는 그대로).
 * 2026-10-29 standin magic·vm2 flash 추리: 전투 없는 게임 ESC 메뉴에 스킬·장비가, 주인공 손에 검·방패가 남았다.
 */
const COMBAT_MENU = new Set(["skills", "equipment", "status", "row", "formation", "battle-reports"]);
function clearCombatLeftovers(project: Project): string[] {
  const out: string[] = [];
  const authored = project.meta.oprnFieldMenu;
  const current = fieldMenu(project);
  const kept = current?.entries.filter((row) => !COMBAT_MENU.has(row.command)) ?? [];
  if (!current || kept.length !== current.entries.length) {
    const next = current && kept.length ? { version: 1 as const, entries: kept } : storyFieldMenu();
    project.meta.oprnFieldMenu = next;
    // 메뉴를 처음 저작하면 창 모양도 맞춘다 — 이미 고른 모양(메뉴 모양 기본값 journal·classic)은 그대로.
    if (!authored) syncMenuUiStyle(project, true, project.system.menuUiStyle && project.system.menuUiStyle !== "pixel" ? project.system.menuUiStyle : undefined);
    syncMenuFeatures(project, next);
    out.push(`ESC 메뉴 → ${next.entries.map((row) => row.label).join("·")}`);
  }
  for (const id of project.system.startActorIds ?? []) {
    const actor = project.database.actors.find((a) => a.id === id);
    const equipment = actor?.initialEquipment as Record<string, unknown> | undefined;
    if (!actor || !equipment) continue;
    const gone = Object.entries(FACTORY_HERO_ARMS).filter(([slot, item]) => equipment[slot] === item).map(([slot]) => slot);
    for (const slot of gone) delete equipment[slot];
    if (gone.length) out.push(`${actor.name} 기본 장비 ${gone.join("·")} 뺌`);
  }
  return out;
}

/**
 * 죽거나 질 수 있는데 게임 오버 화면이 기본이다 — 공포는 공포 연출(잡혔다), 그 밖은 고전(쓰러졌다). 글은 주인공 이름으로 짧게, 다시 하기·타이틀 단추는 기본.
 */
function fillGameOver(project: Project, story: string): string[] {
  const premise = premiseOf(project, story);
  const hero = project.database.actors.find((a) => a.id === project.system.startActorIds?.[0])?.name?.trim() ?? "";
  const horror = /공포|호러|귀신|유령|괴담|좀비|horror/iu.test(premise);
  const settings = horror
    ? { presentation: "horror" as const, title: "붙잡혔다", message: hero ? `${topic(hero)} 어둠 속에서 더는 도망칠 곳이 없었다.` : "어둠 속에서 더는 도망칠 곳이 없었다." }
    : { presentation: "classic" as const, title: "쓰러졌다", message: hero ? `${topic(hero)} 힘이 다해 쓰러지고 말았다. 다시 일어나 도전하자.` : "힘이 다해 쓰러지고 말았다. 다시 일어나 도전하자." };
  project.system.gameOver = normalizeGameOverSettings(settings);
  return [`게임 오버 → ${settings.presentation} 「${settings.title}」`];
}

/**
 * 패배하면 진행을 지킨 채 다시 일어나게 한다 — 게임 오버 결과를 정하지 않으면(outcome 생략 = 메뉴) 기록된 체크포인트가 없을 때
 * 메뉴에는 「타이틀로 돌아가기」만 남아 새로 시작할 수밖에 없었다(2026-10-29 vm5 flash jrpg: 「패배하면 시작 지점·0G·첫 목표로 돌아가
 * 상자 보상 등 진행이 사라짐, 복귀 지점 안내 없음」). 결과를 recover(귀환)로 — 런타임 createDefeatRecovery 가 진행·소지품을 그대로 두고
 * 파티를 회복시켜 마지막 체크포인트, 없으면 recoveryFallback, 없으면 시작 지점으로 옮긴다. 화면 글(「다시 일어나 도전하자」)은 그대로 쓴다.
 * 체크포인트 저장 이벤트가 있어도 그 앞에서 지면 메뉴는 「타이틀로」뿐이었다(vm5 terra: 동굴 세이브 지점 전에 박쥐에게 전멸). 공포 연출(잡히면 끝)·
 * 작가가 결과를 정한 게임 오버는 둔다.
 */
function keepProgressOnDefeat(project: Project): string[] {
  const settings = project.system.gameOver;
  if (!settings || settings.outcome || settings.presentation === "horror" || settings.presentation === "blackout") return [];
  project.system.gameOver = { ...settings, outcome: "recover" };
  return [`게임 오버 → 귀환(진행·소지품 유지, 회복 뒤 마지막 체크포인트·${settings.recoveryFallback ? "지정한 자리" : "시작 지점"}으로) — 「타이틀로」만 남던 메뉴 대신`];
}

/**
 * 엔딩 조건 중 아무 이벤트도 켜지 않는 스위치·변수(endingConditionsUnset)를 뺀다 — 엔딩을 부르는 이벤트가 곧 관문이다.
 * 켜는 곳이 있는 조건·친밀도·회차 조건은 그대로 둔다.
 */
function dropDeadEndingConditions(project: Project): string[] {
  const written = writtenStateIds(project);
  const targeted = new Set(endingConditionsUnset(project).map((b) => b.evidence.split(":")[0]!));
  const out: string[] = [];
  for (const ending of (project.endings ?? []).filter((e) => targeted.has(e.id))) {
    const keep = (ending.conditions ?? []).filter((c) => !((c.kind === "switch" && c.value !== false && !written.switches.has(c.switchId)) || (c.kind === "variable" && !written.variables.has(c.variableId))));
    if (keep.length === (ending.conditions ?? []).length) continue;
    out.push(`엔딩 「${ending.name}」 조건 ${(ending.conditions ?? []).length - keep.length}개 뺌(켜는 이벤트 없음)`);
    ending.conditions = keep;
  }
  return out;
}
const topic = (word: string): string => `${word}${hasFinal(word) ? "은" : "는"}`;
const subject = (word: string): string => `${word}${hasFinal(word) ? "이" : "가"}`;
const sentence = (text: string): string => { const t = text.trim().replace(/[.。!?]+$/u, ""); return t ? `${t}.` : ""; };
/** 「…다」로 끝나는 말(문장)인가 — 아니면 명사구(「평화가 찾아온 마을의 안도감」). */
const isClause = (text: string): boolean => /다[.!?]?$/u.test(text.trim());

/**
 * 장면으로 맺지 않는 엔딩(endingClosureProblems)에 청사진 ending.how·feeling 과 주인공 이름으로 짧은 맺음 글을 덧붙이고,
 * 마지막 그림이 없으면 이야기에 맞는 스틸을 준다. 모델이 쓴 줄은 그대로 두고 앞에 둔다.
 */
function fillEndingClosure(project: Project): string[] {
  const blueprint = project.gameBlueprint;
  if (!blueprint) return [];
  // 이름이 편집기 기본(「주인공」)이어도 그 이름으로 맺는다 — 기본 이름은 party-names 가 따로 짚는다.
  const heroName = project.database.actors.find((a) => a.id === project.system.startActorIds?.[0])?.name?.trim() ?? "";
  const place = blueprintPlaceName(project, blueprint);
  const out: string[] = [];
  const failing = new Map(endingClosureProblems(project).map((b) => [b.evidence.split(":")[0]!, b.message]));
  for (const ending of project.endings ?? []) {
    const problem = failing.get(ending.id);
    if (!problem) continue;
    const needLines = problem.includes("맺음 대사가"), needPerson = problem.includes("인물의 매듭");
    const beats = ((ending.epilogue ?? []) as unknown as Obj[]);
    const said = () => beats.filter((b) => (b.kind === "say" || b.kind === "text") && typeof b.text === "string" && String(b.text).trim()).map((b) => String(b.text).trim());
    const has = (line: string) => said().some((t) => t.replace(/\s+/gu, "").includes(line.replace(/[.\s]+/gu, "")));
    const add = (line: string) => { if (line && !has(line)) beats.push({ kind: "say", text: line }); };
    const enough = () => { const lines = said(); return lines.length >= 3 && lines.reduce((n, t) => n + t.length, 0) >= 80; };
    const before = said().length;
    if (needLines) add(sentence(blueprint.ending.how));
    if ((needLines || needPerson) && heroName) add(`${topic(heroName)} ${place ? `${place}에서 시작한 ` : ""}이 여정을 끝까지 걸어냈다.`);
    const feeling = blueprint.ending.feeling.trim();
    if (feeling && !enough()) add(isClause(feeling) ? sentence(feeling) : `${subject(feeling)} 오래도록 남았다.`);
    if (!enough()) add(sentence(blueprint.steps.at(-1)?.action ?? ""));
    if (!enough() && heroName) add(`${heroName}의 이야기는 여기서 한 매듭을 짓는다.`);
    (ending as unknown as Obj).epilogue = beats;
    const added = said().length - before;
    if (added) out.push(`엔딩 「${ending.name}」 맺음 글 ${added}줄`);
  }
  return out;
}

// ── 기본 지명 걷어내기 ───────────────────────────────────────────────────

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const GENERIC_PLACE = /^(마을|도시|항구|동굴|이곳|곳)$/u;

/**
 * 제목·엔딩이 기본 시작 칩셋 지명(「버들항」)을 게임 주제로 삼았다(defaultPlaceLeaks) — 그 지명을 이야기 장소의 보통 이름으로 바꾼다:
 * 「버들항 마을」 → 「마을」, 「버들항의 평화」 → 「마을의 평화」. 보통 이름은 청사진 첫 장소에서 지명을 뺀 말(없으면 「마을」).
 * 제목이 보통 이름 하나만 남으면 고친 엔딩 이름(그것도 없으면 장르)을 제목으로 쓴다. 맵 이름은 건드리지 않는다(검사 대상이 아니다).
 */
function removeDefaultPlaceWords(project: Project, task: string): string[] {
  const out: string[] = [];
  for (const leak of defaultPlaceLeaks(project, task)) {
    const word = leak.evidence.split(":")[0]!.trim();
    if (!word) continue;
    const firstPlace = project.gameBlueprint ? blueprintPlaceName(project, project.gameBlueprint) : "";
    const noun = firstPlace.replace(new RegExp(escapeRe(word), "gu"), "").replace(/^[\s의]+|\s+$/gu, "").trim() || "마을";
    const strip = (text: string): string => text
      .replace(new RegExp(`${escapeRe(word)}\\s*${escapeRe(noun)}`, "gu"), noun)
      .replace(new RegExp(escapeRe(word), "gu"), noun)
      .replace(new RegExp(`${escapeRe(noun)}\\s+${escapeRe(noun)}`, "gu"), noun);
    const touched: string[] = [];
    for (const ending of project.endings ?? []) {
      const name = strip(ending.name);
      if (name !== ending.name) { touched.push(`엔딩 「${ending.name}」→「${name}」`); ending.name = name; }
      const pres = ending.presentation as Obj | undefined;
      if (pres && typeof pres.finalTitle === "string") pres.finalTitle = strip(pres.finalTitle);
      for (const beat of ((ending.epilogue ?? []) as unknown as Obj[])) {
        if (typeof beat.text === "string") beat.text = strip(beat.text);
        if (Array.isArray(beat.lines)) beat.lines = (beat.lines as unknown[]).map((l) => typeof l === "string" ? strip(l) : l);
      }
    }
    const title = project.system.titleScreen;
    const retitle = (current: string): string => {
      const next = strip(current);
      if (next === current) return current;
      if (!GENERIC_PLACE.test(next.trim())) return next;
      return (project.endings ?? []).map((e) => e.name).find((n) => n && !n.includes(word)) ?? project.gameBlueprint?.genre ?? next;
    };
    if (title?.title?.includes(word)) { const next = retitle(title.title); touched.push(`타이틀 「${title.title}」→「${next}」`); title.title = next; }
    if (String(project.meta.title ?? "").includes(word)) project.meta = { ...project.meta, title: retitle(project.meta.title) };
    if (touched.length) out.push(`기본 지명 「${word}」 걷어냄: ${touched.slice(0, 4).join(" · ")}`);
  }
  return out;
}

// ── 제자리 옮기기 ─────────────────────────────────────────────────────────

/** 같은 맵 1칸 이내로 옮기는 명령을 지운다(selfLoopTransfers). 옮기기만 하던 투명 이벤트는 통째로 지운다. */
function dropSelfLoopTransfers(project: Project): string[] {
  const notes: string[] = [];
  for (const loop of selfLoopTransfers(project)) {
    const map = project.maps[loop.mapId];
    const event = map?.events.find((e) => e.id === loop.eventId);
    if (!map || !event) continue;
    const strip = (list: unknown): unknown[] => (Array.isArray(list) ? list : []).flatMap((raw) => {
      const c = raw as Record<string, unknown>;
      if (c?.kind === "transfer" && c.mapId === loop.mapId && c.x === loop.to.x && c.y === loop.to.y) return [];
      const copy: Record<string, unknown> = { ...c };
      for (const [key, value] of Object.entries(copy)) if (Array.isArray(value) && value.some((v) => v && typeof v === "object" && "kind" in (v as object))) copy[key] = strip(value);
      if (Array.isArray(copy.options)) copy.options = (copy.options as Record<string, unknown>[]).map((o) => ({ ...o, branch: strip(o.branch) }));
      return [copy];
    });
    const pages = (event.pages ?? []).map((page) => ({ ...page, commands: strip(page.commands) as typeof page.commands }));
    const empty = pages.every((page) => !(page.commands ?? []).length) && pages.every((page) => (page.graphic as { transparent?: boolean } | undefined)?.transparent === true);
    map.events = empty ? map.events.filter((e) => e.id !== event.id) : map.events.map((e) => e.id === event.id ? { ...e, pages } : e);
    notes.push(`제자리 옮기기 ${empty ? "이벤트" : "명령"} 지움: ${map.name ?? map.id} ${event.id}(${loop.x},${loop.y})`);
  }
  return notes;
}

/** 아무 일도 안 하는 페이지의 반짝임을 뗀다(emptySparkles). 반짝임은 «여기 할 일이 있다» 는 약속이다. */
function dropEmptySparkles(project: Project): string[] {
  const notes: string[] = [];
  for (const hit of emptySparkles(project)) {
    const map = project.maps[hit.mapId];
    const event = map?.events.find((e) => e.id === hit.eventId);
    const page = event?.pages?.[hit.page] as unknown as Record<string, unknown> | undefined;
    if (!page) continue;
    delete page.nearSparkle;
    notes.push(`빈 반짝임 뗌: ${map!.name ?? map!.id} ${hit.eventId}(${hit.x},${hit.y})`);
  }
  return notes;
}

/** 다른 맵에 남은 단계 이벤트 사본(싸움·엔딩)을 지운다 — 청사진 장소의 정본만 남긴다(strayStepCopies). */
function dropStrayStepCopies(project: Project): string[] {
  const notes: string[] = [];
  for (const hit of strayStepCopies(project)) {
    const map = project.maps[hit.mapId];
    if (!map) continue;
    const ev = map.events.find((e) => e.id === hit.eventId);
    map.events = map.events.filter((e) => e.id !== hit.eventId);
    notes.push(`단계 사본 지움: ${map.name ?? map.id} 「${ev?.name ?? hit.eventId}」(${hit.x},${hit.y}) — 정본은 ${project.maps[hit.canonicalMapId]?.name ?? hit.canonicalMapId}`);
  }
  return notes;
}

const withJosa = (word: string, batchim: string, plain: string): string => {
  const code = (word.trim().at(-1) ?? "").charCodeAt(0) - 0xac00;
  return `${word}${code >= 0 && code <= 11171 ? (code % 28 ? batchim : plain) : `${batchim}(${plain})`}`;
};
/** 조건부 출구에 «막힐 때 이유 한 줄» 페이지를 맨 앞에 넣는다(silentLockedExits). 이유는 첫 조건에서 — 아이템이면 그 이름, 스위치면 켜는 이벤트 이름. */
function explainLockedExits(project: Project): string[] {
  const notes: string[] = [];
  const sets = (value: unknown, switchId: string): boolean => {
    if (Array.isArray(value)) return value.some((v) => sets(v, switchId));
    if (!value || typeof value !== "object") return false;
    const r = value as Record<string, unknown>;
    if (r.kind === "setSwitch" && r.switchId === switchId && r.value !== false) return true;
    return Object.values(r).some((v) => sets(v, switchId));
  };
  const setterName = (switchId: string): string | undefined => {
    for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
      if (ev.name && !/^ev_objective/u.test(ev.id) && sets(ev.pages ?? [], switchId)) return ev.name;
    }
    return undefined;
  };
  for (const hit of silentLockedExits(project)) {
    const map = project.maps[hit.mapId];
    const ev = map?.events.find((e) => e.id === hit.eventId);
    if (!map || !ev) continue;
    const pages = ev.pages as unknown as Record<string, unknown>[];
    const lockedPage = pages.find((p) => JSON.stringify(p.commands ?? []).includes('"kind":"transfer"'))!;
    const cond = ((lockedPage.conditions as Record<string, unknown>[] | undefined) ?? [])[0] ?? {};
    let line = "아직 이쪽으로는 갈 수 없다.";
    if (cond.kind === "item" && typeof cond.itemId === "string") {
      const item = project.database.items.find((i) => i.id === cond.itemId);
      if (item?.name) line = `${withJosa(item.name, "이", "가")} 있어야 지나갈 수 있을 것 같다.`;
    } else if (cond.kind === "switch" && typeof cond.switchId === "string") {
      const name = setterName(cond.switchId);
      if (name) line = `먼저 「${name}」${withJosa(name, "을", "를").slice(name.length)} 마쳐야 지나갈 수 있을 것 같다.`;
    }
    const page = { ...structuredClone(lockedPage), conditions: [], commands: [{ kind: "text", body: line }] };
    (ev as { pages: unknown[] }).pages = [page, ...pages];
    notes.push(`조건부 출구에 막힘 안내: ${map.name ?? map.id} (${ev.x},${ev.y}) 「${line}」`);
  }
  return notes;
}
