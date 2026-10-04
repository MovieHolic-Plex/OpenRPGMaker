import { defaultBattleMotionSkills } from "@/assets/battleMotionCatalog";
// 도트 연출 갤러리 — 이펙트 시트(910개)와 연출(약 1,130개)을 움직이는 썸네일 격자로 고른다.
//
// 썸네일은 시트 PNG 를 그대로 CSS `steps()` 애니메이션으로 재생한다(GIF 를 굽지 않는다).
// 연출 썸네일은 대표 층(프레임 크기 > 프레임 수가 가장 큰 층)의 시트다.
// 한 번에 그리는 카드는 페이지 크기(48)뿐이라 1,000개가 넘어도 DOM 이 가볍다.
//
// DOM 계약(테스트·캡처가 의존):
//   db-retro-gallery-sheet / db-retro-gallery-choreo — 갤러리 루트
//   db-retro-gallery-query / -motion / -element / -family / -frame — 필터
//   db-retro-gallery-count, -prev, -next, -page       — 개수·페이지
//   db-retro-sheet-<키>, db-retro-choreo-card-<id>    — 카드
//   db-retro-gallery-preview, -pick                   — 연출 미리보기 자리·정하기 버튼
import { withInlineAsset } from "@/assets/inlineAssetStore";
import {
  RETRO_CHOREOGRAPHY_FAMILIES,
  RETRO_ELEMENT_IDS,
  filterRetroChoreographies,
  retroChoreographyEntries,
  retroFxSheetMeta,
  searchRetroFxSheets,
  type RetroChoreographyEntry,
  type RetroFxSheetEntry,
} from "@/assets/retroSkillCatalog";
import { MOTION_LABELS, RETRO_SKILL_CLASS_GROUPS, renderSkillRetroStage, type SkillRetroStage } from "@/editor/panels/databaseSkillRetroStage";
import { store } from "@/project/store";
import type { SkillRecord } from "@/project/types";
import { el } from "@/util/dom";

/** 표시 글자(직업 모션 + 몬스터 모션). */
export const RETRO_CHOREOGRAPHY_MOTION_LABELS: Readonly<Record<string, string>> = {
  ...MOTION_LABELS,
  lunge: "돌진 물기", breath: "숨결", stomp: "짓밟기",
};
export const RETRO_ELEMENT_LABELS: Readonly<Record<string, string>> = {
  fire: "불", ice: "얼음", thunder: "번개", water: "물", earth: "땅", wind: "바람", holy: "빛", dark: "어둠",
};
export const RETRO_FAMILY_LABELS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(RETRO_SKILL_CLASS_GROUPS.map((group) => [group.id, group.label])), monster: "몬스터",
};
/** 갤러리 한 페이지의 카드 수. */
export const RETRO_GALLERY_PAGE_SIZE = 48;

/** 시트 한 장을 움직이는 썸네일로. 모르는 키는 빈 칸. */
export function sheetThumb(key: string, size = 64): HTMLElement {
  const meta = retroFxSheetMeta(key);
  const node = el("span", { class: "db-retro-thumb", attrs: { "aria-hidden": "true", title: key } });
  node.style.setProperty("--rt-size", size + "px");
  if (!meta) { node.classList.add("db-retro-thumb-missing"); return node; }
  node.style.setProperty("--rt-url", 'url("' + withInlineAsset("/assets/generated/pixel-fx/" + key + ".png") + '")');
  node.style.setProperty("--rt-frames", String(meta.frames));
  node.style.setProperty("--rt-ms", Math.max(600, meta.frames * 90) + "ms");
  return node;
}

/** 층 시트 키들 중 대표(프레임 크기 → 프레임 수가 큰 것, 같으면 앞). */
export function representativeSheet(keys: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestScore = -1;
  for (const key of keys) {
    const meta = retroFxSheetMeta(key);
    if (!meta) continue;
    const score = meta.frame * 1000 + meta.frames;
    if (score > bestScore) { best = key; bestScore = score; }
  }
  return best;
}

