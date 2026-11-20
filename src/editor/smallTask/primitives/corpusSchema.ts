import { DATABASE_AREA_LABELS } from "@/project/changeLedger";
import { BUILTIN_EQUIPMENT_SLOTS } from "@/project/equipmentSlots";
import type { Command, GameEvent, Project } from "@/project/types";
import type { SmallTaskCollection, SmallTaskTarget } from "../target";
import { dbTarget, mapTarget } from "../target";
import { PrimitiveError } from "./errors";
import type { PrimitiveContext } from "./types";

export type FixtureName = "blank" | "built" | "maou";

export type TargetSelector =
  | { kind: "map"; mapId?: string }
  | { kind: "event"; mapId?: string; eventId: string; pageId?: string }
  | { kind: "dbEntry"; collection: SmallTaskCollection; id: string };

export interface Check {
  at: string;
  equals?: unknown;
  includes?: unknown;
  count?: number;
}

export interface CorpusCase {
  request: string;
  fixture: FixtureName;
  /** Per-case additions to the fixture, applied before resolving the target. */
  seed?: CorpusSetup;
  setup?: CorpusSetup;
  target: TargetSelector;
  selection?: PrimitiveContext["selection"];
  primitive: string;
  args: Record<string, unknown>;
  expect?: Check[];
  expectRefusal?: true;
  refusalMessage?: string;
}

export interface CorpusSetup {
  system?: Partial<Project["system"]>;
  database?: Partial<Project["database"]>;
  difficulties?: Project["system"]["difficulties"];
  events?: GameEvent[];
  commonEvents?: Project["commonEvents"];
  variables?: Project["variables"];
  switches?: Project["switches"];
  endings?: Project["endings"];
  uploaded?: Project["assets"]["uploaded"];
  commands?: Command[];
}

function resolvePageId(project: Project, mapId: string, eventId: string, pageId?: string): string | undefined {
  const selector = pageId?.match(/^pages\[(\d+)\]$/u);
  if (!selector) return pageId;
  const pages = project.maps[mapId]?.events.find(event => event.id === eventId)?.pages;
  return pages?.[Number(selector[1])]?.id ?? pageId;
}

export function resolveTarget(project: Project, selector: TargetSelector): SmallTaskTarget {
  const mapId = selector.kind === "dbEntry" ? undefined : selector.mapId ?? project.startMapId;
  const target = selector.kind === "dbEntry" ? dbTarget(project, selector.collection, selector.id)
    : selector.kind === "event" ? mapTarget(project, mapId!, selector.eventId, resolvePageId(project, mapId!, selector.eventId, selector.pageId))
    : mapTarget(project, mapId!);
  if (!target && selector.kind === "dbEntry" && selector.collection === "equipmentSlots") {
    const slot = BUILTIN_EQUIPMENT_SLOTS.find(row => row.id === selector.id);
    if (slot) return { ...selector, label: `${DATABASE_AREA_LABELS.equipmentSlots} · ${slot.label}` };
  }
  if (!target) throw new PrimitiveError("검수 자료에서 작업 대상을 찾을 수 없어요.");
  return target;
}

/** Read own properties, array positions (negative from the end), and array rows by id. */
export function readCheckPath(root: unknown, path: string): unknown {
  const tokens = /(?:^|\.)([^.[\]]+)|\[(-?\d+)\]|\[id=([^\]]+)\]/gy;
  let value = root;
  let offset = 0;
  for (let match = tokens.exec(path); match; match = tokens.exec(path)) {
    const [, field, position, id] = match;
    offset = tokens.lastIndex;
    if (field !== undefined) {
      value = value !== null && typeof value === "object" && Object.hasOwn(value, field)
        ? Reflect.get(value, field) : undefined;
    } else if (Array.isArray(value)) {
      value = position !== undefined ? value.at(Number(position))
        : value.find(row => row !== null && typeof row === "object" && Object.hasOwn(row, "id") && row.id === id);
    } else {
      value = undefined;
    }
  }
  if (!path || offset !== path.length || path[0] === "." || path[0] === "[") throw new Error(`잘못된 검수 경로: ${path}`);
  return value;
}
