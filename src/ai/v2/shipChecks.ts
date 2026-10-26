// 조수 v2 출하 검사 — 다 지은 게임에 편집기 기본값이 남았는가, 엔딩이 장면으로 맺는가(2026-10-25 사용자 규칙).
//
// 왜: 조수가 지은 게임에 편집기 기본 타이틀(「새 프로젝트」·들판 그림)·기본 오프닝(「강을 낀 왕국에는…」)·기본 체력 HUD·
// 기본 이름(주인공)·기본 얼굴·기본 음악이 그대로 남았고(공포 저택 1턴·시타마치), 엔딩은 대사 한 줄이었다.
// 기준은 빈 프로젝트(createBlankProject) 자체다 — 그 값과 같으면 «아무도 고르지 않은» 기본값이다.
// 순수 함수(프로젝트만 읽는다). v2FinishGate 가 출하 차단으로, 조언자가 막는 항목(shipBlockers)으로 같이 부른다.
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { findOpeningStillMood } from "@/assets/openingStillMoods";
import { unreachableCriticalEvents } from "./puzzleChecks";
import { withoutIntentNote } from "@/ai/piAgent/monsterGameRequest";

type Obj = Record<string, unknown>;
export interface ShipBlocker { readonly id: string; readonly message: string; readonly evidence: string }

/** 게임 하나를 만들거나 완성하는 요청(작은 고치기 요청에는 출하 검사를 걸지 않는다). */
export const WHOLE_GAME_WORDS = /(게임|game)[^.!?\n]{0,60}(만들|지어|짜\s*줘|완성|제작|build|make)|(만들|지어|완성)[^.!?\n]{0,20}(게임|game)|엔딩까지|처음부터 끝까지|whole game/iu;
export function wantsWholeGame(task: string): boolean { return WHOLE_GAME_WORDS.test(task); }

let factoryCache: Project | undefined;
function factory(): Project {
  factoryCache ??= createBlankProject() as Project;
  return factoryCache;
}

/** 편집기 기본값 목록(LEDGER 의 목록과 같은 순서). 검사·문서가 같은 이름을 쓴다. */
export const EDITOR_DEFAULT_INVENTORY = [
  "title-name", "title-image", "opening", "opening-music", "hud", "window-look", "map-bgm", "battle-bgm", "battle-background",
  "game-over", "ending-screen", "party-names", "party-faces", "hero-look", "placeholder-text",
] as const;

/** 뼈대·자리표시 글(엔딩·이벤트 이름이나 대사에 남으면 안 된다). */
const PLACEHOLDER_NAMES = new Set(["첫 구간 끝", "구간 끝", "기억의 길", "기억의 조각", "산책로 끝", "첫 만남의 끝", "떨어진 수첩"]);
const PLACEHOLDER_TEXT = /\bTODO\b|\bTBD\b|lorem ipsum|placeholder|자리\s*표시|여기에\s*(대사|내용|설명)|\(대사\)|\[대사\]|대사를 입력|내용을 입력|임시 대사|테스트 대사/iu;

function walk(list: unknown, visit: (cmd: Obj) => void): void {
  if (!Array.isArray(list)) return;
  for (const raw of list) {
    const cmd = raw && typeof raw === "object" ? raw as Obj : undefined;
    if (!cmd) continue;
    visit(cmd);
    for (const key of ["then", "else", "branch", "commands", "cancelBranch", "beats"]) walk(cmd[key], visit);
    if (Array.isArray(cmd.options)) for (const o of cmd.options as Obj[]) walk(o?.branch, visit);
  }
}

function allCommands(project: Project): { cmd: Obj; mapId: string; eventName: string }[] {
  const out: { cmd: Obj; mapId: string; eventName: string }[] = [];
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    const e = ev as unknown as Obj;
    for (const page of (e.pages as Obj[] | undefined) ?? []) walk(page.commands, (cmd) => out.push({ cmd, mapId: map.id, eventName: String(e.name ?? e.id) }));
    walk(e.commands, (cmd) => out.push({ cmd, mapId: map.id, eventName: String(e.name ?? e.id) }));
  }
  for (const ce of (project.commonEvents ?? []) as unknown as Obj[]) walk(ce.commands, (cmd) => out.push({ cmd, mapId: "common", eventName: String(ce.name ?? ce.id) }));
  return out;
}