let sheetNameCache: ReadonlyMap<string, RetroChoreographyEntry> | undefined;

/**
 * 시트 → 그 시트를 쓰는 기본 연출 중 대표 하나. 층이 적을수록(그 시트가 주인공일수록), 첫 층일수록 앞선다.
 * 시트 카드에 한글 이름을 크게 보이려는 용도(영어 키만으로는 무슨 그림인지 모른다).
 */
export function representativeChoreographyForSheet(key: string): RetroChoreographyEntry | undefined {
  if (!sheetNameCache) {
    const best = new Map<string, { entry: RetroChoreographyEntry; score: number }>();
    for (const entry of retroChoreographyEntries()) {
      entry.layerKeys.forEach((layerKey, index) => {
        const score = entry.layerKeys.length * 10 + index;
        const prev = best.get(layerKey);
        if (!prev || score < prev.score) best.set(layerKey, { entry, score });
      });
    }
    sheetNameCache = new Map([...best].map(([layerKey, value]) => [layerKey, value.entry]));
  }
  return sheetNameCache.get(key);
}

/** 연출 하나를 무대에 올리기 위한 임시 스킬(저장하지 않는다). 프로젝트 레코드·기본 연출 모두 retroChoreographyId 로 푼다. */
export function choreographyPreviewSkill(entryId: string, name: string, scope: SkillRecord["scope"] = "enemy"): SkillRecord {
  const common=defaultBattleMotionSkills().find(s=>s.retroChoreographyId===entryId);
  if(common)return {...common,id:"preview_"+entryId,name,scope};
  return {
    id: "preview_" + entryId, name, scope, power: 10, description: "", type: "physical", mpCost: 0, successRate: 100, variance: 0, hitRate: 100,
    effect: { kind: "damage", statistic: "attack", affects: "hp" },
    retroChoreographyId: entryId,
  } as unknown as SkillRecord;
}

/** 연출 미리보기 무대(없으면 null). 항상 현재 프로젝트 상태로 푼다. */
export function renderChoreographyPreview(entryId: string, name: string): SkillRetroStage | null {
  return renderSkillRetroStage(choreographyPreviewSkill(entryId, name), store.getCurrent());
}

function selectOf(first: string, values: readonly string[], labels: Readonly<Record<string, string>>, testid: string): HTMLSelectElement {
  const select = el("select", { dataset: { testid } });
  select.append(el("option", { text: first, attrs: { value: "" } }));
  for (const value of values) select.append(el("option", { text: labels[value] ?? value, attrs: { value } }));
  return select;
}

interface GridParts<T> {
  readonly root: HTMLElement;
  readonly query: HTMLInputElement;
  readonly filters: HTMLElement;
  readonly setItems: (items: readonly T[]) => void;
}

