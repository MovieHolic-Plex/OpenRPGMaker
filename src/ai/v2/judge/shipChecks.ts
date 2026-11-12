// 조수 v2 출하 검사 — 다 지은 게임에 편집기 기본값이 남았는가, 엔딩이 장면으로 맺는가(2026-10-25 사용자 규칙).
//
// 왜: 조수가 지은 게임에 편집기 기본 타이틀(「새 프로젝트」·들판 그림)·기본 오프닝(「강을 낀 왕국에는…」)·기본 체력 HUD·
// 기본 이름(주인공)·기본 얼굴·기본 음악이 그대로 남았고(공포 저택 1턴·시타마치), 엔딩은 대사 한 줄이었다.
// 기준은 빈 프로젝트(createBlankProject) 자체다 — 그 값과 같으면 «아무도 고르지 않은» 기본값이다.
// 순수 함수(프로젝트만 읽는다). 끝맺음 관문(v2GateProblems)이 출하 차단으로, 조언자가 막는 항목(shipBlockers)으로 같이 부른다.
import { bossTalkWithoutBattle } from "../story/bossTalkBattles";
import { reloadProblem } from "./reloadCheck";
import { createBlankProject } from "@/project/defaults";
import { projectDefaultLeaks } from "@/project/defaultLeaks";
import type { Project } from "@/project/types";
import { unreachableCriticalEvents } from "./puzzleChecks";
import { gameHasCombat } from "@/project/combatPresence";
import { hiddenStairExits } from "@/project/stairs/fit";
import { unlitDarkFinding } from "@/qa/gameCheck/visualVoid";
import { romanceCompletionGaps } from "@/qa/gameCheck/romance";
import { invisibleStoryEvents, objectiveGaps, offArtEntrances, doorCellBlocked, repeatedDayDialogue, lingeringHeavyTints } from "./discoverability";
import { fieldMenu } from "@/project/fieldMenu";
import { FACTORY_HERO_ARMS } from "../genreDefaults";
import { BLUEPRINT_PATH_IDS, strayStepCopies, walkBlueprint } from "../story/blueprint";
import { countMaps, MIN_COUNTED_MAPS, MIN_MAP_CELLS, planLinks } from "./mapCount";
import { MAX_SAME_KIND, worldOf } from "../place/world";
import { MIN_ACT_DEPTH, progressionDepth } from "./actDepth";
import { countQuests, MIN_COUNTED_QUESTS } from "./questCount";
import { assemblyTimeMismatches } from "@/project/blueprintAssembly";
import { battleSites, healingSources } from "./combatChecks";
import { buildsWholeGame, oneProjectGame } from "../request/readers";
import { Obj, ShipBlocker, allCommands, textOf } from "./shipCheckReads";
import { openingWithoutPlace, offPremiseArt, defaultPlaceLeaks, titleMismatch, openingMissing, bundledPictureLeft } from "./shipArtChecks";
import { chaserWithoutHiding, requestedFeatureGaps } from "./requestedFeatures";

/**
 * 조건이 맞아야만 옮기는 출구인데, 조건이 안 맞을 때 켜지는 페이지(조건 없는 페이지)에 대사가 없다 — 걸어 들어가도 아무 말 없이 막힌다.
 * 2026-10-29 감독 지시(vm3 flash 추리 BLOCKER 「출구에서 막혔는데 안내 문구가 전혀 없다」): 조건부 출구는 막힐 때 이유 한 줄이 필수다.
 */
export function silentLockedExits(project: Project): { mapId: string; eventId: string; x: number; y: number }[] {
  const out: { mapId: string; eventId: string; x: number; y: number }[] = [];
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    const pages = (ev.pages ?? []) as unknown as Obj[];
    const moving = pages.filter((p) => JSON.stringify(p.commands ?? []).includes('"kind":"transfer"'));
    if (!moving.length || moving.some((p) => !(p.conditions as unknown[] | undefined)?.length)) continue;
    const told = pages.some((p) => !(p.conditions as unknown[] | undefined)?.length && JSON.stringify(p.commands ?? []).includes('"kind":"text"'));
    if (!told) out.push({ mapId: map.id, eventId: ev.id, x: ev.x, y: ev.y });
  }
  return out;
}

/** 반짝임만 있고 아무 일도 안 하는 페이지 — 조사해도 대사·아이템이 없어 판정자가 「반짝이는 곳을 눌러도 무반응」 이라 막혔다(2026-10-29 vm3 terra jrpg 판정). 숨을 곳(interaction)은 뺀다. */
export function emptySparkles(project: Project): { mapId: string; eventId: string; x: number; y: number; page: number }[] {
  const out: { mapId: string; eventId: string; x: number; y: number; page: number }[] = [];
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) (event.pages ?? []).forEach((page, i) => {
    const raw = page as unknown as Obj;
    if (!raw.nearSparkle || raw.interaction || (Array.isArray(raw.commands) && raw.commands.length)) return;
    out.push({ mapId: map.id, eventId: event.id, x: event.x, y: event.y, page: i });
  });
  return out;
}

/**
 * 제자리 옮기기 — 같은 맵의 그 이벤트 칸으로 옮기는 이동 명령(한 칸 옆은 막힌 문을 건너가는 통로라 뺀다). 화면이 깜빡이고 제자리로 돌아올 뿐이라 플레이어는 문이 고장 났다고 읽는다
 * (2026-10-29 판정 요청). 함정(「꺼지는 바닥」→ 방 입구, 16칸)처럼 멀리 되돌리는 같은 맵 이동은 의도라 짚지 않는다.
 */
export function selfLoopTransfers(project: Project): { mapId: string; eventId: string; x: number; y: number; to: { x: number; y: number } }[] {
  const out: { mapId: string; eventId: string; x: number; y: number; to: { x: number; y: number } }[] = [];
  const walk = (value: unknown, hit: (c: Obj) => void): void => {
    if (Array.isArray(value)) { value.forEach((v) => walk(v, hit)); return; }
    if (!value || typeof value !== "object") return;
    const c = value as Obj;
    if (c.kind === "transfer") hit(c);
    for (const child of Object.values(c)) if (child && typeof child === "object") walk(child, hit);
  };
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) {
    walk(event.pages ?? [], (c) => {
      if (c.mapId !== map.id || typeof c.x !== "number" || typeof c.y !== "number") return;
      // 그 이벤트 칸 자체로 옮기는 것만 — 한 칸 옆은 막힌 문·덤불을 건너가는 정상 통로다(standin monster 체육관 「덩굴 문」 위/아래 고르기).
      if (c.x === event.x && c.y === event.y) out.push({ mapId: map.id, eventId: event.id, x: event.x, y: event.y, to: { x: c.x, y: c.y } });
    });
  }
  return out;
}