const textOf = (cmd: Obj): string => typeof cmd.text === "string" ? cmd.text : Array.isArray(cmd.lines) ? (cmd.lines as unknown[]).join(" ") : "";

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
  if (opening.enabled !== false && leftScenes.length) add("opening", `오프닝에 편집기 기본 장면 ${leftScenes.length}개(「${String(leftScenes[0]!.narration ?? "").slice(0, 20)}…」)가 남았다 — plan_opening·set_opening 으로 이 게임의 오프닝을 짓거나 set_opening{enabled:false} 로 끈다.`, leftScenes.map((sc) => String(sc.resourceId)).join(","));
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

/**
 * 하늘만 있는 일반 배경 층(oprn-pano-*·편집기 기본 타이틀) — 장소가 아니다. 밤하늘·별·노을·맑은 하늘·구름·바다 수면뿐이다.
 * 도시 실루엣 층(skyline·city)은 장소로 친다.
 */
const SKY_ONLY = /^oprn-pano-(night|sky-day(?!-city)|sunset(?!-skyline)|clouds|sea)/u;
export function isSkyOnlyImage(id: string | undefined): boolean {
  return !!id && SKY_ONLY.test(id) && !/city|skyline/u.test(id);
}

/** 오프닝 장면 하나가 «장소»를 보이는가: 맵 그대로(map-view)·장소 스틸·올린 그림이면 그렇다, 하늘 층·글 장면뿐이면 아니다. */
function sceneImages(scene: Obj): string[] {
  if (scene.kind === "image" || scene.kind === "video") {
    const layers = (((scene.direction as Obj | undefined)?.layers as Obj[] | undefined) ?? []).map((l) => String(l.resourceId ?? ""));
    return [String(scene.resourceId ?? ""), ...layers].filter(Boolean);
  }
  if (scene.kind === "animatic") {
    const layers = (((scene.composition as Obj | undefined)?.layers as Obj[] | undefined) ?? []);
    return layers.filter((l) => l.kind === "image" && (l.role === "background" || l.role === undefined)).map((l) => String(l.resourceId ?? "")).filter(Boolean);
  }
  return [];
}

/**
 * 오프닝에 장소가 한 번도 안 나온다(2026-10-25 판정 J24·J65): 약초 숲 오프닝은 노을·밤·맑은 하늘 층 셋, 공포 저택은 밤하늘·별 층과
 * 어두운 상자, 폐교는 별이 뜬 하늘뿐이었다. 플레이어는 어디서 무슨 일이 나는지 모른 채 시작한다. 장면 하나 이상이 그 게임의 장소
 * (맵 그대로 map-view·장소 스틸·올린 그림)를 보여야 한다.
 */
export function openingWithoutPlace(project: Project): ShipBlocker[] {
  const op = (project.system as unknown as Obj).opening as Obj | undefined;
  if (!op || op.enabled === false) return [];
  const scenes = ((op.scenes as Obj[] | undefined) ?? []);
  // 글만 있는 프롤로그(그림 장면 0개)는 따로 고른 연출이다 — 그림을 깐 오프닝만 본다.
  if (!scenes.some((sc) => sceneImages(sc).length)) return [];
  const placeShot = scenes.some((sc) => sceneImages(sc).some((id) => !isSkyOnlyImage(id) && id !== "oprn-title-field"));
  if (placeShot) return [];
  const used = [...new Set(scenes.flatMap(sceneImages))];
  const firstMap = project.maps[project.startMapId];
  return [{
    id: "opening-no-place",
    message: `오프닝 ${scenes.length}장면이 하늘·별·구름 같은 일반 배경(${used.slice(0, 4).join(", ")})만 보이고 이 게임의 장소가 한 번도 안 나온다 — 어디서 일이 나는지 모른 채 시작한다. `
      + `맞는 장소 그림이 없으면 게임 맵을 그대로 쓴다: create_opening_animatic_shot{shotId} 뒤 place_opening_background{shotId, layerId:'bg', mapId:'${firstMap?.id ?? "<무대 맵 id>"}', focus:{x,y}}(${firstMap?.name ?? "무대"}의 대표 자리 — 건물 정문·광장), 인물은 place_opening_charset_actor. `
      + `맞는 스틸이 있으면 list_opening_media{kind:'image', query:<장소 낱말>} 로 골라 그 장면에 쓴다. 하늘 층은 장소 장면 뒤 겹으로만.`,
    evidence: `opening images=${used.join(",") || "none"}`,
  }];
}

