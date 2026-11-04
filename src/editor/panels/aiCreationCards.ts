// editor/panels/aiCreationCards.ts
// 조수가 무언가를 만들 때마다 작업 줄에 카드가 하나씩 튀어나온다 — 「조수가 하는 게 구체적으로 보여야 만드는 게 재밌다」
// (2026-11-04 오너). 아이템·장비는 아이콘이 반짝이며, 캐릭터는 얼굴이 떠오르고 걷기 칩이 제자리걸음, 몬스터·스킬·상태는
// 그림/아이콘과 핵심 숫자 한 줄, 대사 이벤트는 말풍선에 첫 줄이 타자처럼, 음악은 그 자리에서 듣는 재생 단추.
//
// 재료는 실제로 스토어에 들어온 프로젝트다(실행 중 체크포인트가 반영될 때마다 `observe`). 「바뀐 것」 카드와 같은
// 목록(`listChangeItems`)으로 새로 생긴 항목만 골라 카드를 만들고, 그림도 도구가 방금 쓴 그 리소스를 그대로 쓴다.
// 카드를 누르면 그 기록의 편집기(자료집 탭·이벤트 편집기)가 그 항목에서 열리고, 「되돌리기」는 「바뀐 것」 카드와
// 같은 `undoChangeItem` 이다(되돌리기 장치는 하나).
import { CHARSET_FRAME_HEIGHT, CHARSET_FRAME_WIDTH, CHARSET_SHEET_COLUMNS, CHARSET_SHEET_ROWS, charsetFrameSource, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { findBgmTrack } from "@/assets/bgmCatalog";
import type { DatabaseCollection } from "@/editor/databaseActions";
import { recordListThumbnail } from "@/editor/panels/databaseRecordThumbnails";
import { applyAutoChromaKeyToBackground } from "@/editor/panels/chromaKey";
import type { ActorRecord, Command, EnemyRecord, EquipmentRecord, EquipmentStatBonuses, EventPageGraphic, GameEvent, ItemRecord, Project, SkillRecord, StateRecord } from "@/project/types";
import { el } from "@/util/dom";
import { audioPlayback } from "./audioResourcePresentation";
import {
  CHANGE_KIND_LABEL, listChangeItems, musicResourceOf, recordCollectionOf, undoChangeItem,
  type ChangeItem, type ChangeUndoDeps,
} from "./aiChangeSummaryCard";

/** 카드 한 장의 내용(순수) — 그림은 DOM 단계에서 붙인다. */
export interface CreationCardModel {
  readonly item: ChangeItem;
  readonly title: string;
  /** 종류 꼬리표 — 「아이템 · 무기」. */
  readonly kindLine: string;
  /** 핵심 숫자 한 줄 — 「공격 +12 · 120G」. 없으면 빈 문자열. */
  readonly stats: string;
  readonly speech?: { readonly speaker?: string; readonly text: string };
  readonly musicId?: string;
}

const ITEM_TYPE_LABEL: Readonly<Record<string, string>> = {
  normalGoods: "일반 물품", weapon: "무기", shield: "방패", body: "갑옷", head: "머리", accessory: "장신구",
  medicine: "약", book: "책", seed: "능력치 성장", special: "특수", switch: "장치 작동",
};
const STAT_LABEL: Readonly<Record<string, string>> = { attack: "공격", defense: "방어", mind: "마력", agility: "민첩" };

const signed = (n: number): string => `${n > 0 ? "+" : ""}${n}`;
function bonusLine(bonuses: EquipmentStatBonuses | undefined): string[] {
  return Object.entries(bonuses ?? {}).filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] !== 0)
    .map(([key, n]) => `${STAT_LABEL[key] ?? key} ${signed(n)}`);
}
function recovery(label: string, cost: { flat?: number; percentMax?: number } | undefined): string[] {
  if (!cost) return [];
  const parts = [cost.flat ? `${cost.flat}` : "", cost.percentMax ? `${cost.percentMax}%` : ""].filter(Boolean);
  return parts.length ? [`${label} +${parts.join("+")}`] : [];
}

function recordOf<T>(project: Project, collection: DatabaseCollection, id: string): T | undefined {
  const list = (project.database as unknown as Record<string, readonly { id: unknown }[] | undefined>)[collection];
  return list?.find((record) => String(record.id) === id) as T | undefined;
}