let factoryCache: Project | undefined;
function factory(): Project {
  factoryCache ??= createBlankProject() as Project;
  return factoryCache;
}

/** 편집기 기본값 목록(LEDGER 의 목록과 같은 순서). 검사·문서가 같은 이름을 쓴다. */
export const EDITOR_DEFAULT_INVENTORY = [
  "title-name", "title-image", "opening", "opening-music", "hud", "window-look", "map-bgm", "battle-bgm", "battle-background",
  "game-over", "ending-screen", "party-names", "party-faces", "hero-look", "placeholder-text", "combat-leftovers", "ending-bg", "start-gear", "opening-missing",
] as const;

/** 뼈대·자리표시 글(엔딩·이벤트 이름이나 대사에 남으면 안 된다). */
export const PLACEHOLDER_NAMES = new Set(["첫 구간 끝", "구간 끝", "기억의 길", "기억의 조각", "산책로 끝", "첫 만남의 끝", "떨어진 수첩"]);
const PLACEHOLDER_TEXT = /\bTODO\b|\bTBD\b|lorem ipsum|placeholder|자리\s*표시|여기에\s*(대사|내용|설명)|\(대사\)|\[대사\]|대사를 입력|내용을 입력|임시 대사|테스트 대사/iu;

/** 편집기 기본값이 남은 곳. 빈 배열이면 통과. */
export function editorDefaultsLeft(project: Project): ShipBlocker[] {
  const f = factory();
  const out: ShipBlocker[] = [];
  const add = (id: (typeof EDITOR_DEFAULT_INVENTORY)[number], message: string, evidence: string) => out.push({ id, message, evidence });
  const s = project.system as unknown as Obj, fs = f.system as unknown as Obj;
  const title = (s.titleScreen ?? {}) as Obj, ftitle = (fs.titleScreen ?? {}) as Obj;

  // 1) 타이틀 이름·그림
  const shownTitle = String(title.title ?? project.meta.title ?? "");
  if (shownTitle === String(ftitle.title) || project.meta.title === f.meta.title) add("title-name", `게임 제목이 편집기 기본 「${f.meta.title}」이다 — set_title_screen{title} 로 이 게임의 제목을 쓴다.`, `meta.title=${project.meta.title} titleScreen.title=${shownTitle}`);
  const titleBg = (title.backgroundResourceId ?? s.titleResourceId) as string | undefined;
  if (titleBg && (titleBg === ftitle.backgroundResourceId || titleBg === fs.titleResourceId)) add("title-image", `타이틀 그림이 편집기 기본(${titleBg})이다 — list_resources{kind:'backdrop',query:<배경 낱말>} 로 이 이야기에 맞는 그림을 골라 set_title_screen{backgroundResourceId} 로 바꾼다.`, `titleScreen.backgroundResourceId=${titleBg}`);

  // 2) 오프닝: 기본 장면(같은 그림·같은 내레이션)이 남았다
  const opening = (s.opening ?? {}) as Obj, fopening = (fs.opening ?? {}) as Obj;
  const fscenes = ((fopening.scenes as Obj[] | undefined) ?? []).map((sc) => `${String(sc.resourceId)}|${String(sc.narration ?? "")}`);
  const leftScenes = ((opening.scenes as Obj[] | undefined) ?? []).filter((sc) => fscenes.includes(`${String(sc.resourceId)}|${String(sc.narration ?? "")}`));
  if (opening.enabled !== false && leftScenes.length) add("opening", `오프닝에 편집기 기본 장면 ${leftScenes.length}개(「${String(leftScenes[0]!.narration ?? "").slice(0, 20)}…」)가 남았다 — 이 게임의 오프닝으로 바꾼다: 맵 위 무대는 author_opening_stage{mapId, x, y, beats}, 그림 장면은 plan_opening·set_opening. 오프닝을 끄는 것은 고치기가 아니다(끄면 «오프닝 없음» 차단이 선다).`, leftScenes.map((sc) => String(sc.resourceId)).join(","));
  if (opening.enabled !== false && opening.musicResourceId && opening.musicResourceId === fopening.musicResourceId && (leftScenes.length || !(opening.scenes as unknown[] | undefined)?.length)) add("opening-music", `오프닝 음악이 편집기 기본(${String(opening.musicResourceId)})이다 — 이 게임 분위기의 곡으로 바꾼다.`, `opening.musicResourceId=${String(opening.musicResourceId)}`);

  // 3) HUD: 아무도 정하지 않았다(편집기 기본 체력 HUD)
  if (s.fieldHud === undefined) add("hud", "필드 HUD 가 편집기 기본(체력 하트·숫자)이다 — set_field_hud{theme:<장르>} 로 장르에 맞는 HUD 를 고르거나 {off:true} 로 끈다.", "system.fieldHud=undefined");

  // 4) 대화창·메뉴 모양: 창 스킨·대사창 룩·메뉴 스타일 어느 것도 고르지 않았다
  const meta = project.meta as unknown as Obj;
  const hud = (s.fieldHud ?? {}) as Obj;
  if (s.systemResourceId === fs.systemResourceId && !meta.oprnVnLook && !s.menuUiStyle && !hud.menuStyle) add("window-look", `대화창·메뉴가 편집기 기본 모양(${String(s.systemResourceId)})이다 — set_vn_look{preset}(대사창 룩)이나 set_project_settings{resources:{systemResourceId}} 로 이 게임에 맞는 창을 고른다.`, `system.systemResourceId=${String(s.systemResourceId)}`);

  // 5) 음악: 자기 음악이 없는 맵이 편집기 기본 필드 곡을 튼다
  const silentMaps = Object.values(project.maps).filter((m) => (m.events ?? []).length > 0 && !(m as unknown as Obj).bgm && !(m as unknown as Obj).worldmapSource);
  if (s.defaultBgmResourceId === fs.defaultBgmResourceId && silentMaps.length) add("map-bgm", `맵 ${silentMaps.length}장(${silentMaps.slice(0, 3).map((m) => m.name).join("·")})이 편집기 기본 필드 곡(${String(s.defaultBgmResourceId)})을 튼다 — set_map_properties{mapId, bgm} 로 장소마다 곡을 고른다.`, silentMaps.map((m) => m.id).slice(0, 5).join(","));

  // 6) 전투: 기본 전투 곡·기본 전투 배경
  const cmds = allCommands(project);
  const battleTroops = new Set(cmds.filter((r) => r.cmd.kind === "battleProcessing").map((r) => String(r.cmd.troopId ?? "")));
  const battleMaps = new Set(cmds.filter((r) => r.cmd.kind === "battleProcessing").map((r) => r.mapId));
  for (const m of Object.values(project.maps)) if ((m.encounterRate ?? 0) > 0 && ((m.troopIds?.length ?? 0) > 0 || (m.encounterTable?.length ?? 0) > 0)) battleMaps.add(m.id);
  const hasBattles = battleMaps.size > 0;
  if (hasBattles && s.battleBgmResourceId === fs.battleBgmResourceId) add("battle-bgm", `전투 곡이 편집기 기본(${String(s.battleBgmResourceId)})이다 — set_project_settings{resources:{battleBgmResourceId}} 로 이 게임의 전투 곡을 고른다.`, `system.battleBgmResourceId=${String(s.battleBgmResourceId)}`);
  if (hasBattles) {
    const troops = (project.database.troops ?? []) as unknown as Obj[];
    const bareMaps = [...battleMaps].filter((id) => id !== "common" && !(project.maps[id] as unknown as Obj | undefined)?.battleBackground)
      .filter(() => ![...battleTroops].some((t) => troops.find((tr) => tr.id === t)?.battleBackgroundResourceId));
    if (bareMaps.length) add("battle-background", `전투가 나는 맵 ${bareMaps.length}장에 전투 배경이 없어 편집기 기본 배경이 나온다 — set_map_properties{battleBackground} 나 적 무리의 battleBackgroundResourceId 로 그 장소의 배경을 고른다.`, bareMaps.slice(0, 5).join(","));
  }

  // 7) 게임 오버: 죽을 수 있는 게임인데 게임 오버 화면을 정하지 않았다
  const canDie = hasBattles || cmds.some((r) => r.cmd.kind === "killPlayer" || r.cmd.kind === "gameOver");
  if (canDie && !s.gameOver && !(s.gameOvers as unknown[] | undefined)?.length) add("game-over", "죽거나 질 수 있는 게임인데 게임 오버 화면이 편집기 기본이다 — set_game_over{presentation, title, body, background} 로 이 게임의 패배 화면과 돌아갈 자리를 정한다.", "system.gameOver=undefined");

  // 8) 엔딩 화면: 연출(presentation) 없이 기본 카드
  const bareEndings = (project.endings ?? []).filter((e) => !e.presentation || !Object.keys(e.presentation).length);
  // 자리표시 크레딧: 모델이 「기획·제작 / 당신」 같은 빈칸 이름을 지어 넣었다(2026-10-25 horror-mansion-v2 Sonnet VQA).
  const PLACEHOLDER_CREDIT = /(?:^|\n)\s*(?:당신|너|플레이어|제작자 ?이름|이름|you|your name|author|tbd|xxx|\?\?\?)\s*(?:\n|$)/iu;
  const placeholderCredits = (project.endings ?? []).filter((e) => PLACEHOLDER_CREDIT.test(String((e.presentation as { credits?: unknown } | undefined)?.credits ?? "")));
  if (placeholderCredits.length) add("placeholder-text", `엔딩 ${placeholderCredits.length}개(${placeholderCredits.slice(0, 3).map((e) => e.name).join("·")})의 크레딧에 「당신」 같은 자리표시 이름이 있다 — 만든 사람 이름을 모르면 이름 줄을 빼고 게임 제목·감사 문구만 둔다(define_ending presentation.credits).`, placeholderCredits.map((e) => e.id).join(","));
  if (bareEndings.length) add("ending-screen", `엔딩 ${bareEndings.length}개(${bareEndings.slice(0, 3).map((e) => e.name).join("·")})가 편집기 기본 엔딩 카드다 — define_ending 의 presentation{backgroundResourceId, finalTitle, credits, musicResourceId} 를 채운다.`, bareEndings.map((e) => e.id).join(","));

  // 9) 파티: 기본 이름·기본 얼굴·기본 모습
  const fActors = new Map(f.database.actors.map((a) => [a.id, a]));
  const party = (project.system.startActorIds ?? []).map((id) => project.database.actors.find((a) => a.id === id)).filter((a): a is NonNullable<typeof a> => !!a);
  const namesLeft = party.filter((a) => fActors.get(a.id)?.name === a.name);
  if (namesLeft.length) add("party-names", `파티의 이름이 편집기 기본(${namesLeft.map((a) => a.name).join("·")})이다 — upsert_actor{id,name} 로 이 이야기의 이름을 준다.`, namesLeft.map((a) => a.id).join(","));
  const facesLeft = party.filter((a) => a.faceResourceId && fActors.get(a.id)?.faceResourceId === a.faceResourceId);
  if (facesLeft.length) add("party-faces", `파티의 얼굴이 편집기 기본 초상(${facesLeft.map((a) => a.name).join("·")})이다 — 이 인물에 맞는 얼굴을 고르거나(list_npc_graphics) 얼굴을 비운다.`, facesLeft.map((a) => `${a.id}:${a.faceResourceId}`).join(","));
  const looksLeft = party.filter((a) => { const fa = fActors.get(a.id); return !!fa && fa.characterResourceId === a.characterResourceId && (fa.characterIndex ?? 0) === (a.characterIndex ?? 0); });
  if (looksLeft.length) add("hero-look", `파티의 모습이 편집기 기본 칩(${looksLeft.map((a) => a.name).join("·")}, 판타지 검사)이다 — list_npc_graphics{query:<외형>} 로 이 게임의 주인공 모습을 골라 upsert_actor 로 바꾼다.`, looksLeft.map((a) => `${a.id}:${a.characterResourceId}`).join(","));

  // 9b) 전투 없는 게임의 전투 기본값(J88): ESC 메뉴의 스킬·장비·상태·진형 항목, 주인공의 공장 기본 무기·방어구.
  //     (메뉴 첫 화면의 직업·Lv·HP·MP·EX·돈 칸은 플레이어가 전투·돈 유무로 스스로 숨긴다 — project/combatPresence.ts.)
  if (!gameHasCombat(project)) {
    const menu = fieldMenu(project);
    const combatRows = (menu?.entries ?? []).filter((row) => ["skills", "equipment", "status", "row", "formation", "battle-reports"].includes(row.command)).map((row) => row.label);
    if (!menu) combatRows.push("편집기 기본 메뉴(스킬·장비·상태)");
    const gear = party.flatMap((a) => Object.entries(a.initialEquipment ?? {}).filter(([slot, id]) => id && FACTORY_HERO_ARMS[slot] === id).map(([slot, id]) => `${a.name} ${slot}:${String(id)}`));
    if (combatRows.length || gear.length) add("combat-leftovers", `전투가 없는 게임인데 전투 기본값이 남았다 — ${[...(combatRows.length ? [`ESC 메뉴 ${combatRows.join("·")}`] : []), ...(gear.length ? [`시작 장비 ${gear.join(", ")}`] : [])].join(" / ")}. configure_field_menu{preset:'story'} 로 메뉴를 이야기용으로, upsert_actor{id, initialEquipment:{}} 로 기본 무기·방어구를 뺀다(전투 없는 게임에 검·방패를 «되돌리지» 않는다).`, [...combatRows, ...gear].join(" | ").slice(0, 200));
  }

  // 9c) 엔딩이 기본 그림을 깐다·지은 장비가 주인공에게 닿지 않았다 — qa(runGameCheck)와 같은 비교(project/defaultLeaks).
  for (const leak of projectDefaultLeaks(project, { includeBlank: true })) if (leak.id === "start-gear" || (leak.id === "ending-bg" && !bareEndings.length)) add(leak.id, leak.message, leak.field);

  // 10) 자리표시 글
  const placeholders: string[] = [];
  for (const e of project.endings ?? []) if (PLACEHOLDER_NAMES.has(e.name.trim())) placeholders.push(`엔딩 「${e.name}」`);
  for (const m of Object.values(project.maps)) for (const ev of m.events ?? []) if (PLACEHOLDER_NAMES.has(String(ev.name ?? "").trim())) placeholders.push(`이벤트 「${ev.name}」(${m.name})`);
  for (const r of cmds) { const t = textOf(r.cmd); if (t && PLACEHOLDER_TEXT.test(t)) placeholders.push(`「${t.slice(0, 24)}」(${r.eventName})`); }
  if (placeholders.length) add("placeholder-text", `뼈대·자리표시 글이 남았다: ${[...new Set(placeholders)].slice(0, 4).join(" · ")} — 이 이야기의 장면·이름으로 바꾸거나 지운다.`, [...new Set(placeholders)].slice(0, 6).join(" | "));
  return out;
}