/** 그림 설명·태그가 말하는 계절·풍토 낱말 — 요청·게임 글에 같은 계열 낱말이 없으면 «다른 이야기 그림»이다. */
const SETTING_WORDS: readonly { readonly key: string; readonly art: RegExp; readonly premise: RegExp }[] = [
  { key: "눈·겨울", art: /눈 덮인|설원|겨울|눈 쌓인|winter|snow|얼음|오로라/iu, premise: /눈|겨울|설원|얼음|빙|크리스마스|winter|snow|ice/iu },
  { key: "사막", art: /사막|모래|피라미드|desert|오아시스/iu, premise: /사막|모래|피라미드|오아시스|desert/iu },
  { key: "바다·해저", art: /해저|바다|항구|ocean|harbor/iu, premise: /바다|해저|항구|섬|배를|해변|ocean|sea|harbor/iu },
];
function artText(id: string | undefined): string {
  if (!id) return "";
  const still = findOpeningStillMood(id);
  if (still) return `${still.name} ${still.description} ${still.tags.join(" ")}`;
  return id === "oprn-title-field" ? "별빛 아래 눈 덮인 산과 소나무, 등불 켜진 눈 마을(편집기 기본 타이틀)" : "";
}

/**
 * 타이틀·엔딩 그림이 이야기와 다른 곳이다(2026-10-25 판정 J10·J17): 약초 숲 JRPG 타이틀에 눈 내리는 기본 마을, 서울 연애 엔딩 셋이
 * 눈 덮인 산골 마을(엔딩 그림이 비어 타이틀 그림을 이어 썼다). 그림 설명의 계절·풍토 낱말이 요청·게임 글에 없으면 짚는다.
 */
export function offPremiseArt(project: Project, task: string): ShipBlocker[] {
  const s = project.system as unknown as Obj;
  const title = (s.titleScreen ?? {}) as Obj;
  const titleBg = (title.backgroundResourceId ?? s.titleResourceId) as string | undefined;
  const premise = [task, project.meta.title, String(title.title ?? ""), ...(project.endings ?? []).map((e) => e.name), ...Object.values(project.maps).map((m) => m.name)].join(" ");
  const clash = (id: string | undefined): string | undefined => {
    const text = artText(id);
    return SETTING_WORDS.find((w) => w.art.test(text) && !w.premise.test(premise))?.key;
  };
  const out: ShipBlocker[] = [];
  // 편집기 기본 타이틀 그림은 title-image 가 이미 짚는다.
  const tKey = titleBg === "oprn-title-field" ? undefined : clash(titleBg);
  if (tKey) out.push({ id: "title-off-premise", message: `타이틀 그림(${titleBg}: ${artText(titleBg).slice(0, 40)}…)이 ${tKey} 풍경인데 이 게임 이야기에는 ${tKey}이 없다 — list_resources{kind:'backdrop', query:<무대 낱말>}·list_opening_media{kind:'image', query:<무대 낱말>} 로 이야기의 장소 그림을 골라 set_title_screen{backgroundResourceId} 로 바꾼다.`, evidence: `title=${titleBg}` });
  const bare = (project.endings ?? []).filter((e) => !e.presentation?.backgroundResourceId);
  const fallKey = clash(titleBg);
  if (bare.length && (fallKey || titleBg === "oprn-title-field")) out.push({ id: "ending-off-premise", message: `엔딩 ${bare.length}개(${bare.slice(0, 3).map((e) => e.name).join("·")})에 마지막 그림이 없어 타이틀 그림(${titleBg})이 깔린다 — ${fallKey ? `${fallKey} 풍경이라 이 이야기와 다르다` : "편집기 기본 눈 마을이다"}. define_ending 의 presentation.backgroundResourceId 에 그 엔딩의 장소 그림(list_resources{kind:'backdrop', query:<장소 낱말>} 에서 가장 가까운 것)을 준다.`, evidence: bare.map((e) => e.id).join(",") });
  for (const e of project.endings ?? []) {
    const key = clash(e.presentation?.backgroundResourceId);
    if (key) out.push({ id: "ending-off-premise", message: `엔딩 「${e.name}」 그림(${e.presentation!.backgroundResourceId})이 ${key} 풍경인데 이야기에는 ${key}이 없다 — 이 엔딩의 장소 그림으로 바꾼다.`, evidence: `${e.id}=${e.presentation!.backgroundResourceId}` });
  }
  return out;
}