/** 이벤트의 첫 대사(말풍선 재료) — 첫 페이지부터 처음 만나는 text 명령. */
export function firstSpokenLine(event: GameEvent): { readonly speaker?: string; readonly text: string } | undefined {
  const visit = (commands: readonly Command[] | undefined): { speaker?: string; text: string } | undefined => {
    for (const command of commands ?? []) {
      if (command.kind === "text" && command.body.trim()) {
        const text = command.body.replace(/\\[A-Za-z]+\[[^\]]*\]/gu, "").split(/\r?\n/u).map((line) => line.trim()).find(Boolean);
        if (text) return { ...(command.speaker?.trim() ? { speaker: command.speaker.trim() } : {}), text };
      }
      const nested = command as { branch?: readonly Command[]; then?: readonly Command[]; options?: readonly { branch?: readonly Command[] }[] };
      const inner = visit(nested.then) ?? visit(nested.branch) ?? nested.options?.map((option) => visit(option.branch)).find(Boolean);
      if (inner) return inner;
    }
    return undefined;
  };
  for (const page of event.pages ?? []) {
    const found = visit(page.commands);
    if (found) return found;
  }
  return visit((event as { commands?: readonly Command[] }).commands);
}

/** 이벤트가 틀어 주는 첫 곡(보스전 음악처럼 이벤트 안 playAudio 로 고른 것). */
export function firstPlayedMusic(event: GameEvent): string | undefined {
  const visit = (commands: readonly Command[] | undefined): string | undefined => {
    for (const command of commands ?? []) {
      if (command.kind === "playAudio" && command.resourceId && (command.channel ?? (command.loop ? "bgm" : "se")) === "bgm") return command.resourceId;
      const nested = command as { branch?: readonly Command[]; then?: readonly Command[]; else?: readonly Command[]; options?: readonly { branch?: readonly Command[] }[] };
      const inner = visit(nested.then) ?? visit(nested.else) ?? visit(nested.branch) ?? nested.options?.map((option) => visit(option.branch)).find(Boolean);
      if (inner) return inner;
    }
    return undefined;
  };
  for (const page of event.pages ?? []) {
    const found = visit(page.commands);
    if (found) return found;
  }
  return visit((event as { commands?: readonly Command[] }).commands);
}

function eventOf(project: Project, item: ChangeItem): GameEvent | undefined {
  return item.mapId ? project.maps[item.mapId]?.events.find((event) => event.id === item.id) : undefined;
}

