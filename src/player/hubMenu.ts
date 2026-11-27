// player/hubMenu.ts — ESC 메뉴 「허브 카드형 · 타이틀 별밤」(2026-11-26 오너 결정: 시안 B 변형 8).
//
// 상태와 동작은 옛 메뉴 컨트롤러(playerStatusMenuController)의 것을 그대로 쓴다. 이 파일은 그리는 쪽만 바꾼다:
//   - 첫 화면(허브): 동료 카드 + 아이템·스킬·장비·상태 칸(칸마다 한 줄 요약) + 돈·장소·시간과 나머지 명령 단추.
//   - 아이템·스킬·장비·상태 쪽: 왼쪽 동료 열 · 가운데 격자 · 오른쪽 상세(설명 전문). 데이터와 동작은
//     createStatusMenuDetail 의 항목(entry)을 읽고 그 onActivate 를 누른다 — 사용·장착 규칙을 다시 쓰지 않는다.
//   - 그 밖의 명령(저장·불러오기·설정·대열·타이틀로…)은 같은 틀(배경·머리줄) 안에 옛 상세 목록을 그린다.
// 커서는 data-hub-k 키 하나로 기억한다(컨트롤러의 hubFocus). 방향키는 화면 위 위치로 가장 가까운 칸을 찾는다.
// 해상도: 480×270 을 기준으로 그렸고, 더 큰 무대는 정수배로 키운다. 폰 세로 창 칸(320×300~400)과 320×240 은 세로 배치.
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { actorDerivedStats } from "@/battle/battleBattlers";
import { holdsKeyItems } from "@/player/playerBagPockets";
import { DEFAULT_INVENTORY_VIEW, type InventoryView } from "@/player/playerInventoryView";
import { partyWalker } from "@/player/partyWalker";
import { createStatusMenuDetail, bestEquipmentPlan, type StatusMenuDetail, type StatusMenuDetailEntry } from "@/player/playerStatusMenuDetails";
import { itemEffectSummary, renderStatusMenuDetailPanel } from "@/player/playerStatusMenuDetailRenderer";
import { createPlayerStatusMenuSnapshot, statusMenuCommandLabel, listStatusMenuCommandIds, type PlayerStatusMenuPartyRow, type StatusMenuCommandId, type StatusMenuRailId } from "@/player/playerStatusMenuModel";
import { usesMonsterParty } from "@/player/playerMonsterPartyModel";
import type { PlayerStatusMenuOptions } from "@/player/playerStatusMenuTypes";
import { statusMenuDetailOptions } from "@/player/playerStatusMenu";
import { isEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import { usesRelationshipMenu } from "@/project/relationshipMenu";
import { gameHasCombat } from "@/project/combatPresence";
import { canEquip, effectiveActorEquipment } from "@/project/equipmentRules";
import { equipmentSlots } from "@/project/equipmentSlots";
import { normalizeActorRecord } from "@/project/actorModel";
import { effectiveActorClassId } from "@/project/sessionClass";
import { resolvePlayResolution } from "@/project/playResolution";
import { resolveTerms } from "@/project/terms";
import type { PlaySession } from "@/project/session";
import type { ActorInitialEquipment, ActorRecord, Project } from "@/project/types";

/** 허브가 그리는 쪽. hub 는 첫 화면, generic 은 옛 상세 목록을 같은 틀에 담은 쪽. */
export type HubPage = "hub" | "items" | "skills" | "equipment" | "status" | "generic";

/** 허브 메뉴를 쓸 게임인가. 기본으로 켜진다(옛 프로젝트·내보낸 게임도) — 「옛 메뉴」(menuLayout legacy)를 고른 게임과
 *  배우 파티로 싸우지 않는 게임(몬스터 파티·연애·전투 없는 이야기)은 자기 메뉴(옛 틀)를 쓴다. */
export function hubMenuEnabled(project: Project, session: PlaySession | undefined): boolean {
  if (project.system.menuLayout === "legacy") return false;
  if (!session || session.partyActorIds.length === 0) return false;
  if (usesMonsterParty(project) || isEmeraldMonsterStyle(project) || usesRelationshipMenu(project) || !gameHasCombat(project)) return false;
  return true;
}

export const HUB_TILE_COMMANDS = ["items", "skills", "equipment", "status"] as const satisfies readonly StatusMenuCommandId[];
type HubTileCommand = (typeof HUB_TILE_COMMANDS)[number];

export function isHubTileCommand(command: StatusMenuRailId): command is HubTileCommand {
  return (HUB_TILE_COMMANDS as readonly string[]).includes(command);
}

/** 지금 컨트롤러 상태가 어느 허브 쪽인가. 스킬 성장판(탭)·아이템 조합 화면처럼 허브 쪽이 없는 것은 generic. */
export function hubPageFor(options: Pick<PlayerStatusMenuOptions, "mode" | "selectedCommand" | "itemActionId" | "skillActorId" | "equipmentActorId">, growthTabs: boolean): HubPage {
  if ((options.mode ?? "main") === "main") return "hub";
  switch (options.selectedCommand) {
    case "items": return options.itemActionId ? "generic" : "items";
    case "skills": return options.skillActorId && !growthTabs ? "skills" : "generic";
    case "equipment": return options.equipmentActorId ? "equipment" : "generic";
    case "status": return "status";
    default: return "generic";
  }
}

/** 메뉴 판의 논리 크기. 세로 창 칸이면 그 칸, 아니면 무대 해상도를 480×270 기준 정수배로 나눈 값. */
export type HubBoard = { readonly w: number; readonly h: number; readonly zoom: number; readonly tall: boolean };

export function hubBoardFor(project: Project, viewport: HTMLElement | null): HubBoard {
  if (viewport?.dataset.windowPanel) {
    const h = Number.parseFloat(viewport.style.getPropertyValue("--panel-h")) || 300;
    return { w: 320, h: Math.round(h), zoom: 1, tall: true };
  }
  const res = resolvePlayResolution(project.system);
  const fit = Math.min(res.width / 480, res.height / 270);
  const zoom = Number.isFinite(fit) && fit >= 2 ? Math.floor(fit) : 1;
  const w = Math.floor(res.width / zoom), h = Math.floor(res.height / zoom);
  return { w, h, zoom, tall: w < 440 };
}

export type HubMenuOptions = PlayerStatusMenuOptions & {
  readonly board: HubBoard;
  /** 커서가 있는 칸의 키(data-hub-k). 없으면 쪽마다 첫 칸. */
  readonly hubFocus?: string;
  /** 아이템·스킬 격자에서 마지막으로 고른 칸(상세에 그린다). */
  readonly hubSel: number;
  /** 장비 쪽에서 커서가 올라간 후보(-1 = 없음). */
  readonly hubCand: number;
  /** 스킬·장비·상태 쪽이 보이는 동료. */
  readonly hubActorId?: string;
  readonly hubActions: {
    /** 칸을 누르면: 커서만 옮기는 칸(격자·후보)은 처음 누를 때 커서만, 같은 칸을 다시 누르면 실행. */
    readonly focus: (key: string) => void;
    readonly openPage: (command: StatusMenuCommandId, actorId?: string) => void;
    readonly back: () => void;
  };
};

const esc = (value: string): string => value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const url = (project: Project, resourceId: string | undefined): string | null => resolveAssetResourceUrl(resourceId, { project });
const cssUrl = (value: string): string => `url("${value.replace(/["\\]/g, "\\$&")}")`;

const M = 8;
const G = 6;

export function renderHubMenu(options: HubMenuOptions): HTMLElement {
  const { project, session, board } = options;
  const snapshot = createPlayerStatusMenuSnapshot(project, session, { waitModeEnabled: options.waitModeEnabled ?? true });
  const growthTabs = options.selectedCommand === "skills" && Boolean(options.skillActorId)
    && Boolean(createStatusMenuDetail(statusMenuDetailOptions(options, "skills")).tabs?.length);
  const page = hubPageFor(options, growthTabs);
  const panel = document.createElement("div");
  panel.className = "main-menu hub-menu";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "메뉴");
  panel.dataset.testid = "main-menu";
  panel.dataset.hubMenu = "true";
  panel.dataset.hubPage = page;
  panel.dataset.statusMenuScreen = options.mode ?? "main";
  panel.dataset.statusMenuCommand = String(options.selectedCommand ?? "items");
  panel.dataset.hubTall = String(board.tall);
  applyHubTheme(panel, project);

  const stage = document.createElement("div");
  stage.className = "hub-board";
  stage.style.width = `${board.w}px`;
  stage.style.height = `${board.h}px`;
  if (board.zoom > 1) stage.style.transform = `scale(${board.zoom})`;
  const back = document.createElement("div");
  back.className = "hub-back";
  const titleArt = hubTitleArt(project);
  if (titleArt) back.style.backgroundImage = `linear-gradient(180deg, rgba(2,4,16,.2), rgba(2,4,16,.55)), ${cssUrl(titleArt)}`;
  else back.dataset.fallback = "true";
  stage.append(back);

  const ctx: Ctx = { options, snapshot, board, stage, page };
  if (page === "hub") drawHub(ctx);
  else if (page === "items") drawItems(ctx);
  else if (page === "skills") drawSkills(ctx);
  else if (page === "equipment") drawEquipment(ctx);
  else if (page === "status") drawStatus(ctx);
  else drawGeneric(ctx);

  // 알림 줄 — 사용 결과·거절 사유(컨트롤러 rejectInput 도 이 칸에 쓴다).
  const message = document.createElement("div");
  message.className = "status-menu-message hub-toast";
  message.dataset.testid = "status-menu-message";
  if (options.message) message.textContent = options.message;
  stage.append(message);

  panel.append(stage);
  markFocus(panel, page, options.hubFocus);
  // 듣는 곳은 판(stage) — 컨트롤러가 열린 메뉴 루트를 재사용하며 자식만 옮겨 담는다(adoptStatusMenuPanel).
  stage.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-hub-k]");
    if (!target || !stage.contains(target)) return;
    event.preventDefault();
    const key = target.dataset.hubK!;
    const already = stage.querySelector<HTMLElement>(".hub-foc")?.dataset.hubK === key;
    // 격자 칸·후보·슬롯은 처음 누르면 고르기만(상세를 본다), 다시 누르면 실행. 단추는 바로 실행.
    if (target.dataset.hubPreview === "true" && !already) {
      options.hubActions.focus(key);
      return;
    }
    activateHubElement(target, options);
  });
  return panel;
}