/**
 * 제목·엔딩이 기본 시작 칩셋의 고유 지명을 게임 주제로 삼았다(J70, hf2-school-flash: 밤의 학교 공포 게임이 「버들항의 모험」·
 * 엔딩 「모험의 끝」 "버들항의 평화"로 끝났다). 새 프로젝트가 처음부터 들고 있는 칩셋 계열 이름이라 요청에 없으면 모델이 지어낸 것이다.
 * task 는 앞선 요청 메모까지 든 실행 지시문이다 — 같은 대화의 어느 요청이든 그 지명을 말했으면 정당하다.
 */
/** 플레이어에게 보이는 글만 — 문자열 줄과 비트의 text·lines(id·자원 참조는 빼고). */
function shownTexts(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(shownTexts);
  if (v && typeof v === "object") { const o = v as Obj; return [...shownTexts(o.text), ...shownTexts(o.lines)]; }
  return [];
}
const DEFAULT_PLACE_FAMILIES = ["beodeul"] as const;
export function defaultPlaceLeaks(project: Project, task: string): ShipBlocker[] {
  const words = new Set<string>();
  for (const [id, ts] of Object.entries(project.tilesets ?? {})) {
    if (!DEFAULT_PLACE_FAMILIES.some((f) => id.startsWith(f))) continue;
    const head = String((ts as { name?: unknown }).name ?? "").trim().split(/[\s·]+/u)[0] ?? "";
    if (/^[가-힣]{2,}$/u.test(head)) words.add(head);
  }
  const out: ShipBlocker[] = [];
  for (const word of words) {
    if (task.includes(word)) continue;
    const title = String(((project.system as unknown as Obj).titleScreen as Obj | undefined)?.title ?? "");
    const where = [
      ...(title.includes(word) ? [`타이틀 「${title}」`] : []),
      ...(String(project.meta.title ?? "").includes(word) && project.meta.title !== title ? [`프로젝트 제목 「${project.meta.title}」`] : []),
      ...(project.endings ?? []).filter((e) => [e.name, ...shownTexts((e as unknown as Obj).epilogue)].some((t) => t.includes(word))).map((e) => `엔딩 「${e.name}」`),
    ];
    if (where.length) out.push({ id: "default-place-leak", message: `${where.slice(0, 4).join("·")}이 「${word}」을 말하는데 요청에는 ${word}이 없다 — ${word}은 새 프로젝트 기본 칩셋 이름이지 이 게임의 무대가 아니다. 요청한 이야기에서 제목(set_title_screen{title})·엔딩(define_ending)을 다시 짓는다.`, evidence: `${word}: ${where.join(", ").slice(0, 160)}` });
  }
  return out;
}

/**
 * 요청이 제목을 못박았는데 다른 제목으로 냈다(J71 hf2-mansion-flash 「검은 장미의 비밀」, J73 hf2-mansion-argon 「저택 탈출」 —
 * 요청은 「제목은 「검은 장미 저택」」). 「」『』"" 로 묶인 제목 낱말만 본다(묶지 않은 글은 제목인지 알 수 없다). 게임을 만드는 요청에서만 막는다.
 */