/** 카드 내용(순수). 만들 게 없는 항목(맵 칸·지운 것)은 null. */
export function creationCardModel(project: Project, item: ChangeItem): CreationCardModel | null {
  if (item.change === "removed" || item.kind === "map") return null;
  const verb = item.change === "added" ? "" : " · 고침";
  switch (item.kind) {
    case "item": {
      const record = recordOf<ItemRecord>(project, "items", item.id);
      if (!record) return null;
      const stats = [...bonusLine(record.equipmentProfile?.statBonuses), ...recovery("HP", record.hpRecovery), ...recovery("MP", record.mpRecovery), record.price ? `${record.price}G` : ""].filter(Boolean);
      return { item, title: record.name, kindLine: `아이템 · ${ITEM_TYPE_LABEL[record.type] ?? record.type}${verb}`, stats: stats.slice(0, 3).join(" · ") };
    }
    case "equipment": {
      const record = recordOf<EquipmentRecord>(project, "equipment", item.id);
      if (!record) return null;
      const stats = [...bonusLine(record.statBonuses), record.price ? `${record.price}G` : ""].filter(Boolean);
      const slotLabel = project.database.equipmentSlots?.find((slot) => slot.id === record.slot)?.label ?? ITEM_TYPE_LABEL[record.slot] ?? record.slot;
      return { item, title: record.name, kindLine: `장비 · ${slotLabel}${verb}`, stats: stats.slice(0, 3).join(" · ") };
    }
    case "actor": {
      const record = recordOf<ActorRecord>(project, "actors", item.id);
      if (!record) return null;
      const className = project.database.classes.find((entry) => entry.id === record.classId)?.name;
      return { item, title: record.name, kindLine: `캐릭터${className ? ` · ${className}` : ""}${verb}`, stats: record.initialLevel ? `Lv ${record.initialLevel}` : "" };
    }
    case "enemy": {
      const record = recordOf<EnemyRecord>(project, "enemies", item.id);
      if (!record) return null;
      const s = record.stats;
      const stats = s ? [`HP ${s.maxHp}`, `공격 ${s.attack}`, `방어 ${s.defense}`] : [];
      if (record.rewards?.exp) stats.push(`경험치 ${record.rewards.exp}`);
      return { item, title: record.name, kindLine: `몬스터${verb}`, stats: stats.join(" · ") };
    }
    case "skill": {
      const record = recordOf<SkillRecord>(project, "skills", item.id);
      if (!record) return null;
      const stats = [record.power ? `위력 ${record.power}` : "", record.mpCost?.flat ? `MP ${record.mpCost.flat}` : ""].filter(Boolean);
      return { item, title: record.name, kindLine: `스킬${verb}`, stats: stats.join(" · ") };
    }
    case "state": {
      const record = recordOf<StateRecord>(project, "states", item.id);
      if (!record) return null;
      return { item, title: record.name, kindLine: `상태${verb}`, stats: record.restriction ? `제약 ${record.restriction}` : "" };
    }
    case "event": {
      const event = eventOf(project, item);
      if (!event) return null;
      const mapName = project.maps[item.mapId!]?.name?.trim() || item.mapId!;
      const speech = firstSpokenLine(event);
      const musicId = firstPlayedMusic(event);
      const track = musicId ? findBgmTrack(musicId) : undefined;
      return { item, title: event.name?.trim() || item.id, kindLine: `${speech ? "대사" : "이벤트"} · ${mapName} (${event.x}, ${event.y})${verb}`,
        stats: musicId ? `♪ ${track?.title ?? musicId}` : "", ...(speech ? { speech } : {}), ...(musicId ? { musicId } : {}) };
    }
    case "music": {
      const musicId = musicResourceOf(project, item);
      if (!musicId) return null;
      const track = findBgmTrack(musicId);
      return { item, title: track?.title ?? musicId, kindLine: `${CHANGE_KIND_LABEL.music} · ${item.label}`, stats: track?.category ?? "", musicId };
    }
  }
  return null;
}

export function eventCharsetGraphic(event: GameEvent): EventPageGraphic | undefined {
  const pages = event.pages ?? [];
  return pages.find((page) => page.graphic?.sprite?.id && !page.graphic.transparent)?.graphic
    ?? pages.find((page) => page.graphic?.sprite?.id)?.graphic;
}

/** 걷기 칩 아래 방향 3칸을 제자리걸음으로(CSS steps). 칩이 없으면 null. */
export function walkingCharset(project: Project, resourceId: string | undefined, characterIndex: number, size = 48, className = "ai-work-creation-walk"): HTMLElement | null {
  const url = resolveAssetResourceUrl(resourceId, { project });
  if (!url) return null;
  const scale = size / CHARSET_FRAME_HEIGHT;
  const first = charsetFrameSource({ characterIndex, direction: "down", pattern: 0 });
  const node = el("span", { class: className, attrs: { role: "img", "aria-label": "걷기 칩" }, dataset: { testid: "ai-creation-walk" } });
  node.style.width = `${Math.round(CHARSET_FRAME_WIDTH * scale)}px`;
  node.style.height = `${size}px`;
  node.style.backgroundImage = `url("${url}")`;
  node.style.backgroundSize = `${CHARSET_SHEET_COLUMNS * CHARSET_FRAME_WIDTH * scale}px ${CHARSET_SHEET_ROWS * CHARSET_FRAME_HEIGHT * scale}px`;
  node.style.setProperty("--walk-x", `${-first.x * scale}px`);
  node.style.setProperty("--walk-y", `${-first.y * scale}px`);
  node.style.setProperty("--walk-span", `${-3 * CHARSET_FRAME_WIDTH * scale}px`);
  // RTP 걷기 칩은 단색 배경 시트다 — 맵 위·카드 위에서 청록 상자로 보이지 않게 키아웃한다(투명 PNG 면 그대로).
  queueMicrotask(() => applyAutoChromaKeyToBackground(node, url));
  return node;
}

function charsetIndexOf(graphic: EventPageGraphic | undefined, fallback?: number): number {
  if (fallback !== undefined) return fallback;
  try { return decodeCharsetFrameIndex(graphic?.pattern ?? 0).characterIndex; } catch { return 0; }
}

