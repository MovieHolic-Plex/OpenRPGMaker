import type { SmallTaskScope } from "@/ai/smallTaskScope";
import type { SmallTaskDraftSource } from "@/ai/smallTaskReferences";
import type { JsonSchema } from "@/editor/tools/types";
import type { CommandKind, ConditionKind } from "@/project/commandKindRegistry";
import type { Project } from "@/project/types";
import type { SmallTaskTarget } from "../target";

export interface PrimitiveContext {
  /** Baseline for comparisons. Copy each path you edit before writing to it. */
  readonly project: Readonly<Project>;
  /** Host snapshot for reference checks, including events still open in the editor. */
  readonly live?: SmallTaskDraftSource;
  readonly target: SmallTaskTarget;
  readonly selection?: { readonly rect?: { x: number; y: number; w: number; h: number } };
}

export interface PrimitiveCovers {
  commandKinds?: readonly CommandKind[];
  m2Ids?: readonly string[];
  conditionKinds?: readonly ConditionKind[];
  collections?: readonly string[];
  tools?: readonly string[];
}

export interface SmallTaskPrimitive<A extends Record<string, unknown> = Record<string, unknown>> {
  readonly id: string;
  readonly unit: string;
  readonly title: string;
  readonly covers: PrimitiveCovers;
  readonly targets: readonly SmallTaskTarget["kind"][];
  readonly args: JsonSchema;
  readonly aliasOf?: string;
  readonly hidden?: boolean;
  scope(ctx: PrimitiveContext, args: A): SmallTaskScope;
  describe(ctx: PrimitiveContext, args: A): string;
  apply(ctx: PrimitiveContext, args: A): Project;
}