/** Enter/누르기 — 칸이 가진 동작을 실행한다. 못 쓰는 칸은 사유를 알림 줄에 쓴다(호출자가 소리를 낸다). */
export function activateHubElement(target: HTMLElement, options: Pick<HubMenuOptions, "hubActions">): "done" | { readonly rejected: string } {
  const reason = target.dataset.unavailableReason;
  if (reason) return { rejected: reason };
  const run = HANDLERS.get(target);
  if (run) { run(); return "done"; }
  const go = target.dataset.hubGo as StatusMenuCommandId | undefined;
  if (go) { options.hubActions.openPage(go, target.dataset.hubActor); return "done"; }
  if (target.dataset.hubBack !== undefined) { options.hubActions.back(); return "done"; }
  return { rejected: "선택할 수 없습니다" };
}

/** 방향키 — 지금 칸에서 그 방향으로 가장 가까운 칸(화면 위 위치 기준). 없으면 undefined. */
export function nextHubFocus(panel: HTMLElement, dir: "up" | "down" | "left" | "right"): string | undefined {
  const els = [...panel.querySelectorAll<HTMLElement>("[data-hub-k]")];
  const cur = panel.querySelector<HTMLElement>(".hub-foc") ?? els[0];
  if (!cur) return undefined;
  const r = cur.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best: HTMLElement | undefined, score = Infinity;
  for (const e of els) {
    if (e === cur) continue;
    const q = e.getBoundingClientRect();
    const x = q.left + q.width / 2, y = q.top + q.height / 2, dx = x - cx, dy = y - cy;
    let p: number, o: number;
    if (dir === "right") { if (q.left < r.right - 2) continue; p = dx; o = Math.abs(dy); }
    else if (dir === "left") { if (q.right > r.left + 2) continue; p = -dx; o = Math.abs(dy); }
    else if (dir === "down") { if (q.top < r.bottom - 2) continue; p = dy; o = Math.abs(dx); }
    else { if (q.bottom > r.top + 2) continue; p = -dy; o = Math.abs(dx); }
    if (p <= 0) continue;
    const s = p + o * 2;
    if (s < score) { score = s; best = e; }
  }
  return best?.dataset.hubK;
}

const HANDLERS = new WeakMap<HTMLElement, () => void>();

type Ctx = {
  readonly options: HubMenuOptions;
  readonly snapshot: ReturnType<typeof createPlayerStatusMenuSnapshot>;
  readonly board: HubBoard;
  readonly stage: HTMLElement;
  readonly page: HubPage;
};

function markFocus(panel: HTMLElement, page: HubPage, focus: string | undefined): void {
  // 옛 목록 쪽은 커서가 목록 줄(.selected)에 있다 — 머리줄 단추에 두 번째 선택 표시를 두지 않는다.
  if (page === "generic") return;
  const all = [...panel.querySelectorAll<HTMLElement>("[data-hub-k]")];
  const el = (focus ? all.find((e) => e.dataset.hubK === focus) : undefined)
    ?? all.find((e) => e.dataset.hubDefault === "true")
    ?? all.find((e) => !e.matches("[data-hub-back]"))
    ?? all[0];
  if (!el) return;
  el.classList.add("hub-foc");
  el.setAttribute("aria-current", "true");
  panel.dataset.hubFocus = el.dataset.hubK;
  void page;
}