/** 엔딩이 «장면으로 맺는가»: 맺음 대사 여러 줄 + 인물의 매듭 + 마지막 그림. 대사 한 줄 엔딩은 엔딩이 아니다. */
export function endingClosureProblems(project: Project): ShipBlocker[] {
  const out: ShipBlocker[] = [];
  const names = new Set<string>();
  for (const a of project.database.actors) if (a.name && a.name.length >= 2) names.add(a.name);
  for (const m of Object.values(project.maps)) for (const ev of m.events ?? []) { const n = String(ev.name ?? "").replace(/\s*\(.*\)$/u, "").trim(); if (n.length >= 2 && !/^ev_|이벤트|문|입구|출구|상자|표지판|팻말/u.test(n)) names.add(n); }
  for (const e of project.endings ?? []) {
    const beats = (e.epilogue ?? []) as Obj[];
    const lines = beats.filter((b) => (b.kind === "say" || b.kind === "text") && typeof b.text === "string" && String(b.text).trim());
    const chars = lines.reduce((n, b) => n + String(b.text).trim().length, 0);
    const pres = (e.presentation ?? {}) as Obj;
    const image = !!pres.backgroundResourceId || beats.some((b) => ["picture", "showPicture", "background"].includes(String(b.kind)));
    const speakers = lines.some((b) => typeof b.speaker === "string" && String(b.speaker).trim());
    const mentions = lines.some((b) => [...names].some((n) => String(b.text).includes(n)));
    const missing: string[] = [];
    if (lines.length < 3 || chars < 80) missing.push(`맺음 대사가 ${lines.length}줄(${chars}자)뿐 — 무슨 일이 어떻게 끝났는지 3줄 이상`);
    if (!speakers && !mentions) missing.push("인물의 매듭이 없다 — 주인공·동료·상대가 어떻게 되었는지 이름으로");
    if (!image) missing.push("마지막 그림이 없다 — presentation.backgroundResourceId 나 picture 비트로 마지막 장면");
    if (missing.length) out.push({ id: "ending-closure", message: `엔딩 「${e.name}」이 장면으로 맺지 않는다: ${missing.join(" / ")}. define_ending 의 epilogue(say·picture·music 비트)와 presentation 을 채운다.`, evidence: `${e.id}: lines=${lines.length} chars=${chars} image=${image}` });
  }
  return out;
}

