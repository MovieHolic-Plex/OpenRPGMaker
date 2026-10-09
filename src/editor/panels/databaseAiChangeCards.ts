// editor/panels/databaseAiChangeCards.ts — DB AI 검토 화면의 레코드 카드.
//
// 카드 한 장 = 레코드 하나(databaseRecordDiff). 왼쪽 그림(배틀러·얼굴·아이콘), 오른쪽 이름·id·동사 배지·
// 필드별 before → after 와 수치 델타. 리소스 id 가 바뀐 필드는 「지금 / 적용 후」 그림 두 장으로 그린다 —
// 데크의 변경 영수증 카드(aiChangePreview)와 같은 언어를 DB 레코드에 맞게 옮긴 것이다.

import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { buildSvgIcon } from "@/editor/panels/tileToolbarIcons";
import { summarizeLedgerValue } from "@/project/changeLedger";
import { databaseRecordNameById, type DatabaseFieldChange, type DatabaseRecordChange } from "@/project/databaseRecordDiff";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

export interface DatabaseChangeCardsOptions {
  readonly before: Project;
  readonly after: Project;
  /** 「이동 →」 — 그 레코드의 탭·선택으로 점프. 없으면 단추를 그리지 않는다. */
  readonly onNavigate?: (change: DatabaseRecordChange) => void;
}

const ART_KEYS_BY_COLLECTION: Readonly<Record<string, readonly string[]>> = {
  actors: ["faceResourceId", "battleCharacterResourceId", "characterResourceId"],
  enemies: ["monsterResourceId"],
  items: ["iconResourceId", "imageResourceId"],
  equipment: ["iconResourceId", "imageResourceId"],
};

const VERB_LABEL: Readonly<Record<DatabaseRecordChange["change"], string>> = {
  added: "추가",
  removed: "삭제",
  changed: "변경",
};