function box(ctx: Ctx, cls: string, x: number, y: number, w: number, h: number, html = "", tag: "div" | "button" = "div"): HTMLElement {
  const node = document.createElement(tag);
  node.className = `hub-pw ${cls}`;
  if (tag === "button") (node as HTMLButtonElement).type = "button";
  node.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
  node.innerHTML = html;
  ctx.stage.append(node);
  return node;
}

function applyHubTheme(panel: HTMLElement, project: Project): void {
  const theme = project.system.menuTheme;
  if (theme?.window && CSS_COLOR.test(theme.window)) panel.style.setProperty("--hub-win", theme.window);
  if (theme?.accent && CSS_COLOR.test(theme.accent)) panel.style.setProperty("--hub-accent", theme.accent);
}
const CSS_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\))$/i;

function hubTitleArt(project: Project): string | null {
  const id = project.system.titleScreen?.backgroundResourceId ?? project.system.titleResourceId;
  return url(project, id);
}


function faceHtml(project: Project, row: PlayerStatusMenuPartyRow, size: number): string {
  const src = url(project, row.faceResourceId);
  if (!src) return `<span class="hub-face missing" style="width:${size}px;height:${size}px">${esc(row.name.slice(0, 1))}</span>`;
  return `<span class="hub-face" role="img" aria-label="${esc(row.name)}" style="width:${size}px;height:${size}px;background-image:${esc(cssUrl(src))};background-size:${size}px ${size}px"></span>`;
}

function iconHtml(project: Project, resourceId: string | undefined, size: 16 | 32, alt = ""): string {
  const src = url(project, resourceId);
  return src
    ? `<img class="hub-ic${size}" src="${esc(src)}" alt="${esc(alt)}" draggable="false">`
    : `<span class="hub-ic${size} empty"></span>`;
}

function barHtml(color: string, value: number, max: number, preview?: number): string {
  const pct = (v: number) => `${max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0}%`;
  return `<div class="hub-bar" style="--c:${color}">${preview !== undefined && preview > value ? `<b style="width:${pct(preview)}"></b>` : ""}<i style="width:${pct(value)}"></i></div>`;
}

function vitHtml(label: string, color: string, value: number, max: number, preview?: number): string {
  const shown = preview !== undefined && preview > value ? `<span class="gain">${preview}</span>` : String(value);
  return `<div class="hub-vit sm"><div class="r"><span class="dim">${esc(label)}</span><span>${shown}<span class="faint">/${max}</span></span></div>${barHtml(color, value, max, preview)}</div>`;
}

function vitals(session: PlaySession, actorId: string): { hp: number; maxHp: number; mp: number; maxMp: number } {
  const v = session.actorVitals[actorId];
  return { hp: v?.hp ?? 0, maxHp: v?.maxHp ?? 0, mp: v?.mp ?? 0, maxMp: v?.maxMp ?? 0 };
}

function walker(ctx: Ctx, actorId: string, name: string, scale: 1 | 2): string {
  const id = `hub-walker-${actorId}-${Math.random().toString(36).slice(2, 8)}`;
  queueMicrotask(() => {
    const slot = ctx.stage.querySelector<HTMLElement>(`[data-walker="${id}"]`);
    const node = partyWalker(ctx.options.project, ctx.options.session, actorId, name, { className: "hub-walker" });
    if (slot && node) { slot.append(node); slot.style.setProperty("--walk-scale", String(scale)); }
  });
  return `<span class="hub-walker-slot" data-walker="${id}"></span>`;
}

const STAT_ROWS = [["attack", "공격"], ["defense", "방어"], ["mind", "정신"], ["agility", "민첩"]] as const;

function actorStats(project: Project, session: PlaySession, actor: ActorRecord, equipped: boolean): Record<(typeof STAT_ROWS)[number][0], number> {
  const level = session.actorLevels[actor.id] ?? actor.initialLevel;
  const classId = effectiveActorClassId(project, session, actor.id);
  const worn = equipped ? effectiveActorEquipment(project, actor, session.actorEquipment[actor.id], classId) : ({} as ActorInitialEquipment);
  const stats = actorDerivedStats(project, normalizeActorRecord(actor), {
    level, classOverrides: session.classOverrides, promotionLineage: session.promotionLineage,
    growthProgress: session.growthProgress, paramBonuses: session.actorParamBonuses?.[actor.id], equipment: worn,
  });
  return { attack: stats.attack, defense: stats.defense, mind: stats.mind, agility: stats.agility };
}

function actorRecord(project: Project, actorId: string): ActorRecord | undefined {
  return project.database.actors.find((actor) => actor.id === actorId);
}

function wornEquipment(project: Project, session: PlaySession, actor: ActorRecord): ActorInitialEquipment {
  return effectiveActorEquipment(project, actor, session.actorEquipment[actor.id], effectiveActorClassId(project, session, actor.id));
}

function detail(options: HubMenuOptions, command: StatusMenuRailId, overrides: Partial<Parameters<typeof createStatusMenuDetail>[0]> = {}): StatusMenuDetail {
  return createStatusMenuDetail({ ...statusMenuDetailOptions(options, command), ...overrides });
}

function bind(node: HTMLElement | null, run: (() => void) | undefined): void {
  if (node && run) HANDLERS.set(node, run);
}


function drawHead(ctx: Ctx, title: string, actorKeys: boolean): void {
  const { board } = ctx;
  box(ctx, "hub-head", M, M, board.w - 2 * M, 18,
    `<button type="button" class="ttl" data-hub-k="back" data-hub-back="true" data-testid="hub-back">‹ ${esc(title)}</button>`
    + `<span class="sm faint hub-head-hint">Esc 돌아가기</span>`
    + (actorKeys && ctx.options.session.partyActorIds.length > 1 ? `<span class="kb">Q</span><span class="kb">E</span><span class="sm faint">동료</span>` : ""));
}

type WhoRow = { readonly html?: string; readonly cls?: string; readonly run?: () => void; readonly reason?: string; readonly testId?: string };

function drawWho(ctx: Ctx, x: number, y: number, w: number, h: number, current: string | undefined, rows: (row: PlayerStatusMenuPartyRow, index: number) => WhoRow, horizontal: boolean): void {
  const { project, session } = ctx.options;
  const node = box(ctx, `hub-who${horizontal ? " row" : ""}`, x, y, w, h);
  ctx.snapshot.partyRows.forEach((row, index) => {
    const extra = rows(row, index);
    const v = vitals(session, row.actorId);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `hub-who-row ${extra.cls ?? ""}${row.actorId === current ? " cur" : ""}`;
    button.dataset.hubK = `a${index}`;
    button.dataset.testid = extra.testId ?? `hub-actor-${row.actorId}`;
    if (extra.reason) button.dataset.unavailableReason = extra.reason;
    if (ctx.page === "status" && row.actorId === current) button.dataset.hubDefault = "true";
    button.innerHTML = extra.html ?? `${horizontal ? "" : faceHtml(project, row, 24)}<div class="v sm"><div class="nmr"><span>${esc(row.name)}</span><span class="${row.stateNames.length ? "st" : "dim"}">${esc(row.stateNames[0] ?? "")}</span></div>${vitHtml("HP", "var(--hub-hp)", v.hp, v.maxHp)}${vitHtml(resolveTerms(project).mp || "MP", "var(--hub-mp)", v.mp, v.maxMp)}</div>`;
    bind(button, extra.run);
    node.append(button);
  });
}