/** 이벤트·공통 이벤트 명령이 쓰는(조건이 아닌 자리에 나오는) 스위치·변수 id. 조건(conditions·condition) 안은 읽기라 뺀다. */
export function writtenStateIds(project: Project): { switches: Set<string>; variables: Set<string> } {
  const switches = new Set<string>(Object.entries(project.session?.switches ?? {}).filter(([, v]) => v).map(([k]) => k));
  const variables = new Set<string>(Object.keys(project.session?.variables ?? {}));
  const visit = (node: unknown, depth = 0): void => {
    if (depth > 40 || !node || typeof node !== "object") return;
    if (Array.isArray(node)) { for (const item of node) visit(item, depth + 1); return; }
    const o = node as Obj;
    if (typeof o.switchId === "string" && o.value !== false) switches.add(o.switchId);
    if (typeof o.variableId === "string") variables.add(o.variableId);
    for (const [key, value] of Object.entries(o)) if (key !== "conditions" && key !== "condition" && value && typeof value === "object") visit(value, depth + 1);
  };
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const page of ((ev as unknown as Obj).pages as Obj[] | undefined) ?? []) visit(page.commands);
  for (const ce of (project.commonEvents ?? []) as unknown as Obj[]) visit(ce.commands);
  return { switches, variables };
}

/**
 * 엔딩 id 로 부르는 엔딩의 조건이 아무도 켜지 않는 스위치·변수를 기다린다(2026-10-29 vm1 flash 방탈출: 「탈출 문」이 triggerEnding 을 부르는데 엔딩 조건
 * switch_escape_success 를 켜는 곳이 없어 엔딩이 나지 않았다 — 자동 플레이 «페이지 2 대신 다른 페이지»). 친밀도·회차 조건은 보지 않는다.
 */
