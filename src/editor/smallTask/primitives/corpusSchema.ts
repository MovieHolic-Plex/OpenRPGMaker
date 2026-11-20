import type { Project } from "@/project/types";
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

export interface CorpusSetup {
  events?: Project["maps"][string]["events"];
  variables?: Project["variables"];
  commonEvents?: Project["commonEvents"];
  system?: Partial<Project["system"]>;
  database?: Partial<Project["database"]>;
}

export interface CorpusCase {
  request: string;
  fixture: FixtureName;
  setup?: CorpusSetup;
  target: TargetSelector;
  selection?: PrimitiveContext["selection"];
  primitive: string;
  args: Record<string, unknown>;
  expect?: Check[];
  expectRefusal?: true;
  refusalMessage?: string;
}

export function resolveTarget(project: Project, selector: TargetSelector): SmallTaskTarget {
  const mapId = selector.kind === "dbEntry" ? undefined : selector.mapId ?? project.startMapId;
  const target = selector.kind === "dbEntry" ? dbTarget(project, selector.collection, selector.id)
    : selector.kind === "event" ? mapTarget(project, mapId!, selector.eventId, selector.pageId)
    : mapTarget(project, mapId!);
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