function drawHub(ctx: Ctx): void {
  const { options, snapshot, board } = ctx;
  const { project, session } = options;
  const W = board.w, H = board.h, tall = board.tall;
  const commands = listStatusMenuCommandIds(project, session);
  const tiles = HUB_TILE_COMMANDS.filter((command) => commands.includes(command));
  const others = commands.filter((command) => !isHubTileCommand(command));
  const party = snapshot.partyRows.slice(0, 4);
  const n = Math.max(1, party.length);
  const sysH = tall ? 44 : 54;
  let cx: number, cy: number, cw: number, ch: number, tx: number, ty: number, tw: number, th: number, sx: number, sy: number, sw: number, sh: number;
  if (!tall) {
    // 동료가 적으면 카드를 넓히지 않고(혼자면 판 절반이 빈다) 그 자리를 오른쪽 칸에 준다.
    const cardsW = Math.min(Math.round((W - 2 * M) * (n >= 4 ? 0.56 : 0.48)), n * 150);
    cw = Math.floor((cardsW - (n - 1) * G) / n); ch = H - 2 * M; cx = M; cy = M;
    tx = M + n * cw + n * G; tw = Math.floor((W - M - tx - G) / 2);
    th = Math.floor((H - 2 * M - sysH - 2 * G) / 2); ty = M;
    sx = tx; sy = M + 2 * th + 2 * G; sw = W - M - tx; sh = H - M - sy;
  } else {
    cw = Math.floor((W - 2 * M - (n - 1) * G) / n); ch = H >= 330 ? 118 : 92; cx = M; cy = M;
    tx = M; ty = M + ch + G; tw = Math.floor((W - 2 * M - G) / 2);
    th = Math.floor((H - 2 * M - ch - G - sysH - 2 * G) / 2);
    sx = M; sy = ty + 2 * th + 2 * G; sw = W - 2 * M; sh = H - M - sy;
  }
  const big = !tall;
  const mpTerm = resolveTerms(project).mp || "MP";
  party.forEach((row, index) => {
    const actor = actorRecord(project, row.actorId);
    const v = vitals(session, row.actorId);
    const stats = actor ? actorStats(project, session, actor, true) : undefined;
    const worn = actor ? wornEquipment(project, session, actor) : undefined;
    const weapon = worn?.weapon ? project.database.equipment.find((e) => e.id === worn.weapon) : undefined;
    const html = `${faceHtml(project, row, big ? 48 : 32)}`
      + `<div class="nm"><span class="ttl">${esc(row.name)}</span><span class="sm dim">Lv${row.level}</span></div>`
      + `<div class="sm dim nw">${esc(row.className)}</div>`
      + (big ? `<div class="sm">${row.stateNames.length ? `<span class="chip bad">${esc(row.stateNames[0]!)}</span>` : `<span class="faint">상태 정상</span>`}</div>` : "")
      + vitHtml("HP", "var(--hub-hp)", v.hp, v.maxHp) + vitHtml(mpTerm, "var(--hub-mp)", v.mp, v.maxMp)
      + (big && stats ? `<div class="mini sm">${STAT_ROWS.map(([k, l]) => `<span><span class="dim">${l[0]}</span>${stats[k]}</span>`).join("")}</div>`
        + `<div class="wp sm">${iconHtml(project, weapon?.iconResourceId ?? weapon?.imageResourceId, 16)}<span>${esc(weapon?.name ?? "맨손")}</span></div>`
        + `<div class="walk">${walker(ctx, row.actorId, row.name, 2)}</div>` : "");
    const card = box(ctx, "hub-card", cx + index * (cw + G), cy, cw, ch, html, "button");
    card.dataset.hubK = `c${index}`;
    card.dataset.testid = `hub-card-${row.actorId}`;
    if (commands.includes("status")) { card.dataset.hubGo = "status"; card.dataset.hubActor = row.actorId; }
  });

  tiles.forEach((command, index) => {
    const html = `<div class="t ttl"><span class="hand"></span>${esc(statusMenuCommandLabel(command, options.waitModeEnabled ?? true, project))}<span class="sm faint k">${index + 1}</span></div>${tileSummary(ctx, command)}`;
    const tile = box(ctx, "hub-tile", tx + (index % 2) * (tw + G), ty + Math.floor(index / 2) * (th + G), tw, th, html, "button");
    tile.dataset.hubK = `t${index}`;
    tile.dataset.hubGo = command;
    tile.dataset.testid = `hub-tile-${command}`;
    if (index === 0) tile.dataset.hubDefault = "true";
  });

  const info = `<div class="info">${snapshot.showGold ?? true ? `<span class="acc" data-testid="status-menu-gold">${esc(snapshot.goldLabel)}</span>` : ""}<span class="dim nw">${esc(project.maps[session.currentMapId]?.name ?? "")}</span>${snapshot.chapterLabel ? `<span class="dim nw">${esc(snapshot.chapterLabel)}</span>` : ""}<span class="dim tm" data-testid="status-menu-time">${esc(snapshot.timeLabel)}</span></div>`;
  const sys = box(ctx, "hub-sys sm", sx, sy, sw, sh, info);
  const btns = document.createElement("div");
  btns.className = "btns";
  others.forEach((command, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.hubK = `s${index}`;
    button.dataset.hubGo = command;
    button.dataset.testid = `hub-sys-${command}`;
    button.textContent = statusMenuCommandLabel(command, options.waitModeEnabled ?? true, project);
    if (command === "to-title") button.classList.add("destructive");
    btns.append(button);
  });
  sys.append(btns);
}