export function endingConditionsUnset(project: Project): ShipBlocker[] {
  const written = writtenStateIds(project);
  // 엔딩 id 를 집어 부르는 명령이 있는 엔딩만 — id 없이 부르면 조건으로 엔딩을 고르므로 조건이 곧 갈래다.
  const targeted = new Set(allCommands(project).filter((r) => r.cmd.kind === "triggerEnding" && typeof r.cmd.endingId === "string").map((r) => String(r.cmd.endingId)));
  const out: ShipBlocker[] = [];
  for (const e of (project.endings ?? []).filter((ending) => targeted.has(ending.id))) {
    const dead = (e.conditions ?? []).filter((c) => (c.kind === "switch" && c.value !== false && !written.switches.has(c.switchId)) || (c.kind === "variable" && !written.variables.has(c.variableId)));
    if (!dead.length) continue;
    const ids = dead.map((c) => c.kind === "switch" ? c.switchId : (c as { variableId: string }).variableId);
    out.push({ id: "ending-condition-unset", message: `엔딩 「${e.name}」의 조건 ${ids.join("·")} 을 켜는 이벤트가 없어 엔딩을 부르는 명령이 돌아도 엔딩이 나지 않는다 — define_ending 의 conditions 에서 빼거나(엔딩을 부르는 이벤트가 곧 관문이다) 그 이벤트에서 그 스위치를 켠다.`, evidence: `${e.id}: ${ids.join(",")}` });
  }
  return out;
}

/** 제목이 퍼즐 답을 말한다(2026-10-25 공포 저택 J60: 「10시 24분의 저택」 = 금고 암호 1024). */
export function titleSpoilers(project: Project): ShipBlocker[] {
  const title = String(((project.system as unknown as Obj).titleScreen as Obj | undefined)?.title ?? project.meta.title ?? "");
  const digits = title.replace(/\D+/gu, "");
  if (digits.length < 3) return [];
  const codes = new Set<string>();
  const visitCond = (c: unknown): void => {
    if (!c || typeof c !== "object") return;
    const o = c as Obj;
    if (o.kind === "variable" && (o.op === "==" || o.op === undefined) && typeof o.value === "number" && o.value >= 100) codes.add(String(o.value));
    for (const k of ["conditions", "all", "any", "condition"]) { const v = o[k]; if (Array.isArray(v)) v.forEach(visitCond); else if (v) visitCond(v); }
  };
  for (const r of allCommands(project)) if (r.cmd.kind === "fork") visitCond(r.cmd.condition);
  for (const m of Object.values(project.maps)) for (const ev of m.events ?? []) for (const pg of ((ev as unknown as Obj).pages as Obj[] | undefined) ?? []) ((pg.conditions as unknown[] | undefined) ?? []).forEach(visitCond);
  const hit = [...codes].find((code) => digits.includes(code));
  return hit ? [{ id: "title-spoiler", message: `게임 제목 「${title}」이 퍼즐 답(${hit})을 말한다 — 제목에서 숫자를 빼거나 다른 제목으로 바꾼다(set_title_screen{title}).`, evidence: `title=${title} code=${hit}` }] : [];
}
/** 조언자·끝맺음 관문이 같이 쓰는 출하 차단 목록(게임을 만드는 요청일 때만). 제목 스포일러는 어느 요청이든. */
/**
 * 세는 맵이 최소 수(MIN_COUNTED_MAPS)보다 적다 — 오너 2026-11-10 「맵을 가장 우선」. 척도(scripts/fs-scale)가 세는 규칙 그대로(닿고·100칸·타일 6종·이벤트·다른 배치).
 * 실측(2026-11-10, 비몬스터 5판): 세는 맵 1·1·1·2·2장. 못 센 맵마다 이유를 적는다 — 이유가 없으면 조수가 세지 않는 맵만 계속 짓는다.
 * 한 장소 게임(방탈출·「방 하나」)은 최소 1장. 3번 되풀이되면 할 일 고리가 막힘으로 닫고 최종 보고에 남긴다(42분 상한).
 */
export function mapsMinBlocker(project: Project, task: string): ShipBlocker[] {
  const need = oneProjectGame(project, task) ? 1 : MIN_COUNTED_MAPS;
  const { counted, uncounted } = countMaps(project);
  if (counted.length >= need) return [];
  const why = uncounted.slice(0, 5).map((m) => `「${m.name}」(${m.id}) ${m.detail}`).join(" · ");
  const missing = need - counted.length;
  // 만든 맵이 시작 맵에서 문으로 안 닿으면(2026-11-10 forest-0039 6장·ninja-0038 4장이 세는 맵 1/4) 문구 대신 이을 호출을 준다 —
  // 무리(서로 이어진 안 닿는 맵끼리) 하나씩, 호출은 문구 맨 끝(열쇠는 앞 160자). 청사진 경로를 다시 지으면 단 문이 사라질 수 있다(forest).
  const plan = planLinks(project, counted);
  const group = plan.groups.find((g) => g.cell);
  const linkCall = plan.from && group?.cell
    ? ` 안 닿는 맵 무리 ${plan.groups.length}개 — 문을 단 뒤에는 build_blueprint_path 를 다시 부르지 않는다(다시 지으면 문이 사라질 수 있다). Next call: create_transfer_pair(${JSON.stringify({ a: { mapId: plan.from.mapId, ...plan.from.cell }, b: { mapId: group.mapId, ...group.cell } })})`
    : "";
  // 세계 청사진 게임(world.ts)이면 그 세계의 아직 안 쓴 종류로 장소를 더하게 한다 — make_place·숲길로 다른 칩셋 맵을 채우지 않게.
  const world = worldOf(project);
  if (world) {
    const usedKinds = (project.gameBlueprint?.places ?? []).map((pl) => pl.kind);
    const spare = world.kinds.filter((k) => usedKinds.filter((u) => u === k.id).length < MAX_SAME_KIND).sort((x, y) => usedKinds.filter((u) => u === x.id).length - usedKinds.filter((u) => u === y.id).length).slice(0, 5).map((k) => k.id);
    return [{
      id: "maps-min",
      message: `Counted maps ${counted.length}/${need} — ${missing} more. Add places of this world with build_places{add:[{name, kind, from}]} (kinds not used up yet: ${spare.join(" · ")}), then give each a person or an examine event. A map counts when it is reached by doors from the start, has ${MIN_MAP_CELLS}+ cells and its own layout.${why ? ` Not counted: ${why}.` : ""}${linkCall}`,
      evidence: `counted=${counted.length} need=${need} uncounted=${uncounted.length}`,
    }];
  }
  return [{
    id: "maps-min",
    // 할 일 항목의 열쇠는 문구 앞 160자(숫자는 #) — 바뀌는 부분(안 세는 맵 목록)은 고정 문장 뒤에 둔다. 앞에 두면 맵을 지을 때마다 열쇠가 바뀌어 «3번 뒤 막힘» 이 안 걸린다.
    message: `세는 맵이 ${counted.length}/${need}장이다 — ${missing}장 더. 새 장소는 make_place{spec:{type:"village"|"dungeon"|"interior", name}} 로 지어 문(transfer)으로 잇고 사람·조사 이벤트를 하나 이상 둔다(청사진 경로면 build_blueprint_path). 맵은 ${MIN_MAP_CELLS}칸 이상(실내는 10×10 이상)·타일 6종 이상·다른 맵과 다른 배치여야 센다.${why ? ` 안 세는 맵: ${why}.` : ""}${linkCall}`,
    evidence: `counted=${counted.length} need=${need} uncounted=${uncounted.length}`,
  }];
}