// 게임 제목만 — 앞에 낱말이 붙거나(부제목·subtitle) 게임 안의 다른 제목(책·표지판·챕터·퀘스트·곡…)이면 아니다.
const REQUESTED_TITLE = /(?<![\p{L}\p{N}])(?<!(?:책|표지판?|간판|챕터|퀘스트|노래|곡|장|편지|일기|그림|영화|소설|시|팻말|문서|보고서)\s?)(?:제목|타이틀|title)\s*(?:은|는|을|를|이|가|:|=)?\s*(?:「([^」\n]{1,40})」|『([^』\n]{1,40})』|"([^"\n]{1,40})"|“([^”\n]{1,40})”)(?!\s*(?:은|는|을|를)?\s*(?:말고|대신|쓰지|빼|아니))/giu;
const firstTitle = (text: string): string | undefined => {
  for (const m of text.matchAll(REQUESTED_TITLE)) { const t = m.slice(1).find((g) => g !== undefined)?.trim(); if (t) return t; }
  return undefined;
};
/** 이번 글의 제목이 먼저, 없으면 앞선 요청 메모(J70)의 제목. */
export function requestedTitle(task: string): string | undefined {
  const own = withoutIntentNote(task);
  return firstTitle(own) ?? firstTitle(task.slice(own.length));
}
const squash = (s: string): string => s.replace(/\s+/gu, "").normalize("NFC");
export function titleMismatch(project: Project, task: string): ShipBlocker[] {
  const want = requestedTitle(task);
  if (!want) return [];
  const shown = String(((project.system as unknown as Obj).titleScreen as Obj | undefined)?.title ?? project.meta.title ?? "").trim();
  if (squash(shown) === squash(want)) return [];
  return [{ id: "title-not-requested", message: `요청한 제목은 「${want}」인데 타이틀이 「${shown || "(없음)"}」이다 — set_title_screen{title:"${want}"} 로 요청한 제목을 그대로 쓴다.`, evidence: `want=${want} shown=${shown}` }];
}

/** 조언자·끝맺음 관문이 같이 쓰는 출하 차단 목록(게임을 만드는 요청일 때만). 제목 스포일러는 어느 요청이든. */
export function shipBlockers(project: Project, task: string): ShipBlocker[] {
  const spoilers = titleSpoilers(project);
  if (!wantsWholeGame(task)) return spoilers;
  // 엔딩 길의 열쇠·금고·문·엔딩 이벤트에 걸어 닿지 못하면 게임을 끝낼 수 없다(J75) — 출하 차단.
  const unreachable = unreachableCriticalEvents(project).map((message): ShipBlocker => ({ id: "critical-unreachable", message: `${message}. 이벤트를 걸어 닿는 칸 옆으로 move_event 하거나 막는 가구를 치운다.`, evidence: message.slice(0, 120) }));
  return [...editorDefaultsLeft(project), ...endingClosureProblems(project), ...openingWithoutPlace(project), ...offPremiseArt(project, task), ...defaultPlaceLeaks(project, task), ...titleMismatch(project, task), ...unreachable, ...spoilers];
}

/** 게임이 «아직 안 지어졌다»는 신호 — 뼈대 자리표시만 남았거나 엔딩이 없다(편집기 기본 HUD·창 같은 마감 항목은 여기서 보지 않는다). */
export const WHOLE_GAME_REKICKS = 3;
export function unbuiltGameSigns(project: Project, task: string): string[] {
  const out: string[] = [];
  const skeleton = (project.endings ?? []).filter((e) => PLACEHOLDER_NAMES.has(e.name.trim()));
  const real = (project.endings ?? []).filter((e) => !PLACEHOLDER_NAMES.has(e.name.trim()));
  if (skeleton.length && !real.length) out.push(`엔딩이 뼈대 자리표시(${skeleton.map((e) => `「${e.name}」`).join("·")})뿐이다 — 요청한 이야기의 엔딩이 없다`);
  else if (!real.length && /엔딩|결말|ending/iu.test(task)) out.push("엔딩이 하나도 없다");
  const skeletonEvents = Object.values(project.maps).flatMap((m) => (m.events ?? []).filter((ev) => PLACEHOLDER_NAMES.has(String(ev.name ?? "").trim())).map((ev) => `「${ev.name}」(${m.name})`));
  if (skeletonEvents.length && !real.length) out.push(`뼈대 이벤트가 그대로다: ${skeletonEvents.slice(0, 3).join(" · ")}`);
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