function tileSummary(ctx: Ctx, command: HubTileCommand): string {
  const { project, session } = ctx.options;
  if (command === "items") {
    const owned = project.database.items.filter((item) => (session.inventory[item.id] ?? 0) > 0);
    const usable = owned.filter((item) => item.occasion !== "battle" && item.occasion !== "never" && (item.hpRecovery.flat > 0 || item.hpRecovery.percentMax > 0 || item.mpRecovery.flat > 0 || item.mpRecovery.percentMax > 0 || item.healStateIds.length > 0));
    const peek = (usable.length ? usable : owned).slice(0, 5);
    const line = (usable.length ? usable : owned).slice(0, 2).map((item) => `${esc(item.name)} ${session.inventory[item.id] ?? 0}`).join(" · ");
    const bag = owned.length + project.database.equipment.filter((e) => (session.inventory[e.id] ?? 0) > 0).length;
    return `<div class="peek">${peek.map((item) => iconHtml(project, item.iconResourceId ?? item.imageResourceId, 16, item.name)).join("")}</div>${line ? `<div class="sm nw">${line}</div>` : ""}<div class="sm faint nw">가방 ${bag}종</div>`;
  }
  if (command === "skills") {
    const rows = ctx.snapshot.partyRows.flatMap((row) => {
      const ids = new Set(session.actorSkillIds[row.actorId] ?? []);
      return project.database.skills.filter((skill) => ids.has(skill.id) && skill.fieldCommonEventId).map((skill) => ({ row, skill }));
    });
    if (rows.length === 0) {
      const lead = ctx.snapshot.partyRows[0];
      const count = lead ? (session.actorSkillIds[lead.actorId] ?? []).length : 0;
      return `<div class="sm nw">${lead ? `${esc(lead.name)} 기술 ${count}개` : ""}</div><div class="sm faint nw">필드에서 쓸 기술 없음</div>`;
    }
    return rows.slice(0, 2).map(({ row, skill }) => `<div class="sm nw">${esc(skill.name)} <span class="dim">${esc(row.name)}</span></div>`).join("") + `<div class="sm faint nw">필드에서 쓰는 기술</div>`;
  }
  if (command === "equipment") {
    for (const row of ctx.snapshot.partyRows) {
      const actor = actorRecord(project, row.actorId);
      if (!actor) continue;
      const plan = bestEquipmentPlan({ project, session }, actor);
      const change = plan?.changes[0];
      if (plan && change && plan.gain > 0) {
        const equipment = project.database.equipment.find((e) => e.name === change.toName);
        return `<div class="sm nw hub-tile-line">${iconHtml(project, equipment?.iconResourceId ?? equipment?.imageResourceId, 16)}${esc(change.toName)}</div><div class="sm gain nw">${esc(row.name)} 합계 ▲${plan.gain}</div><div class="sm faint nw">가방 장비 ${project.database.equipment.filter((e) => (session.inventory[e.id] ?? 0) > 0).length}개</div>`;
      }
    }
    return `<div class="sm faint">더 좋은 장비 없음</div>`;
  }
  return ctx.snapshot.partyRows.slice(0, 4).map((row) => `<div class="sm nw hub-tile-state"><span>${esc(row.name)}</span><span class="${row.stateNames.length ? "st" : "dim"}">${esc(row.stateNames[0] ?? "정상")}</span></div>`).join("");
}


const FILTER_LABEL: Record<InventoryView["filter"], string> = { all: "전체", key: "중요", usable: "사용", equipment: "장비", other: "기타" };

function itemIdOf(entry: StatusMenuDetailEntry): string {
  return entry.testId?.replace(/^status-menu-(?:owned-equipment-|item-)/, "") ?? "";
}

/** 목록 칸 — 아이템·가방 장비만(분류·정렬 줄, 「장착 중」 요약은 뺀다: 요약이 목록 세 줄을 먹었다, 아이템창 문제 4). */
function itemEntries(d: StatusMenuDetail): StatusMenuDetailEntry[] {
  return d.entries.filter((entry) => /^status-menu-(item-|owned-equipment-)/.test(entry.testId ?? "") && entry.testId !== "status-menu-owned-equipment-worn");
}

function drawItems(ctx: Ctx): void {
  const { options, board } = ctx;
  const { project, session } = options;
  const view = options.inventoryView ?? DEFAULT_INVENTORY_VIEW;
  const list = itemEntries(detail(options, "items", { targetItemId: undefined, itemActionId: undefined }));
  const sel = Math.max(0, Math.min(options.hubSel, list.length - 1));
  const selected = options.targetItemId ? list.find((entry) => itemIdOf(entry) === options.targetItemId) ?? list[sel] : list[sel];
  const targets = options.targetItemId ? detail(options, "items").entries : undefined;
  drawHead(ctx, "아이템", false);
  const y0 = M + 22, hh = board.h - y0 - M;
  const filters: InventoryView["filter"][] = holdsKeyItems(project, session.inventory) ? ["all", "key", "usable", "equipment", "other"] : ["all", "usable", "equipment", "other"];
  const seg = `<div class="seg sm">${filters.map((filter, i) => `<button type="button" data-hub-k="g${i}" data-hub-filter="${filter}" aria-pressed="${view.filter === filter}">${FILTER_LABEL[filter]}</button>`).join("")}</div>`;
  const grid = `<div class="grid">${list.length === 0 ? `<span class="sm faint hub-empty">${options.inventoryView?.filter && options.inventoryView.filter !== "all" ? "이 분류에는 없습니다" : "아이템이 없습니다"}</span>` : list.map((entry, i) => {
    const off = Boolean(entry.unavailableReason) || !entry.onActivate;
    return `<button type="button" class="cell${off ? " off" : ""}${entry === selected ? " cur" : ""}" data-hub-k="i${i}" data-hub-preview="true" data-testid="hub-item-${esc(itemIdOf(entry))}"${i === sel ? ' data-hub-default="true"' : ""}>${iconHtml(project, entry.icon?.resourceId, 32, entry.label)}<span class="q">${esc(entry.value.replace(/개$/, ""))}</span></button>`;
  }).join("")}</div>`;
  const lw = 124;
  let gridBox: HTMLElement, detailBox: HTMLElement;
  if (board.tall) {
    const gh = targets ? Math.min(110, Math.floor(hh * 0.32)) : Math.min(130, Math.floor(hh * 0.4));
    gridBox = box(ctx, "hub-items-grid", M, y0, board.w - 2 * M, gh, seg + grid);
    const whoH = targets ? 50 : 0;
    detailBox = box(ctx, "hub-detail", M, y0 + gh + 4, board.w - 2 * M, hh - gh - 4 - (whoH ? whoH + 4 : 0));
    if (targets) drawTargetWho(ctx, targets, M, board.h - M - whoH, board.w - 2 * M, whoH, true);
  } else {
    const rx = M + lw + 4;
    const gw = Math.max(150, Math.min(184, Math.floor((board.w - rx - M) * 0.5)));
    if (targets) drawTargetWho(ctx, targets, M, y0, lw, hh, false);
    else drawWho(ctx, M, y0, lw, hh, undefined, () => ({}), false);
    gridBox = box(ctx, "hub-items-grid", rx, y0, gw, hh, seg + grid);
    detailBox = box(ctx, "hub-detail", rx + gw + 4, y0, board.w - M - rx - gw - 4, hh);
  }
  void gridBox;
  ctx.stage.querySelectorAll<HTMLElement>("[data-hub-filter]").forEach((button) => {
    bind(button, () => options.actions.onInventoryViewChange?.({ ...view, filter: button.dataset.hubFilter as InventoryView["filter"] }));
  });
  // 칸 실행 = 그 항목의 동작(대상 고르기·바로 사용) — 못 쓰는 칸은 사유를 보인다.
  list.forEach((entry, i) => {
    const cell = ctx.stage.querySelector<HTMLElement>(`[data-hub-k="i${i}"]`);
    if (!cell) return;
    if (entry.unavailableReason) cell.dataset.unavailableReason = entry.unavailableReason;
    else if (!entry.onActivate) cell.dataset.unavailableReason = "쓰는 물건이 아닙니다";
    bind(cell, entry.onActivate);
  });
  detailBox.innerHTML = selected ? itemDetailHtml(ctx, selected, Boolean(targets)) : `<span class="faint sm">비어 있음</span>`;
}