/**
 * 세는 퀘스트가 모자라면 출하 차단(2026-11-10 리드: 맵 다음 퀘스트 — 점수당 노력이 가장 큰 항목). 척도(questFacts)와 같은 규칙으로 센다.
 * 한 장소 요청은 최소 1개(mapsMinBlocker 와 같은 낱말 판정). 문구는 고정 문장을 앞에 둔다 — 할 일 열쇠가 앞 160자라 바뀌는 목록은 뒤로.
 */
export function questsMinBlocker(project: Project, task: string): ShipBlocker[] {
  const need = oneProjectGame(project, task) ? 1 : MIN_COUNTED_QUESTS;
  const { counted, uncounted } = countQuests(project);
  if (counted.length >= need) return [];
  const why = uncounted.slice(0, 4).map((q) => `「${q.title}」(${q.id}) ${q.detail}`).join(" · ");
  return [{
    id: "quests-min",
    message: `세는 퀘스트가 ${counted.length}/${need}개다 — ${need - counted.length}개 더. 퀘스트마다 단계 2개 이상, 단계마다 서로 다른 label 이 있어야 센다(label 없는 단계는 안 센다), 제목은 퀘스트마다 다르게: create_quest{def:{key:"q_<영문>", title:"<제목>", order:"sequence", giver:{create:{mapId,x,y,name}}, steps:[{kind:"talk", label:"<1단계 목표>", target:{create:{mapId,x,y,name}}, lines:["…"]}, {kind:"talk", label:"<2단계 목표>", target:{create:{mapId,x,y,name}}, lines:["…"]}]}}. 물건을 나르는 의뢰(술통·편지·약)는 실제 물건을 옮긴다: onAcceptItems:[{itemId,count:1}] + 단계 {kind:"deliver", itemId, count:1, target, label, lines}(먼저 upsert_item) — talk 단계는 아무것도 나르지 않는다.${why ? ` 안 세는 퀘스트: ${why}.` : ""}`,
    evidence: `counted=${counted.length} need=${need} uncounted=${uncounted.length}`,
  }];
}

/**
 * 진행 깊이(척도 act_structure)가 모자라면 출하 차단(2026-11-10 리드·오너: 맵 다음 act_structure — 청사진 단계 늘리기). 척도(progressionDepth)와 같은 규칙으로 잰다 —
 * 청사진 단계 수가 아니라 «스위치를 켜고 다음 이벤트가 그 스위치를 조건으로 읽는» 사슬의 길이라서, 이름만 늘리거나 이미 있는 이벤트 이름을 붙여도 통과하지 못한다.
 * 한 장소 게임(방탈출·「방 하나」)은 면제(깊이 1). 문구는 고정 문장을 앞에 둔다 — 할 일 열쇠가 앞 160자라 바뀌는 숫자는 뒤로.
 */
export function actDepthMinBlocker(project: Project, task: string): ShipBlocker[] {
  if (oneProjectGame(project, task)) return [];
  const depth = progressionDepth(project);
  if (depth >= MIN_ACT_DEPTH) return [];
  // 처방이 «청사진 단계를 늘려 다시 써라» 인 관문이다 — 청사진이 이미 그만큼 길고(서로 다른 단계 이벤트 MIN+1 개 이상) 그 경로가 엔딩까지 이어져 있으면 올리지 않는다.
  // 깊이는 스위치·변수로 이어진 사슬만 센다: 가운데 단계 하나가 물건으로 넘기면(고르기 단계의 gives 가 아이템) 7단계 경로가 깊이 3 으로 재어진다.
  // 2026-11-12 Terra 측정 r1-fun: 7단계·7장소 경로를 다 지은 뒤 이 관문이 서서 모델이 사람 이름만 바꿔 청사진을 다시 썼고, 이야기 줄이 두 벌이 돼 첫 마을에서 막혔다(눈가림 재미 2).
  const bp = project.gameBlueprint;
  if (bp && new Set(bp.steps.map((step) => `${step.place}\u0000${step.event}`)).size > MIN_ACT_DEPTH
    && !walkBlueprint(project).blockers.some((b) => BLUEPRINT_PATH_IDS.has(b.id) || b.id === "blueprint-place-missing" || b.id === "blueprint-place-unreachable")) return [];
  return [{
    id: "act-depth-min",
    message: `이야기가 이어지는 단계(진행 깊이)가 ${depth}/${MIN_ACT_DEPTH} 이다 — 청사진 단계를 늘린다. write_blueprint 로 핵심 경로를 6~8단계로 다시 쓰고(장소를 2곳 이상 나눠 둔다) build_blueprint_path 를 한 번 부른다. 새 단계의 event 는 아직 없는 새 이름으로 — 이미 있는 이벤트 이름을 쓰면 사슬이 늘지 않는다. 전투·상점이 든 단계 이벤트는 다시 지어지지 않으니 patch_event_page 로 앞 단계가 켠 스위치를 조건으로 잇는다.`,
    evidence: `depth=${depth} need=${MIN_ACT_DEPTH}`,
  }];
}