/** 검색창·필터 줄·격자·페이저 뼈대. 카드 그리기는 호출자가 준다. */
function pagedGrid<T>(testid: string, drawCard: (item: T) => HTMLElement, onChange: () => void): GridParts<T> {
  const root = el("div", { class: "db-retro-gallery", dataset: { testid } });
  const query = el("input", { class: "db-retro-gallery-query", attrs: { type: "search", placeholder: "이름·설명·이펙트로 찾기 (예: 번개, 화염 참격)" }, dataset: { testid: "db-retro-gallery-query" } });
  const filters = el("div", { class: "db-retro-gallery-filters" });
  filters.append(query);
  const count = el("span", { class: "db-retro-gallery-count", dataset: { testid: "db-retro-gallery-count" } });
  const grid = el("div", { class: "db-retro-gallery-grid" });
  const prev = el("button", { class: "db-retro-gallery-page-btn", text: "이전", attrs: { type: "button" }, dataset: { testid: "db-retro-gallery-prev" } });
  const next = el("button", { class: "db-retro-gallery-page-btn", text: "다음", attrs: { type: "button" }, dataset: { testid: "db-retro-gallery-next" } });
  const pageLabel = el("span", { class: "db-retro-gallery-page", dataset: { testid: "db-retro-gallery-page" } });
  const pager = el("div", { class: "db-retro-gallery-pager", children: [prev, pageLabel, next, count] });
  let items: readonly T[] = [];
  let page = 0;
  const draw = (): void => {
    const pages = Math.max(1, Math.ceil(items.length / RETRO_GALLERY_PAGE_SIZE));
    page = Math.min(page, pages - 1);
    const slice = items.slice(page * RETRO_GALLERY_PAGE_SIZE, (page + 1) * RETRO_GALLERY_PAGE_SIZE);
    grid.replaceChildren(...(slice.length ? slice.map(drawCard) : [el("div", { class: "db-retro-gallery-empty", text: "맞는 항목이 없습니다. 낱말을 줄이거나 필터를 풀어 보세요." })]));
    pageLabel.textContent = `${page + 1} / ${pages}`;
    count.textContent = `${items.length}개`;
    prev.disabled = page <= 0;
    next.disabled = page >= pages - 1;
  };
  prev.addEventListener("click", () => { page -= 1; draw(); });
  next.addEventListener("click", () => { page += 1; draw(); });
  // 필터 조작이 폼 전체의 change 재렌더를 타지 않게 한다(입력 중 카드가 다시 그려지면 포커스를 잃는다).
  root.addEventListener("change", (event) => event.stopPropagation());
  root.append(filters, grid, pager);
  return { root, query, filters, setItems: (next2) => { items = next2; page = 0; draw(); onChange(); } };
}

export interface RetroSheetGalleryOptions {
  readonly selected?: string;
  readonly initialQuery?: string;
  readonly onPick: (key: string) => void;
}

/** 이펙트 시트 고르기 — 카드를 누르면 바로 onPick. */
export function retroSheetGallery(options: RetroSheetGalleryOptions): HTMLElement {
  let selected = options.selected;
  const drawCard = (sheet: RetroFxSheetEntry): HTMLElement => {
    const korean = representativeChoreographyForSheet(sheet.key);
    const card = el("button", {
      class: "db-retro-card" + (sheet.key === selected ? " active" : ""),
      attrs: { type: "button", title: `${korean ? korean.name + " — " : ""}${sheet.key} · ${sheet.frame}px × ${sheet.frames}프레임 · 연출 ${sheet.usedBy}곳` },
      dataset: { testid: "db-retro-sheet-" + sheet.key },
      children: [
        sheetThumb(sheet.key),
        ...(korean ? [el("span", { class: "db-retro-card-name", text: korean.name, attrs: { title: korean.name } })] : []),
        el("span", { class: korean ? "db-retro-card-key" : "db-retro-card-name", text: sheet.key }),
        el("span", { class: "db-retro-card-sub", text: `${sheet.frame}px · ${sheet.frames}f` }),
      ],
    });
    card.addEventListener("click", () => { selected = sheet.key; options.onPick(sheet.key); });
    return card;
  };
  let frame = "";
  const parts = pagedGrid<RetroFxSheetEntry>("db-retro-gallery-sheet", drawCard, () => {});
  const frameSelect = selectOf("프레임 크기 전체", ["32", "64", "128"], { 32: "32px", 64: "64px", 128: "128px" }, "db-retro-gallery-frame");
  parts.filters.append(frameSelect);
  const refresh = (): void => {
    frame = frameSelect.value;
    parts.setItems(searchRetroFxSheets(parts.query.value.trim() || undefined).filter((sheet) => !frame || String(sheet.frame) === frame));
  };
  parts.query.addEventListener("input", refresh);
  frameSelect.addEventListener("change", refresh);
  if (options.initialQuery) parts.query.value = options.initialQuery;
  refresh();
  return parts.root;
}

export interface RetroChoreographyGalleryOptions {
  readonly selectedId?: string;
  /** 지금 스킬이 계약이라 고를 수 없을 때 등, 정하기 버튼을 감춘다. */
  readonly onPick: (entry: RetroChoreographyEntry) => void;
  readonly pickLabel?: string;
}