function drawTargetWho(ctx: Ctx, targets: readonly StatusMenuDetailEntry[], x: number, y: number, w: number, h: number, horizontal: boolean): void {
  const { project } = ctx.options;
  const byActor = new Map(targets.map((entry) => [entry.testId?.replace(/^status-menu-item-target-/, "") ?? "", entry]));
  drawWho(ctx, x, y, w, h, undefined, (row) => {
    const entry = byActor.get(row.actorId);
    if (!entry) return { cls: "no", reason: "이 대상은 사용할 수 없습니다" };
    const v = entry.vitals;
    const useful = !entry.disabled && !entry.unavailableReason;
    const html = v
      ? `${horizontal ? "" : faceHtml(project, row, 24)}<div class="v sm"><div class="nmr"><span>${esc(row.name)}</span><span class="${row.stateNames.length ? "st" : "dim"}">${esc(v.curedStateNames?.length ? `${v.curedStateNames.join("·")} →정상` : row.stateNames[0] ?? "")}</span></div>${vitHtml("HP", "var(--hub-hp)", v.hp, v.maxHp, useful ? v.hpAfter : undefined)}${vitHtml(resolveTerms(project).mp || "MP", "var(--hub-mp)", v.mp, v.maxMp, useful ? v.mpAfter : undefined)}</div>`
      : undefined;
    return { cls: useful ? "ok" : "no", run: entry.onActivate, reason: useful ? undefined : entry.unavailableReason ?? "효과가 없습니다", testId: entry.testId, ...(html ? { html } : {}) };
  }, horizontal);
}

const ELIGIBILITY: Record<string, string> = { usable: "언제나", battle: "전투 중", unusable: "쓰지 않는 물건", restricted: "일부 동료만" };
const SCOPE: Record<string, string> = { none: "없음", ally: "아군 1명", allAllies: "아군 전체", enemy: "적 1명", allEnemies: "적 전체", partyMonster: "파티 몬스터" };

function itemDetailHtml(ctx: Ctx, entry: StatusMenuDetailEntry, targeting: boolean): string {
  const { project, session } = ctx.options;
  const id = itemIdOf(entry);
  const item = project.database.items.find((record) => record.id === id);
  const equipment = item ? undefined : project.database.equipment.find((record) => record.id === id);
  const price = item?.price ?? equipment?.price ?? 0;
  const kind = equipment ? "장비" : item?.occasion === "battle" ? "전투용" : entry.facts?.some((fact) => fact.id === "eligibility" && fact.value === "unusable") ? "재료·물건" : "쓰는 물건";
  // 효과 칩 — 실제 효과(회복량·치료·능력 상승). 연결된 스킬 이름을 내보이지 않는다(아이템창 문제 3).
  const effects = item ? itemEffectSummary(project, item) : undefined;
  const eligibility = entry.facts?.find((fact) => fact.id === "eligibility");
  const description = (entry.description ?? "").replace(/\n/g, " ");
  const reason = entry.unavailableReason;
  const go = targeting
    ? `<span class="hand"></span>누구에게? 초록 테두리 = 효과 있음`
    : reason ? `<span class="faint">${esc(reason)}</span>` : entry.onActivate ? `<span class="hand"></span>Enter 사용` : `<span class="faint">쓰는 물건이 아닙니다</span>`;
  void session;
  return `<div class="dh">${iconHtml(project, entry.icon?.resourceId, 32, entry.label)}<div><div class="ttl" data-testid="hub-item-name">${esc(entry.label)}</div><div class="sm dim">${esc(kind)} · ${esc(entry.value)}${price ? ` · ${price}${esc(resolveTerms(project).gold)}` : ""}</div></div></div>`
    + `<p class="sm wrap" data-testid="hub-item-description">${esc(description)}</p>`
    + (effects ? `<div class="chips sm">${effects.split(" · ").map((part) => `<span>${esc(part)}</span>`).join("")}</div>` : "")
    + (eligibility ? `<dl class="facts sm"><dt>쓰는 곳</dt><dd>${esc(ELIGIBILITY[eligibility.value] ?? eligibility.value)}</dd>${eligibility.targeting ? `<dt>대상</dt><dd>${esc(SCOPE[eligibility.targeting.scope] ?? eligibility.targeting.scope)}${eligibility.targeting.deadOnly ? " · 쓰러진 동료" : ""}</dd>` : ""}</dl>` : "")
    + `<div class="go sm">${go}</div>`;
}


function cycleActorWho(ctx: Ctx, x: number, y: number, w: number, h: number, current: string | undefined, horizontal: boolean, extra?: (row: PlayerStatusMenuPartyRow) => WhoRow): void {
  const page = ctx.page === "skills" ? "skills" : ctx.page === "equipment" ? "equipment" : "status";
  drawWho(ctx, x, y, w, h, current, (row) => ({ run: () => ctx.options.hubActions.openPage(page, row.actorId), ...(extra?.(row) ?? {}) }), horizontal);
}

function drawSkills(ctx: Ctx): void {
  const { options, board } = ctx;
  const { project } = options;
  const actorId = options.skillActorId!;
  const d = detail(options, "skills");
  const list = d.entries.filter((entry) => entry.onActivate || entry.label);
  const sel = Math.max(0, Math.min(options.hubSel, list.length - 1));
  const s = list[sel];
  drawHead(ctx, "스킬", true);
  const y0 = M + 22, hh = board.h - y0 - M;
  const skillOf = (entry: StatusMenuDetailEntry) => project.database.skills.find((skill) => entry.testId === `status-menu-skill-${actorId}-${skill.id}`);
  const grid = `<div class="skgrid">${list.length === 0 ? `<span class="sm faint hub-empty">${esc(d.emptyLabel ?? "기술이 없습니다")}</span>` : list.map((entry, i) => {
    const field = Boolean(skillOf(entry)?.fieldCommonEventId);
    const cost = entry.value.split(" · ")[0] ?? entry.value;
    return `<button type="button" class="sk sm${field ? "" : " off"}${i === sel ? " cur" : ""}" data-hub-k="k${i}" data-hub-preview="true" data-testid="hub-skill-${esc(entry.testId ?? String(i))}"${i === sel ? ' data-hub-default="true"' : ""}><span class="nw">${esc(entry.label)}</span><span class="dim nw">${esc(cost.replace(/^[^\d]*\s/, ""))}</span></button>`;
  }).join("")}</div>`;
  const field = s ? Boolean(skillOf(s)?.fieldCommonEventId) : false;
  const det = s
    ? `<div class="ttl">${esc(s.label)}</div><div class="sm dim">${esc(s.value)}</div><p class="sm wrap">${esc((s.description ?? "").replace(/\n/g, " "))}</p><div class="go sm">${s.unavailableReason ? `<span class="faint">${esc(s.unavailableReason)}</span>` : field ? `<span class="hand"></span>Enter 필드에서 사용` : `<span class="faint">전투에서 씁니다</span>`}</div>`
    : `<span class="faint sm">${esc(d.emptyLabel ?? "기술이 없습니다")}</span>`;
  const lw = 124;
  if (board.tall) {
    cycleActorWho(ctx, M, y0, board.w - 2 * M, 48, actorId, true);
    const gh = Math.floor((hh - 52) * 0.6);
    box(ctx, "hub-skills-grid", M, y0 + 52, board.w - 2 * M, gh, grid);
    box(ctx, "hub-detail", M, y0 + 56 + gh, board.w - 2 * M, hh - 56 - gh, det);
  } else {
    const rx = M + lw + 4;
    const gw = Math.min(200, Math.floor((board.w - rx - M) * 0.58));
    cycleActorWho(ctx, M, y0, lw, hh, actorId, false);
    box(ctx, "hub-skills-grid", rx, y0, gw, hh, grid);
    box(ctx, "hub-detail", rx + gw + 4, y0, board.w - M - rx - gw - 4, hh, det);
  }
  list.forEach((entry, i) => {
    const cell = ctx.stage.querySelector<HTMLElement>(`[data-hub-k="k${i}"]`);
    if (!cell) return;
    if (entry.unavailableReason) cell.dataset.unavailableReason = entry.unavailableReason;
    bind(cell, entry.onActivate);
  });
}