function stringAt(record: Record<string, unknown> | null, path: string): string | undefined {
  let cursor: unknown = record;
  for (const key of path.split(".")) {
    if (typeof cursor !== "object" || cursor === null) return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return typeof cursor === "string" && cursor.length > 0 ? cursor : undefined;
}

/** 레코드의 대표 그림 URL. 컬렉션별 우선 키 → 아무 `*ResourceId` 키 순. 없으면 null. */
export function databaseRecordArtUrl(
  project: Pick<Project, "assets">,
  collection: string,
  record: Record<string, unknown> | null,
): string | null {
  if (!record) return null;
  const preferred = ART_KEYS_BY_COLLECTION[collection] ?? [];
  const graphic = record.graphic;
  const candidates = [
    ...preferred.map((key) => stringAt(record, key)),
    typeof graphic === "object" && graphic !== null ? stringAt(graphic as Record<string, unknown>, "monsterResourceId") : undefined,
    ...Object.keys(record).filter((key) => /ResourceId$/u.test(key)).map((key) => stringAt(record, key)),
  ];
  for (const resourceId of candidates) {
    if (!resourceId) continue;
    const url = resolveAssetResourceUrl(resourceId, { project });
    if (url) return url;
  }
  return null;
}

/** 필드 값 한 줄. 참조 id 는 그 레코드 이름으로, 없는 값은 「없음」, 나머지는 ledger 요약과 같다. */
export function formatDatabaseFieldValue(project: Project, value: unknown): string {
  if (value === undefined || value === null || value === "") return "없음";
  if (typeof value === "boolean") return value ? "켜짐" : "꺼짐";
  if (typeof value === "string") {
    const referenced = databaseRecordNameById(project, value);
    return referenced ? referenced : summarizeLedgerValue(value);
  }
  return summarizeLedgerValue(value);
}

function formatDelta(delta: number): string {
  const rounded = Number.isInteger(delta) ? delta : Math.round(delta * 100) / 100;
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function initialBadge(name: string): HTMLElement {
  return el("span", { class: "database-ai-card-initial", attrs: { "aria-hidden": "true" }, text: [...name.trim()][0] ?? "?" });
}

function artFigure(url: string | null, name: string, className: string): HTMLElement {
  return el("span", {
    class: className,
    children: [url ? el("img", { attrs: { src: url, alt: name, loading: "lazy", decoding: "async" } }) : initialBadge(name)],
  });
}

function arrowIcon(): SVGSVGElement {
  const svg = buildSvgIcon([{ tag: "path", attrs: { d: "M4 11h13M12 6l5 5-5 5" } }]);
  svg.setAttribute("class", "database-ai-card-arrow");
  svg.setAttribute("aria-hidden", "true");
  return svg;
}

function fieldRow(project: Project, field: DatabaseFieldChange, change: DatabaseRecordChange["change"]): HTMLElement {
  const values = change === "added"
    ? [el("span", { class: "database-ai-card-after", text: formatDatabaseFieldValue(project, field.after) })]
    : [
      el("span", { class: "database-ai-card-before", text: formatDatabaseFieldValue(project, field.before) }),
      el("span", { class: "database-ai-card-to", attrs: { "aria-hidden": "true" }, text: "→" }),
      el("span", { class: "database-ai-card-after", text: formatDatabaseFieldValue(project, field.after) }),
    ];
  const children: (HTMLElement | string)[] = [
    el("span", { class: "database-ai-card-key", text: field.label }),
    el("span", { class: "database-ai-card-values", children: values }),
  ];
  if (field.delta !== null && field.delta !== 0) {
    children.push(el("span", {
      class: `database-ai-card-delta ${field.delta > 0 ? "is-up" : "is-down"}`,
      dataset: { testid: "database-ai-card-delta" },
      text: formatDelta(field.delta),
    }));
  }
  return el("li", { class: "database-ai-card-field", dataset: { path: field.path }, children });
}

function graphicPair(options: DatabaseChangeCardsOptions, change: DatabaseRecordChange, field: DatabaseFieldChange): HTMLElement {
  const beforeUrl = typeof field.before === "string" ? resolveAssetResourceUrl(field.before, { project: options.before }) : null;
  const afterUrl = typeof field.after === "string" ? resolveAssetResourceUrl(field.after, { project: options.after }) : null;
  return el("div", {
    class: "database-ai-card-gfx",
    dataset: { testid: "database-ai-card-gfx", path: field.path },
    children: [
      el("span", { class: "database-ai-card-gfx-cell", children: [artFigure(beforeUrl, `${change.name} — 지금`, "database-ai-card-gfx-art"), el("small", { text: "지금" })] }),
      arrowIcon(),
      el("span", { class: "database-ai-card-gfx-cell is-after", children: [artFigure(afterUrl, `${change.name} — 적용 후`, "database-ai-card-gfx-art"), el("small", { text: "적용 후" })] }),
    ],
  });
}

export function renderDatabaseChangeCard(change: DatabaseRecordChange, options: DatabaseChangeCardsOptions): HTMLElement {
  const record = change.after ?? change.before;
  const artUrl = change.change === "removed" ? null : databaseRecordArtUrl(options.after, change.collection, record);
  const slim = change.change === "removed";
  const graphicFields = change.fields.filter((field) => field.graphic && change.change === "changed");
  const plainFields = change.fields.filter((field) => !(field.graphic && change.change === "changed"));

  const head = el("div", {
    class: "database-ai-card-head",
    children: [
      el("span", { class: "database-ai-card-name", text: change.name }),
      el("span", { class: "database-ai-card-id", text: `#${change.id}` }),
      el("span", { class: `database-ai-card-verb is-${change.change}`, text: VERB_LABEL[change.change] }),
      el("span", { class: "database-ai-card-area", text: change.areaLabel }),
    ],
  });
  // 아직 적용되지 않은 **추가** 레코드는 갈 곳이 없다 — 그 id 는 현재 프로젝트에 없으므로 선택이
  // 첫 레코드로 미끄러졌다(실측: 「동검」 이동 → 「회복약」이 열림). 적용 뒤에나 의미가 있다.
  if (options.onNavigate && change.change !== "added") {
    head.append(el("button", {
      class: "database-ai-card-goto",
      attrs: { type: "button", title: `${change.areaLabel} 탭에서 「${change.name}」 보기` },
      dataset: { testid: "database-ai-card-goto" },
      children: ["이동", arrowIcon()],
      on: { click: () => options.onNavigate?.(change) },
    }));
  }

  const body = el("div", { class: "database-ai-card-body", children: [head] });
  for (const field of graphicFields) body.append(graphicPair(options, change, field));
  if (slim) {
    body.append(el("p", { class: "database-ai-card-note", text: "이 레코드가 삭제됩니다" }));
  } else if (plainFields.length > 0 || change.hiddenFieldCount > 0) {
    const list = el("ul", { class: "database-ai-card-fields", children: plainFields.map((field) => fieldRow(options.after, field, change.change)) });
    if (change.hiddenFieldCount > 0) {
      list.append(el("li", { class: "database-ai-card-field is-more", text: `…외 ${change.hiddenFieldCount}개 필드` }));
    }
    body.append(list);
  }

  const card = el("li", {
    class: `database-ai-card is-${change.change}${slim ? " is-slim" : ""}`,
    dataset: { testid: "database-ai-card", collection: change.collection, recordId: change.id, change: change.change },
    children: slim ? [body] : [artFigure(artUrl, change.name, "database-ai-card-thumb"), body],
  });
  return card;
}

export function renderDatabaseChangeCards(changes: readonly DatabaseRecordChange[], options: DatabaseChangeCardsOptions): HTMLElement {
  return el("ul", {
    class: "database-ai-cards",
    attrs: { "aria-label": "바뀌는 레코드" },
    dataset: { testid: "database-ai-cards" },
    children: changes.map((change) => renderDatabaseChangeCard(change, options)),
  });
}

/** 상태줄용 요약 — 「바꾼 레코드 2 · 추가 1 · 삭제 1」. 0 인 축은 말하지 않는다. */
export function describeDatabaseChanges(changes: readonly DatabaseRecordChange[]): string {
  const count = (kind: DatabaseRecordChange["change"]): number => changes.filter((change) => change.change === kind).length;
  const parts = [
    count("changed") > 0 ? `바꾼 레코드 ${count("changed")}` : null,
    count("added") > 0 ? `추가 ${count("added")}` : null,
    count("removed") > 0 ? `삭제 ${count("removed")}` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : "바뀐 레코드 없음";
}