function cardArt(project: Project, model: CreationCardModel): HTMLElement | null {
  const { item } = model;
  const collection = recordCollectionOf(item.kind);
  if (item.kind === "actor") {
    const record = recordOf<ActorRecord>(project, "actors", item.id);
    if (!record) return null;
    const face = record.faceResourceId ? recordListThumbnail("actors", record, project, 48) : null;
    const walk = walkingCharset(project, record.characterResourceId, record.characterIndex ?? 0);
    const parts = [face, walk].filter((node): node is HTMLElement => Boolean(node));
    return parts.length ? el("span", { class: "ai-work-creation-pair", children: parts }) : null;
  }
  if (item.kind === "event") {
    const event = eventOf(project, item);
    const graphic = event ? eventCharsetGraphic(event) : undefined;
    return graphic ? walkingCharset(project, graphic.sprite?.id, charsetIndexOf(graphic)) : null;
  }
  if (item.kind === "music") return null;
  if (!collection) return null;
  const record = recordOf<never>(project, collection, item.id);
  return record ? withoutPlaceholder(recordListThumbnail(collection, record, project, 48)) : null;
}

/** 그림이 없는 기록(아이콘 없이 만든 아이템)은 깨진 그림 표시 대신 이름 첫 글자 — 게임 상자 창과 같다. */
export function withoutPlaceholder(thumb: HTMLElement | null): HTMLElement | null {
  return thumb && !thumb.classList.contains("empty") && !thumb.classList.contains("db-image-placeholder") ? thumb : null;
}

function playButton(project: Project, musicId: string): HTMLElement {
  const playback = audioPlayback(musicId, project);
  const button = el("button", { class: "ai-work-creation-play", attrs: { type: "button", "aria-label": "들어 보기", "aria-pressed": "false" }, dataset: { testid: "ai-creation-play" }, text: "▶" }) as HTMLButtonElement;
  if (!playback.url || !playback.playable) {
    button.disabled = true;
    button.title = playback.midi ? "MIDI 는 미리 듣기 못 해요" : "재생할 파일이 없어요";
    return button;
  }
  let audio: HTMLAudioElement | null = null;
  const stop = (): void => { audio?.pause(); audio = null; button.textContent = "▶"; button.setAttribute("aria-pressed", "false"); button.setAttribute("aria-label", "들어 보기"); };
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (audio) { stop(); return; }
    audio = new Audio(playback.url!);
    audio.volume = 0.6;
    audio.addEventListener("ended", stop, { once: true });
    void audio.play().catch(stop);
    button.textContent = "■";
    button.setAttribute("aria-pressed", "true");
    button.setAttribute("aria-label", "멈추기");
  });
  return button;
}

const TYPE_MS = 28;
/** 말풍선 — 첫 줄을 한 글자씩. 움직임을 줄인 사용자는 한 번에. */
function speechBubble(speech: NonNullable<CreationCardModel["speech"]>, reduced: boolean): HTMLElement {
  const text = el("span", { class: "ai-work-creation-speech-text", dataset: { testid: "ai-creation-speech" } });
  const bubble = el("span", { class: "ai-work-creation-speech", children: [
    ...(speech.speaker ? [el("strong", { text: speech.speaker })] : []), text,
  ] });
  const chars = [...speech.text.slice(0, 80)];
  if (reduced) { text.textContent = chars.join(""); return bubble; }
  let shown = 0;
  const tick = (): void => {
    shown += 1;
    text.textContent = chars.slice(0, shown).join("");
    if (shown < chars.length && text.isConnected !== false) setTimeout(tick, TYPE_MS);
  };
  setTimeout(tick, 120);
  return bubble;
}

export interface CreationFeedDeps extends ChangeUndoDeps {
  readonly open: (item: ChangeItem) => void;
  /** 맵에 놓인 인물·이벤트를 맵 위에 잠깐 보인다(이름표). */
  readonly announcePlacement?: (project: Project, item: ChangeItem) => void;
  readonly reducedMotion?: () => boolean;
}

export interface CreationFeed {
  readonly root: HTMLElement;
  /** 스토어에 새 프로젝트가 들어올 때마다. 이번 실행 기준(base)에서 새로 생긴 것만 카드로. */
  observe(project: Project): void;
  readonly count: number;
}

