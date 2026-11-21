import type { Command, Project } from "@/project/types";
import type { SmallTaskTarget } from "../target";
import type { PrimitiveContext } from "./types";

export type SmallTaskDbEntryTarget = Extract<SmallTaskTarget, { kind: "dbEntry" }>;

export interface SmallTaskRefusalInput {
  readonly stoppedEarly: string;
  readonly before: Project;
  readonly target: SmallTaskTarget;
  readonly live?: Project;
}

/**
 * Optional contribution from one unit module. The registration file collects these.
 * Core calls the collected lists and never names a unit.
 */
export interface SmallTaskUnitHost {
  readonly commandDeletionGuard?: (ctx: PrimitiveContext, list: readonly Command[], command: Command) => void;
  readonly onM2CommandDelete?: (
    ctx: PrimitiveContext, commandId: string, list: readonly Command[], index: number, command: Command,
  ) => void;
  readonly commit?: {
    readonly beforeCommonEvents?: (live: Project, before: Project, after: Project, target: SmallTaskTarget) => void;
    readonly onRemovedCommonEvent?: (after: Project, id: string, live: Project) => void;
    readonly beforeDbEntryGuards?: (
      before: Project, after: Project, target: SmallTaskDbEntryTarget, live: Project,
    ) => void;
    readonly afterDbEntryGuards?: (
      before: Project, after: Project, live: Project, target: SmallTaskDbEntryTarget,
    ) => void;
    readonly onRemovedMap?: (before: Project, mapId: string, live: Project) => string | undefined;
  };
  readonly explainRefusal?: (input: SmallTaskRefusalInput) => string | undefined;
}

export interface SmallTaskHost {
  readonly commandDeletionGuard: NonNullable<SmallTaskUnitHost["commandDeletionGuard"]>;
  readonly m2CommandDeleteGuards: readonly NonNullable<SmallTaskUnitHost["onM2CommandDelete"]>[];
  readonly beforeCommonEvents: readonly NonNullable<NonNullable<SmallTaskUnitHost["commit"]>["beforeCommonEvents"]>[];
  readonly onRemovedCommonEvent: readonly NonNullable<NonNullable<SmallTaskUnitHost["commit"]>["onRemovedCommonEvent"]>[];
  readonly beforeDbEntryGuards: readonly NonNullable<NonNullable<SmallTaskUnitHost["commit"]>["beforeDbEntryGuards"]>[];
  readonly afterDbEntryGuards: readonly NonNullable<NonNullable<SmallTaskUnitHost["commit"]>["afterDbEntryGuards"]>[];
  readonly onRemovedMap: readonly NonNullable<NonNullable<SmallTaskUnitHost["commit"]>["onRemovedMap"]>[];
  explainRefusal(input: SmallTaskRefusalInput): string | undefined;
}

function list<T>(units: readonly unknown[], pick: (host: SmallTaskUnitHost) => T | undefined): T[] {
  return units.flatMap(unit => {
    const host = hostOf(unit);
    const value = host ? pick(host) : undefined;
    return value === undefined ? [] : [value];
  });
}

function hostOf(unit: unknown): SmallTaskUnitHost | undefined {
  if (!unit || typeof unit !== "object" || !("host" in unit)) return undefined;
  const host = unit.host;
  return host && typeof host === "object" ? host as SmallTaskUnitHost : undefined;
}

/** Fold unit hosts in registration order. Each slot keeps the order units were registered. */
export function collectSmallTaskHost(units: readonly unknown[]): SmallTaskHost {
  const guards = list(units, host => host.commandDeletionGuard);
  if (guards.length === 0) throw new Error("작은 일 명령 삭제 검사가 등록되지 않았습니다.");
  const hosts = units.flatMap(unit => {
    const host = hostOf(unit);
    return host ? [host] : [];
  });
  return {
    commandDeletionGuard: guards.length === 1 ? guards[0]! : (ctx, listCommands, command) => {
      for (const guard of guards) guard(ctx, listCommands, command);
    },
    m2CommandDeleteGuards: list(units, host => host.onM2CommandDelete),
    beforeCommonEvents: list(units, host => host.commit?.beforeCommonEvents),
    onRemovedCommonEvent: list(units, host => host.commit?.onRemovedCommonEvent),
    beforeDbEntryGuards: list(units, host => host.commit?.beforeDbEntryGuards),
    afterDbEntryGuards: list(units, host => host.commit?.afterDbEntryGuards),
    onRemovedMap: list(units, host => host.commit?.onRemovedMap),
    explainRefusal(input) {
      for (const host of hosts) {
        const message = host.explainRefusal?.(input);
        if (message) return message;
      }
      return undefined;
    },
  };
}
