// 조수 v2 출하 검사 — 다 지은 게임에 편집기 기본값이 남았는가, 엔딩이 장면으로 맺는가(2026-10-25 사용자 규칙).
//
// 왜: 조수가 지은 게임에 편집기 기본 타이틀(「새 프로젝트」·들판 그림)·기본 오프닝(「강을 낀 왕국에는…」)·기본 체력 HUD·
// 기본 이름(주인공)·기본 얼굴·기본 음악이 그대로 남았고(공포 저택 1턴·시타마치), 엔딩은 대사 한 줄이었다.
// 기준은 빈 프로젝트(createBlankProject) 자체다 — 그 값과 같으면 «아무도 고르지 않은» 기본값이다.
// 순수 함수(프로젝트만 읽는다). v2FinishGate 가 출하 차단으로, 조언자가 막는 항목(shipBlockers)으로 같이 부른다.
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

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
      .filter((id) => ![...battleTroops].some((t) => troops.find((tr) => tr.id === t)?.battleBackgroundResourceId));
    if (bareMaps.length) add("battle-background", `전투가 나는 맵 ${bareMaps.length}장에 전투 배경이 없어 편집기 기본 배경이 나온다 — set_map_properties{battleBackground} 나 적 무리의 battleBackgroundResourceId 로 그 장소의 배경을 고른다.`, bareMaps.slice(0, 5).join(","));
  }

  // 7) 게임 오버: 죽을 수 있는 게임인데 게임 오버 화면을 정하지 않았다
  const canDie = hasBattles || cmds.some((r) => r.cmd.kind === "killPlayer" || r.cmd.kind === "gameOver");
  if (canDie && !s.gameOver && !(s.gameOvers as unknown[] | undefined)?.length) add("game-over", "죽거나 질 수 있는 게임인데 게임 오버 화면이 편집기 기본이다 — set_game_over{presentation, title, body, background} 로 이 게임의 패배 화면과 돌아갈 자리를 정한다.", "system.gameOver=undefined");

  // 8) 엔딩 화면: 연출(presentation) 없이 기본 카드
  const bareEndings = (project.endings ?? []).filter((e) => !e.presentation || !Object.keys(e.presentation).length);
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

/** 조언자·끝맺음 관문이 같이 쓰는 출하 차단 목록(게임을 만드는 요청일 때만). 제목 스포일러는 어느 요청이든. */
export function shipBlockers(project: Project, task: string): ShipBlocker[] {
  const spoilers = titleSpoilers(project);
  if (!wantsWholeGame(task)) return spoilers;
  return [...editorDefaultsLeft(project), ...endingClosureProblems(project), ...spoilers];
}