/**
 * 연출 고르기 — 카드를 누르면 아래에 무대 미리보기와 「정하기」 버튼이 나온다.
 * 프로젝트 연출이 앞, 기본 연출이 뒤.
 */
export function retroChoreographyGallery(options: RetroChoreographyGalleryOptions): HTMLElement {
  let focus: RetroChoreographyEntry | undefined;
  let stage: SkillRetroStage | null = null;
  const preview = el("div", { class: "db-retro-gallery-preview", dataset: { testid: "db-retro-gallery-preview" } });
  const showPreview = (entry: RetroChoreographyEntry): void => {
    stage?.stop();
    focus = entry;
    stage = renderChoreographyPreview(entry.id, entry.name);
    const pick = el("button", { class: "db-retro-gallery-pick", text: options.pickLabel ?? "이 연출로 정하기", attrs: { type: "button" }, dataset: { testid: "db-retro-gallery-pick" } });
    pick.addEventListener("click", () => options.onPick(entry));
    preview.replaceChildren(
      el("div", { class: "db-retro-gallery-preview-head", children: [
        el("strong", { text: entry.name }),
        el("span", { class: "db-retro-card-sub", text: `${entry.origin === "project" ? "프로젝트" : "기본"} · ${RETRO_CHOREOGRAPHY_MOTION_LABELS[entry.motion] ?? entry.motion}` }),
        pick,
      ] }),
      el("div", { class: "db-retro-gallery-preview-layers", text: entry.layerSummary }),
      ...(stage ? [stage.element] : []),
    );
    for (const card of parts.root.querySelectorAll(".db-retro-card")) card.classList.toggle("active", (card as HTMLElement).dataset.id === entry.id);
  };
  const drawCard = (entry: RetroChoreographyEntry): HTMLElement => {
    const key = representativeSheet(entry.layerKeys);
    const card = el("button", {
      class: "db-retro-card" + (entry.id === (focus?.id ?? options.selectedId) ? " active" : ""),
      attrs: { type: "button", title: `${entry.name}\n${entry.layerSummary}` },
      dataset: { testid: "db-retro-choreo-card-" + entry.id, id: entry.id },
      children: [
        key ? sheetThumb(key) : el("span", { class: "db-retro-thumb db-retro-thumb-missing" }),
        el("span", { class: "db-retro-card-name", text: entry.name }),
        el("span", { class: "db-retro-card-sub", text: (entry.origin === "project" ? "내 연출 · " : "") + (RETRO_CHOREOGRAPHY_MOTION_LABELS[entry.motion] ?? entry.motion) }),
      ],
    });
    card.addEventListener("click", () => showPreview(entry));
    return card;
  };
  const parts = pagedGrid<RetroChoreographyEntry>("db-retro-gallery-choreo", drawCard, () => {});
  const motion = selectOf("모션 전체", [...new Set(retroChoreographyEntries().map((entry) => entry.motion))], RETRO_CHOREOGRAPHY_MOTION_LABELS, "db-retro-gallery-motion");
  const element = selectOf("속성 전체", RETRO_ELEMENT_IDS, RETRO_ELEMENT_LABELS, "db-retro-gallery-element");
  const family = selectOf("계열 전체", RETRO_CHOREOGRAPHY_FAMILIES, RETRO_FAMILY_LABELS, "db-retro-gallery-family");
  parts.filters.append(motion, element, family);
  const refresh = (): void => {
    const records = store.getCurrent().database.skillChoreographies;
    parts.setItems(filterRetroChoreographies({
      query: parts.query.value.trim() || undefined, motion: motion.value || undefined, element: element.value || undefined, family: family.value || undefined,
    }, records));
  };
  parts.query.addEventListener("input", refresh);
  for (const control of [motion, element, family]) control.addEventListener("change", refresh);
  refresh();
  parts.root.append(preview);
  const current = options.selectedId ? filterRetroChoreographies({}, store.getCurrent().database.skillChoreographies).find((entry) => entry.id === options.selectedId) : undefined;
  if (current) showPreview(current);
  return parts.root;
}
