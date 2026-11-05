// generate_item_icon — 이름에 맞는 아이콘이 프로젝트·번들에 없을 때 이미지 모델(사용자의 그림 계정, 예: ChatGPT GPT Image)로
// 32×32 도트 아이콘을 새로 그려 등록하고 레코드에 잇는다(2026-11-05 오너: 「나그네 도시락」 아이템과 아이콘이 맞지 않는데 왜 AI 조수는
// 아이콘 생성의 필요성을 못 느낀 거지 … AI 조수는 왜 있는 거로만 쓰려고 할까).
//
// 「맞는다」 = 스토어 아이콘 점수가 STORE_ICON_CONFIDENT_SCORE 이상이거나 번들 기본 그림 낱말이 «이름»에 맞는 것(defaultItemIcon.ts).
// 맞지 않아 종류 기본 그림(약 → 빨간 물약)을 대신 붙인 레코드는 project.meta.oprnPlaceholderIcons 에 「대신 쓴 그림」으로 적는다.
// 실제 그리기는 Pi 실행기(scripts/lib/piAgentRuntime.ts)가 편집기의 그림 경로로 한다. 생성 경로가 없는 곳(헤드리스)에서는 run 이 실패한다.
import type { Project } from "@/project/types";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

export const ITEM_ICON_TOOL = "generate_item_icon";

export const ICON_COLLECTIONS = ["items", "equipment", "skills", "states"] as const;
export type IconCollection = (typeof ICON_COLLECTIONS)[number];

export interface PlaceholderIconMark {
  /** 표식을 적을 때 붙어 있던 대신 쓴 그림(없으면 빈칸이었다). 레코드 아이콘이 이것과 달라지면 표식은 끝난 것이다. */
  readonly resourceId?: string;
  readonly attempts: number;
  readonly reason?: string;
}

/** 한 실행에서 저절로 그릴 아이콘 수의 상한, 한 번에 동시에 그릴 수, 같은 레코드를 다시 시도할 횟수. */
export const ITEM_ICON_RUN_BUDGET = 12;
export const ITEM_ICON_CONCURRENCY = 4;
export const ITEM_ICON_MAX_ATTEMPTS = 2;
/** 실행 끝 저절로 그리기가 새 그림을 시작할 수 있는 시간. 편집기는 그림 요청을 한 줄로 처리해 한 장씩 그린다(30~60초). */
export const ITEM_ICON_AUTO_WALL_MS = 8 * 60_000;
const PER_CALL_LIMIT = 8;

export const placeholderKey = (collection: IconCollection, id: string): string => `${collection}/${id}`;

type IconRecord = { readonly id: string; readonly name: string; readonly description?: string; iconResourceId?: string; readonly type?: string; readonly slot?: string };

export function iconRecords(project: Project, collection: IconCollection): IconRecord[] {
  const db = project.database;
  return (collection === "items" ? db.items : collection === "equipment" ? db.equipment : collection === "skills" ? db.skills : db.states) as unknown as IconRecord[];
}

export function iconRecordOf(project: Project, collection: IconCollection, id: string): IconRecord | undefined {
  return iconRecords(project, collection).find((record) => record.id === id);
}

export function markPlaceholderIcon(draft: Project, collection: IconCollection, id: string, resourceId: string | undefined): void {
  const marks = (draft.meta.oprnPlaceholderIcons ??= {});
  const key = placeholderKey(collection, id);
  marks[key] = { ...(resourceId ? { resourceId } : {}), attempts: marks[key]?.attempts ?? 0, ...(marks[key]?.reason ? { reason: marks[key]!.reason } : {}) };
}

export function clearPlaceholderIcon(draft: Project, collection: IconCollection, id: string): void {
  const marks = draft.meta.oprnPlaceholderIcons;
  if (!marks || !marks[placeholderKey(collection, id)]) return;
  delete marks[placeholderKey(collection, id)];
  if (Object.keys(marks).length === 0) delete draft.meta.oprnPlaceholderIcons;
}

/**
 * 지금도 대신 쓴 그림인 표식(레코드가 있고, 아이콘이 표식의 그림 그대로이거나 비어 있다). 사용자·조수가 다른 아이콘을 직접 주면
 * 그 레코드는 더 이상 대신 쓴 그림이 아니다 — 표식은 남아 있어도 무시한다.
 */
export function livePlaceholderIcons(project: Project): { readonly collection: IconCollection; readonly id: string; readonly mark: PlaceholderIconMark }[] {
  const out: { collection: IconCollection; id: string; mark: PlaceholderIconMark }[] = [];
  for (const [key, mark] of Object.entries(project.meta.oprnPlaceholderIcons ?? {})) {
    const slash = key.indexOf("/");
    const collection = key.slice(0, slash) as IconCollection;
    if (!(ICON_COLLECTIONS as readonly string[]).includes(collection)) continue;
    const id = key.slice(slash + 1);
    const record = iconRecordOf(project, collection, id);
    if (!record) continue;
    if ((record.iconResourceId ?? "") !== (mark.resourceId ?? "")) continue;
    out.push({ collection, id, mark });
  }
  return out;
}

export function isPlaceholderIcon(project: Project, collection: IconCollection, id: string): boolean {
  return livePlaceholderIcons(project).some((entry) => entry.collection === collection && entry.id === id);
}

export interface ItemIconTarget {
  readonly collection: IconCollection;
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly kind: string;
}