/** 카드가 너무 많으면 마지막 몇 장만 펼쳐 둔다(작업 줄이 카드로 뒤덮이지 않게). */
const VISIBLE_CARDS = 12;

export function createCreationFeed(base: Project, deps: CreationFeedDeps): CreationFeed {
  const root = el("ol", { class: "ai-work-creation-feed", attrs: { "aria-label": "조수가 만든 것" }, dataset: { testid: "ai-creation-feed" } });
  root.hidden = true;
  const seen = new Map<string, HTMLElement>();
  let last: Project = base;
  const reduced = (): boolean => deps.reducedMotion?.() ?? false;

  const buildCard = (project: Project, model: CreationCardModel): HTMLElement => {
    const { item } = model;
    const art = cardArt(project, model);
    const undo = el("button", { class: "ai-work-creation-undo", text: "되돌리기", attrs: { type: "button", "aria-label": `${model.title} 되돌리기` }, dataset: { testid: "ai-creation-undo" } }) as HTMLButtonElement;
    const open = el("button", { class: "ai-work-creation-open", attrs: { type: "button", "aria-label": `${model.title} 열기` }, dataset: { testid: "ai-creation-open" }, children: [
      el("span", { class: "ai-work-creation-art", attrs: { "aria-hidden": "true" }, children: art ? [art] : [el("span", { class: "ai-work-creation-glyph", text: model.musicId ? "♪" : [...model.title.trim()][0] ?? CHANGE_KIND_LABEL[item.kind].slice(0, 1) })] }),
      el("span", { class: "ai-work-creation-text", children: [
        el("span", { class: "ai-work-creation-kind", text: model.kindLine }),
        el("strong", { class: "ai-work-creation-title", text: model.title }),
        ...(model.stats ? [el("span", { class: "ai-work-creation-stats", dataset: { testid: "ai-creation-stats" }, text: model.stats })] : []),
      ] }),
    ] }) as HTMLButtonElement;
    const card = el("li", { class: `ai-work-creation is-${item.kind}${reduced() ? " is-still" : ""}`, dataset: { testid: "ai-creation-card", kind: item.kind, id: item.id }, children: [open] });
    card.append(el("span", { class: "ai-work-creation-actions", children: [...(model.musicId ? [playButton(project, model.musicId)] : []), undo] }));
    if (model.speech) card.append(speechBubble(model.speech, reduced()));
    open.addEventListener("click", () => deps.open(item));
    undo.addEventListener("click", async () => {
      const ok = await undoChangeItem(item, base, last, deps);
      if (!ok) return;
      card.classList.add("is-reverted");
      undo.disabled = true;
      undo.textContent = "되돌림";
    });
    return card;
  };

  return {
    root,
    get count() { return seen.size; },
    observe(project) {
      if (project === last) return;
      const previous = last;
      last = project;
      // 이번 체크포인트가 새로 들인 항목만(맵 칸 제외). 실행 기준에 이미 있던 것은 「새로 만든 것」이 아니다 —
      // 고친 것은 끝의 「바뀐 것」 카드가 보인다. 음악은 곡 칸을 「정한」 것이므로 고침도 카드로 낸다.
      // 고친 기록도 카드로 낸다(「· 고침」) — 「보스 몬스터 하나랑 전투 음악」을 조수가 있던 보스를 강화하고 곡을 건 이벤트를
      // 고쳐 해내면 새로 만든 것만 보는 카드 줄이 텐 빈 채로 끝났다(2026-11-05 녹화). 이벤트는 대사나 곡이 있을 때만.
      const fresh = listChangeItems(previous, project, { skipMapTiles: true }).filter((item) => item.change !== "removed");
      if (!fresh.length) return;
      for (const item of fresh) {
        const key = `${item.kind}:${item.mapId ?? ""}:${item.id}`;
        if (seen.has(key)) continue;
        const model = creationCardModel(project, item);
        if (!model) continue;
        if (item.kind === "event" && item.change === "modified" && !model.speech && !model.musicId) continue;
        const card = buildCard(project, model);
        seen.set(key, card);
        root.append(card);
        root.hidden = false;
        if (item.kind === "event") deps.announcePlacement?.(project, item);
      }
      const cards = [...root.children] as HTMLElement[];
      cards.forEach((card, index) => { card.classList.toggle("is-folded", index < cards.length - VISIBLE_CARDS); });
    },
  };
}