function drawEquipment(ctx: Ctx): void {
  const { options, board } = ctx;
  const { project, session } = options;
  const actorId = options.equipmentActorId!;
  const actor = actorRecord(project, actorId);
  drawHead(ctx, "장비", true);
  if (!actor) return;
  const slotsDetail = detail(options, "equipment", { equipmentSlotId: undefined });
  const slots = equipmentSlots(project);
  const slotEntries = slots.map((slot) => slotsDetail.entries.find((entry) => entry.testId === `status-menu-equipment-slot-${slot.id}`));
  const optimize = slotsDetail.entries.find((entry) => entry.testId === "status-menu-equipment-optimize");
  const slotId = options.equipmentSlotId ?? (slots[0]?.id as keyof ActorInitialEquipment | undefined);
  const cands = slotId ? detail(options, "equipment", { equipmentSlotId: slotId }).entries.filter((entry) => entry.onActivate) : [];
  const cand = options.hubCand >= 0 ? cands[options.hubCand] : undefined;
  const slotIndex = Math.max(0, slots.findIndex((slot) => slot.id === slotId));
  const slotEntry = slotEntries[slotIndex];
  const worn = wornEquipment(project, session, actor);
  const currentEq = slotId ? project.database.equipment.find((e) => e.id === worn[slotId]) : undefined;
  const candEq = cand ? project.database.equipment.find((e) => cand.testId === `status-menu-equipment-item-${e.id}`) : undefined;
  const who = candEq ? new Set(session.partyActorIds.filter((id) => { const a = actorRecord(project, id); return a ? canEquip(project, a, candEq, effectiveActorClassId(project, session, id)) : false; })) : undefined;

  const y0 = M + 22, hh = board.h - y0 - M;
  const lw = 124;
  const tall = board.tall;
  const dollW = tall ? board.w - 2 * M : Math.min(224, board.w - M - (M + lw + 4) - 120);
  // 슬롯 두 줄기(왼쪽·오른쪽) 사이 또는 마지막 빈칸에 걷기 그림(2배 48×64)을 세운다.
  const slotW = tall ? 104 : Math.floor((dollW - 8) / 2) - 2;
  const pos = (i: number): [number, number] => [i % 2 === 0 ? 4 : dollW - 4 - slotW, 4 + Math.floor(i / 2) * 34];
  const slotHtml = slots.map((slot, i) => {
    const eq = project.database.equipment.find((e) => e.id === worn[slot.id as keyof ActorInitialEquipment]);
    const [x, y] = pos(i);
    return `<button type="button" class="slot sm${eq ? "" : " empty"}${i === slotIndex ? " cur" : ""}" data-hub-k="q${i}" data-hub-preview="true" data-testid="hub-slot-${esc(slot.id)}" style="left:${x}px;top:${y}px;width:${slotW}px"${i === slotIndex && options.hubCand < 0 ? ' data-hub-default="true"' : ""}>${eq ? iconHtml(project, eq.iconResourceId ?? eq.imageResourceId, 16) : '<span class="hub-ic16 empty"></span>'}<span class="slot-t"><span class="l">${esc(slot.label)}</span><span class="n">${esc(eq?.name ?? "비어 있음")}</span></span></button>`
;
  }).join("");
  const rowsUsed = Math.ceil(slots.length / 2);
  const odd = slots.length % 2 === 1;
  const walkTop = tall ? 6 : odd ? 4 + (rowsUsed - 1) * 34 - 2 : 4 + rowsUsed * 34;
  const walkLeft = tall || !odd ? Math.floor(dollW / 2) - 24 : dollW - 4 - Math.floor(slotW / 2) - 24;
  const candTop = tall ? 4 + rowsUsed * 34 + 2 : walkTop + 70;
  const candHtml = `<div class="sm dim cand-h" style="top:${candTop}px">${esc(slots[slotIndex]?.label ?? "")} 바꾸기 · 가방에서</div><div class="cands sm" style="top:${candTop + 14}px;width:${dollW - 8}px">${cands.length ? cands.map((entry, j) => {
    const unequip = entry.testId === "status-menu-equipment-item-none";
    const eq = unequip ? undefined : project.database.equipment.find((e) => entry.testId === `status-menu-equipment-item-${e.id}`);
    return `<button type="button" class="cand${j === options.hubCand ? " cur" : ""}" data-hub-k="n${j}" data-hub-preview="true" data-testid="hub-cand-${esc(entry.testId ?? String(j))}">${unequip ? "벗기" : `${iconHtml(project, eq?.iconResourceId ?? eq?.imageResourceId, 16)}${esc(entry.label)}`}</button>`;
  }).join("") : '<span class="faint">맞는 장비 없음</span>'}</div>`
    + (optimize && optimize.attributes?.equipmentGain && optimize.attributes.equipmentGain !== "0" ? `<button type="button" class="cand best" data-hub-k="o0" data-testid="hub-optimize" style="position:absolute;right:4px;top:${candTop - 2}px">최강 장비 ▲${esc(optimize.attributes.equipmentGain)}</button>` : "");
  const doll = `<div class="walk" style="position:absolute;left:${walkLeft}px;top:${walkTop}px">${walker(ctx, actorId, actor.name, 2)}</div>${slotHtml}${candHtml}`;

  const deltas = cand?.statDelta ?? slotEntry?.statDelta ?? [];
  const show = candEq ?? (cand ? undefined : currentEq);
  const compare = `<div class="cmpb sm">${deltas.map((row) => {
    const d = row.next - row.current;
    return `<span class="dim">${esc(row.label)}</span>${barHtml(d > 0 ? "var(--hub-gain)" : d < 0 ? "var(--hub-loss)" : "var(--hub-accent)", row.next, Math.max(100, row.next, row.current))}<span>${d ? `${row.current}→<span class="${d > 0 ? "gain" : "loss"}">${row.next}</span>` : row.current}</span>`;
  }).join("")}</div>`;
  const title = cand ? (cand.testId === "status-menu-equipment-item-none" ? "벗기" : cand.label) : show?.name ?? slots[slotIndex]?.label ?? "";
  const sub = cand ? `${currentEq?.name ?? "없음"} → ${candEq?.name ?? "없음"}` : "지금 장비";
  const det = `<div class="dh">${iconHtml(project, show?.iconResourceId ?? show?.imageResourceId, 32)}<div><div class="ttl">${esc(title)}</div><div class="sm dim">${esc(sub)}</div></div></div>${compare}${show?.description ? `<p class="sm wrap clamp" style="--clamp:${tall ? 3 : 6}">${esc(show.description.replace(/\n/g, " "))}</p>` : ""}${cand ? '<div class="go sm"><span class="hand"></span>Enter 장착</div>' : ""}`;

  if (tall) {
    cycleActorWho(ctx, M, y0, board.w - 2 * M, 48, actorId, true, (row) => (who && !who.has(row.actorId) ? { cls: "no" } : {}));
    const dh = Math.min(150, Math.floor((hh - 52) * 0.5));
    box(ctx, "hub-doll", M, y0 + 52, board.w - 2 * M, dh, doll);
    box(ctx, "hub-detail", M, y0 + 56 + dh, board.w - 2 * M, hh - 56 - dh, det);
  } else {
    const rx = M + lw + 4;
    cycleActorWho(ctx, M, y0, lw, hh, actorId, false, (row) => (who && !who.has(row.actorId) ? { cls: "no" } : {}));
    box(ctx, "hub-doll", rx, y0, dollW, hh, doll);
    box(ctx, "hub-detail", rx + dollW + 4, y0, board.w - M - rx - dollW - 4, hh, det);
  }
  slots.forEach((slot, i) => {
    const node = ctx.stage.querySelector<HTMLElement>(`[data-hub-k="q${i}"]`);
    // 슬롯 실행 = 그 부위 후보 첫 칸으로 커서를 옮긴다.
    bind(node, () => options.hubActions.focus(cands.length && i === slotIndex ? "n0" : `q${i}`));
    void slot;
  });
  cands.forEach((entry, j) => bind(ctx.stage.querySelector<HTMLElement>(`[data-hub-k="n${j}"]`), entry.onActivate));
  bind(ctx.stage.querySelector<HTMLElement>(`[data-hub-k="o0"]`), optimize?.onActivate);
}