export function shipBlockers(project: Project, task: string): ShipBlocker[] {
  const spoilers = titleSpoilers(project);
  // 「끝까지 만들어 줘」 같은 이어 하기 요청은 낱말 판정(wantsWholeGame)에 안 걸려 출하 검사가 통째로 꺼졌다(2026-11-09 village-1: 2턴째에 엔딩 기본 그림이 항목이 안 됐다).
  // 청사진은 첫 요청문을 들고 있다 — 게임을 만드는 요청으로 시작한 프로젝트면 이어 하는 턴도 같은 출하 검사를 받는다.
  if (!buildsWholeGame(project, task)) return spoilers;
  // 저장 → 다시 읽기(reloadCheck): 저장본이 안 열리면 플레이어·편집기 모두 게임을 못 연다 — 다른 검사가 다 통과해도 출하 결함(2026-10-29 vm6 「events[9].trigger」).
  const reload = reloadProblem(project);
  const reloadBlock: ShipBlocker[] = reload ? [{ id: "project-reload-failed", message: `저장한 프로젝트를 다시 읽지 못한다 — 게임이 열리지 않는다: ${reload.slice(0, 240)}. 그 필드를 고친 뒤 다시 저장한다.`, evidence: reload.slice(0, 120) }] : [];
  // 엔딩 길의 열쇠·금고·문·엔딩 이벤트에 걸어 닿지 못하면 게임을 끝낼 수 없다(J75) — 출하 차단.
  const silentExits = silentLockedExits(project).slice(0, 3).map((hit): ShipBlocker => ({ id: "locked-exit-silent", message: `「${project.maps[hit.mapId]?.name ?? hit.mapId}」 (${hit.x},${hit.y}) 출구는 조건이 맞아야 옮기는데 조건이 안 맞을 때 아무 말이 없다 — 막힐 때 이유 한 줄(무엇이 있어야·먼저 무엇을)을 둔다.`, evidence: `${hit.mapId} ${hit.eventId}` }));
  const strays = strayStepCopies(project).slice(0, 3).map((hit): ShipBlocker => ({ id: "blueprint-stray-copy", message: `청사진 ${hit.step} 이벤트의 사본이 「${project.maps[hit.mapId]?.name ?? hit.mapId}」 (${hit.x},${hit.y}) 에도 있어 싸우거나 엔딩을 부른다 — 「${project.maps[hit.canonicalMapId]?.name ?? hit.canonicalMapId}」 를 건너뛰는 지름길이다.`, evidence: `${hit.mapId} ${hit.eventId}` }));
  const sparkles = emptySparkles(project).slice(0, 4).map((hit): ShipBlocker => ({ id: "empty-sparkle", message: `「${project.maps[hit.mapId]?.name ?? hit.mapId}」 ${hit.eventId}(${hit.x},${hit.y}) 페이지 ${hit.page + 1} 이 반짝이는데 조사해도 아무 일도 없다 — 반짝임을 떼거나 대사 한 줄을 넣는다.`, evidence: `${hit.mapId} ${hit.eventId} p${hit.page}` }));
  const selfLoops = selfLoopTransfers(project).slice(0, 4).map((loop): ShipBlocker => ({ id: "transfer-self-loop", message: `「${project.maps[loop.mapId]?.name ?? loop.mapId}」 ${loop.eventId}(${loop.x},${loop.y}) 이 같은 맵 바로 옆 칸 (${loop.to.x},${loop.to.y}) 으로 옮긴다 — 제자리로 돌아올 뿐이라 고장 난 문처럼 보인다. 옮기기를 지우거나 다른 맵·먼 칸으로 잇는다.`, evidence: `${loop.mapId} ${loop.eventId} → (${loop.to.x},${loop.to.y})` }));
  const bossTalk = bossTalkWithoutBattle(project).slice(0, 3).map((hit): ShipBlocker => ({ id: "boss-talk-no-battle", message: `「${project.maps[hit.mapId]?.name ?? hit.mapId}」 「${hit.name}」(${hit.x},${hit.y}) 이 싸움을 거는 말을 하는데 전투가 열리지 않는다 — 말만 되풀이된다. 그 대사 페이지 끝에 battleProcessing{troopId:<${hit.name} 부대>} 을 붙이고 이긴 뒤 페이지를 둔다.`, evidence: `${hit.mapId} ${hit.eventId}` }));
  const unreachable = unreachableCriticalEvents(project).map((message): ShipBlocker => ({ id: "critical-unreachable", message: `${message}. 이벤트를 걸어 닿는 칸 옆으로 move_event 하거나 막는 가구를 치운다.`, evidence: message.slice(0, 120) }));
  // 계단 출구가 숨은 칸이다(J87) — 계단 앞에서 계단 쪽으로 걸어도 이동이 없다.
  const hiddenExits = hiddenStairExits(project).slice(0, 4);
  const hidden: ShipBlocker[] = hiddenExits.length ? [{ id: "exit-hidden", message: `계단 출구를 계단 쪽으로 걸어서는 탈 수 없다: ${hiddenExits.join(" · ")}. create_transfer_pair 를 계단 그림 칸으로 다시 부르면 계단 폭 전체가 출구가 된다.`, evidence: hiddenExits[0]!.slice(0, 120) }] : [];
  // 새 플레이어가 길을 찾나(J90): 이야기 이벤트가 보이고, 지금 할 일이 화면에 있다.
  const invisible: ShipBlocker[] = invisibleStoryEvents(project).slice(0, 4).map((event) => ({
    id: "critical-invisible",
    message: `「${event.mapName}」 ${event.name}(${event.eventId}, ${event.x},${event.y}) 은 ${event.ends ? "엔딩을 부르는" : "이야기를 넘기는"} 이벤트인데 화면에 아무것도 안 보인다(투명·건물 벽면 한 칸). 새 플레이어는 어디를 눌러야 하는지 모른다 — patch_event_page{mapId, eventId, pageIndex, set:{nearSparkle:{radius:2}}} 로 반짝임을 달거나, 그림이 있는 인물·작은 물건(상자·침대·표지판)으로 옮긴다.`,
    evidence: `${event.mapId} ${event.eventId} (${event.x},${event.y}) page ${event.pageIndex}`,
  }));
  // 그려진 입구(계단·스크린도어·문짝) 옆 맨바닥에 선 문·이야기 이벤트 — 새 플레이어는 그림을 누른다(J103·J104).
  const offArt: ShipBlocker[] = offArtEntrances(project).slice(0, 4).map((entry) => ({
    id: "entrance-off-art",
    message: `「${entry.mapName}」 ${entry.name}(${entry.eventId}) 이 그려진 입구 그림 (${entry.door.x},${entry.door.y}) 옆 맨바닥 (${entry.x},${entry.y}) 에 있다 — 새 플레이어는 그림을 눌러 보고 아무 일도 없어 길을 잃는다. move_event{mapId:'${entry.mapId}', eventId:'${entry.eventId}', x:${entry.door.x}, y:${entry.door.y}} 로 그림 칸에 옮긴다${doorCellBlocked(project, entry.mapId, entry.door.x, entry.door.y) ? ` — 그 칸은 막힌 칸이니 patch_event_page{mapId:'${entry.mapId}', eventId:'${entry.eventId}', pageIndex:0, set:{priority:'same', overlapForbidden:true}} 로 부딪혀 열리게 한다(조사형이면 그림을 바라보고 누르면 열린다)` : ""}.`,
    evidence: `${entry.mapId} ${entry.eventId} (${entry.x},${entry.y}) door (${entry.door.x},${entry.door.y})`,
  }));
  // 하루 반복 게임에서 이튿날 첫날 대사를 그대로 다시 한다(J106 「신입이지?」 둘째 날).
  const repeats: ShipBlocker[] = repeatedDayDialogue(project).slice(0, 4).map((entry) => ({
    id: "dialogue-repeat",
    message: `「${entry.mapName}」 ${entry.name}(${entry.eventId}) 의 「${entry.pageName}」 페이지가 ${entry.from}~${entry.to}일째를 덮는데 그 안에서 날을 가르지 않는다 — ${entry.from + 1}일째에 「${entry.line}…」 를 그대로 다시 한다. 날마다 페이지를 나누거나(조건 하루 변수 >= 그날), 페이지 안에서 fork{하루 변수 == ${entry.from}} 로 첫날과 다음 날 말을 가른다.`,
    evidence: `${entry.eventId} ${entry.pageName} ${entry.from}-${entry.to}`,
  }));
  // 장면 뒤에 남는 짙은 화면 색 — 필드가 대화 배경이 걸린 것처럼 어둡다(J98).
  const tints: ShipBlocker[] = lingeringHeavyTints(project).slice(0, 3).map((entry) => ({
    id: "field-tint-heavy",
    message: `「${entry.mapName}」 ${entry.name}(${entry.eventId}) 이 화면 색 「${entry.value}」(알파 ${entry.alpha})를 남긴 채 끝난다 — 필드 전체가 대화 배경이 걸린 것처럼 어두워 새 플레이어가 화면이 멈춘 줄 안다. 이 이벤트 끝의 화면 색을 알파 0.3 이하로 낮춘다(patch_event_page 로 그 m2-046 명령의 value 를 '20,30,80,0.3' 처럼) — 밤 분위기는 그 정도로 충분하고, 회상처럼 잠깐만 쓸 색이면 끝에 value:'neutral' 로 지운다.`,
    evidence: `${entry.eventId} ${entry.value}`,
  }));
  const objectives: ShipBlocker[] = objectiveGaps(project).map((message) => ({ id: "objective-missing", message, evidence: message.slice(0, 120) }));
  // 연애 게임의 호감이 인물에 묶이지 않으면 ESC 호감도·호감 HUD·호감 엔딩이 비어 있다(J91) — 경고가 아니라 막는다.
  const romance: ShipBlocker[] = romanceCompletionGaps(project, { task }).slice(0, 4).map((message) => ({ id: "romance-gap", message, evidence: message.slice(0, 120) }));
  // 짙은 어둠에 주인공 빛이 없으면 걸을 바닥이 검은 구멍이다(J89).
  // 이벤트가 실행 중에 주인공 빛을 켜는 게임(setLighting 에 player 광원)은 기본 조명만 보고 막지 않는다.
  const runtimePlayerLight = allCommands(project).some(({ cmd }) => cmd.kind === "setLighting" && JSON.stringify(cmd).includes('"at":"player"'));
  const unlit: ShipBlocker[] = runtimePlayerLight ? [] : Object.values(project.maps).flatMap((map) => {
    const finding = unlitDarkFinding(map);
    return finding ? [{ id: "dark-unlit", message: `「${map.name ?? map.id}」(${map.id}) ${finding.message.replace(/^시각 공백: /u, "")}`, evidence: `${map.id} ambient ${map.defaultLighting?.ambient}` }] : [];
  }).slice(0, 3);
  // 청사진 경로를 데이터로 걷는다(2026-10-28): 맵·이벤트가 있나, 걸어 닿나, 조건을 켜는 곳이 앞에 있나, 마지막이 엔딩인가.
  const blueprint: ShipBlocker[] = project.gameBlueprint ? walkBlueprint(project).blockers.slice(0, 6)
    : [{ id: "blueprint-missing", message: "이 게임의 청사진이 없다 — write_blueprint 로 새 플레이어 목표 한 줄·시작부터 엔딩까지 핵심 경로(장소·이벤트·조건)·엔딩을 지금 지은 이름 그대로 쓴다.", evidence: "project.gameBlueprint=undefined" }];
  // 전투가 있는데 HP 를 되찾을 길이 0(2026-10-29 vm1 flash jrpg 「전투 못 이김」) — 고칠 수 있는 결함: build_blueprint_path 가 결정적으로 넣는다.
  const sites = battleSites(project);
  const noHealing: ShipBlocker[] = sites.length && !healingSources(project).length ? [{
    id: "combat-no-healing",
    message: `전투가 있는데(${sites.slice(0, 3).join(", ")}${sites.length > 3 ? ` 외 ${sites.length - 3}곳` : ""}) 여관·회복약·회복 기술·상점 회복약이 하나도 없어 깎인 HP 가 돌아오지 않는다 — build_blueprint_path 를 다시 부르면 시작 맵에 회복의 샘(전원 회복·저장)과 시작 회복약 3개를 넣고 목표 줄이 샘 자리를 가리킨다. 직접 고치려면 place_savepoint{mapId:시작 맵, heal:true} 와 set_session_start{inventory:{item_potion:3}}.`,
    evidence: `battleSites=${sites.length} healingSources=0`,
  }] : [];
  return [...reloadBlock, ...blueprint, ...mapsMinBlocker(project, task), ...questsMinBlocker(project, task), ...actDepthMinBlocker(project, task), ...noHealing, ...hidden, ...unlit, ...invisible, ...offArt, ...repeats, ...tints, ...objectives, ...romance, ...editorDefaultsLeft(project), ...bundledPictureLeft(project), ...openingMissing(project), ...endingClosureProblems(project), ...endingConditionsUnset(project), ...openingWithoutPlace(project), ...offPremiseArt(project, task), ...defaultPlaceLeaks(project, task), ...titleMismatch(project, task), ...assemblyTimeMismatches(project).map((m): ShipBlocker => ({ id: "assembly-time-mismatch", message: m.message, evidence: m.evidence })), ...requestedFeatureGaps(project, task), ...chaserWithoutHiding(project), ...selfLoops, ...silentExits, ...bossTalk, ...strays, ...sparkles, ...unreachable, ...spoilers];
}