const KIND_SUBJECT: Readonly<Record<string, string>> = {
  medicine: "a consumable", normalGoods: "an everyday item", special: "a special item", book: "a book or tome", seed: "a seed or growth item",
  switch: "a key item", weapon: "a weapon", shield: "a shield", head: "a headgear", body: "a body armour or clothing", accessory: "an accessory",
  skill: "a skill emblem (the effect as a symbol, no person)", state: "a status-effect badge (a symbol, no person)",
};

function targetOf(project: Project, collection: IconCollection, id: string): ItemIconTarget {
  const record = iconRecordOf(project, collection, id);
  if (!record) throw new ToolError(`${collection} 에 ${id} 가 없습니다.`, { code: "not-found" });
  const kind = collection === "skills" ? "skill" : collection === "states" ? "state" : collection === "equipment" ? record.slot ?? "weapon" : record.type ?? "normalGoods";
  return { collection, id, name: record.name, description: (record.description ?? "").replace(/\s+/gu, " ").trim().slice(0, 240), kind };
}

export function prepareItemIconTargets(project: Project, args: Record<string, unknown>): ItemIconTarget[] {
  const raw = args.targets;
  if (raw !== undefined && !Array.isArray(raw)) throw new ToolError("targets 는 [{collection, id}] 배열입니다.", { code: "invalid-args" });
  const wanted = raw === undefined
    ? livePlaceholderIcons(project).map(({ collection, id }) => ({ collection, id }))
    : (raw as unknown[]).map((entry) => {
      const ref = entry as { collection?: unknown; id?: unknown } | null;
      if (!ref || typeof ref.id !== "string" || !(ICON_COLLECTIONS as readonly unknown[]).includes(ref.collection)) {
        throw new ToolError(`targets 항목은 {collection: ${ICON_COLLECTIONS.join("|")}, id} 입니다.`, { code: "invalid-args" });
      }
      return { collection: ref.collection as IconCollection, id: ref.id };
    });
  if (wanted.length === 0) throw new ToolError("그릴 아이콘이 없습니다 — 대신 쓴 그림인 레코드가 없습니다. targets:[{collection,id}] 로 직접 고르세요.", { code: "nothing-to-draw" });
  if (wanted.length > PER_CALL_LIMIT) throw new ToolError(`한 번에 ${PER_CALL_LIMIT}개까지 그립니다(받은 ${wanted.length}개) — 나눠서 부르세요.`, { code: "invalid-args" });
  const seen = new Set<string>();
  return wanted.filter(({ collection, id }) => !seen.has(placeholderKey(collection, id)) && seen.add(placeholderKey(collection, id))).map(({ collection, id }) => targetOf(project, collection, id));
}

export function itemIconImagePrompt(target: ItemIconTarget): string {
  const subject = KIND_SUBJECT[target.kind] ?? "an item";
  return [
    `Draw exactly one inventory icon for a 16-bit SNES-era JRPG: ${JSON.stringify(target.name)}, ${subject}.`,
    target.description ? `What it is: ${JSON.stringify(target.description)}.` : "",
    "Show the object itself, large and centred, slightly from above, filling about 80% of the canvas, with a thick dark outline, flat saturated colours and 3-4 tone shading so it still reads at 32x32 pixels.",
    "One object only. No hands, no people, no text, letters, numbers, frame, border, shadow on the floor or scenery.",
    "Background: one uniform flat pure magenta (#FF00FF) colour with no gradient, so it can be keyed out. Do not use magenta inside the object.",
  ].filter(Boolean).join("\n");
}

const SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    targets: {
      type: "array", maxItems: PER_CALL_LIMIT,
      description: "그릴 레코드. 생략하면 지금 「대신 쓴 그림」인 레코드 전부(최대 8개).",
      items: {
        type: "object", additionalProperties: false, required: ["collection", "id"],
        properties: { collection: { type: "string", enum: [...ICON_COLLECTIONS] }, id: { type: "string" } },
      },
    },
  },
};

const generateItemIcon: ToolDefinition = {
  name: ITEM_ICON_TOOL,
  description:
    "아이템·장비·스킬·상태의 이름에 맞는 아이콘이 프로젝트·스토어·번들에 없을 때 32×32 도트 아이콘을 이미지 모델로 «새로» 그려 등록하고 그 레코드의 iconResourceId 로 잇는다. "
    + "upsert_item 등이 「대신 쓴 그림」(종류 기본 그림)을 붙였다고 경고한 레코드에 쓴다 — 있는 아이콘 중 이름에 맞는 게 있으면 그것을 쓰고, 맞는 게 없으면 이 도구로 만든다. "
    + "한 장에 수십 초가 걸리고 여러 개는 동시에 그린다(한 번에 최대 8개). 실패하면 대신 쓴 그림이 그대로 남고 결과에 실패가 적힌다 — 그렸다고 보고하지 않는다. "
    + "이 도구를 부르지 않아도 실행 끝에 남은 대신 쓴 그림은 저절로 그려진다.",
  mode: "write",
  parameters: SCHEMA,
  run(project, args): ToolExecResult {
    prepareItemIconTargets(project, args);
    throw new ToolError("이 실행에는 그림 생성 경로가 연결되어 있지 않습니다(편집기 조수 실행에서만 가능). 아이콘을 그리지 못했습니다 — 대신 쓴 그림이 그대로이니 그렸다고 보고하지 마세요.", { code: "image-generation-unavailable" });
  },
};

export const ITEM_ICON_TOOLS: readonly ToolDefinition[] = [generateItemIcon];