function drawStatus(ctx: Ctx): void {
  const { options, board, snapshot } = ctx;
  const { project, session } = options;
  const actorId = options.hubActorId ?? snapshot.partyRows[0]?.actorId;
  const row = snapshot.partyRows.find((entry) => entry.actorId === actorId) ?? snapshot.partyRows[0];
  drawHead(ctx, "상태", true);
  if (!row) return;
  const actor = actorRecord(project, row.actorId);
  const v = vitals(session, row.actorId);
  const stats = actor ? actorStats(project, session, actor, true) : undefined;
  const base = actor ? actorStats(project, session, actor, false) : undefined;
  const worn = actor ? wornEquipment(project, session, actor) : undefined;
  const mpTerm = resolveTerms(project).mp || "MP";
  const next = row.nextLevel ? `<div class="dim">다음 레벨까지 ${row.nextLevel.remaining}</div>` : "";
  const main = `<div class="st-top">${faceHtml(project, row, 48)}<div class="sm st-col"><div class="ttl">${esc(row.name)} <span class="dim sm">${esc(row.className)} · Lv ${row.level}</span></div>${actor?.nickname ? `<div class="dim">${esc(actor.nickname)}</div>` : ""}${vitHtml("HP", "var(--hub-hp)", v.hp, v.maxHp)}${vitHtml(mpTerm, "var(--hub-mp)", v.mp, v.maxMp)}<div>상태 ${row.stateNames.length ? `<span class="chip bad">${esc(row.stateNames.join(" "))}</span>` : "정상"}</div>${next}</div></div>`
    + (stats && base ? `<div class="cmpb sm st-stats">${STAT_ROWS.map(([k, l]) => `<span class="dim">${l}</span>${barHtml("var(--hub-accent)", stats[k], Math.max(100, stats[k]))}<span>${stats[k]} <span class="faint">(${base[k]}+${stats[k] - base[k]})</span></span>`).join("")}</div>` : "")
    + `<div class="sm dim st-h">장비</div><div class="st-eq">${equipmentSlots(project).map((slot) => {
      const eq = worn ? project.database.equipment.find((e) => e.id === worn[slot.id as keyof ActorInitialEquipment]) : undefined;
      return `<div class="sm nw">${eq ? iconHtml(project, eq.iconResourceId ?? eq.imageResourceId, 16) : '<span class="hub-ic16 empty"></span>'}<span class="dim">${esc(slot.label)}</span> <span class="${eq ? "" : "faint"}">${esc(eq?.name ?? "비어 있음")}</span></div>`;
    }).join("")}</div>`;
  const y0 = M + 22, hh = board.h - y0 - M;
  if (board.tall) {
    cycleActorWho(ctx, M, y0, board.w - 2 * M, 48, row.actorId, true);
    box(ctx, "hub-status", M, y0 + 52, board.w - 2 * M, hh - 52, main);
  } else {
    const lw = 124, rx = M + lw + 4;
    cycleActorWho(ctx, M, y0, lw, hh, row.actorId, false);
    box(ctx, "hub-status", rx, y0, board.w - M - rx, hh, main);
  }
}


function drawGeneric(ctx: Ctx): void {
  const { options, board } = ctx;
  const command = options.selectedCommand ?? "items";
  const d = createStatusMenuDetail(statusMenuDetailOptions(options, command));
  const title = d.title || statusMenuCommandLabel(command as StatusMenuCommandId, options.waitModeEnabled ?? true, options.project);
  drawHead(ctx, title, false);
  const y0 = M + 22;
  const holder = box(ctx, "hub-generic", M, y0, board.w - 2 * M, board.h - y0 - M);
  const detailPanel = renderStatusMenuDetailPanel(options.project, d, { selectedActionIndex: options.selectedDetailActionIndex, showcase: false });
  detailPanel.dataset.statusMenuCommand = command;
  holder.append(detailPanel);
  const footer = document.createElement("div");
  footer.className = "hub-generic-hint sm faint";
  footer.textContent = d.hint ?? "";
  holder.append(footer);
}
