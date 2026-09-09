import assert from "node:assert/strict";
import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { literal, SqlSession } from "./spatial-db-session.mts";

export class GuardRejectionMismatch extends Error {
  constructor(readonly actual: number, readonly expected: number) { super(`GUARD_REJECTION_MISMATCH expected=${expected} actual=${actual}`); }
}
export function requireStatus(actual: number, expected: number): void {
  if (actual !== expected) throw new GuardRejectionMismatch(actual, expected);
}
export type GuardMutation = { readonly name: string; readonly functionName: string;
  readonly remove: string; readonly replacement: string };

/** Mutation is committed only inside the disposable DB, never in product source. */
export async function proveGuard(input: { readonly evidence: string; readonly mutation: GuardMutation },
  check: (phase: "red" | "green") => Promise<void>): Promise<void> {
  await using sql = new SqlSession();
  const signature = input.mutation.functionName;
  const [encoded] = await sql.query(`SELECT to_json(pg_get_functiondef(${literal(signature)}::regprocedure));`);
  assert(encoded);
  const original: unknown = JSON.parse(encoded); assert.equal(typeof original, "string");
  assert(typeof original === "string");
  assert.equal(original.split(input.mutation.remove).length, 2, "Mutation must target exactly one guard");
  const mutated = original.replace(input.mutation.remove, input.mutation.replacement);
  await appendFile(resolve(input.evidence, "guard-definitions.jsonl"), JSON.stringify({ name: input.mutation.name, original, mutated }) + "\n");
  await sql.query(`${mutated};`);
  try {
    let rejection: GuardRejectionMismatch | undefined;
    try { await check("red"); }
    catch (error) {
      if (!(error instanceof GuardRejectionMismatch)) throw error;
      rejection = error;
    }
    assert(rejection, `Guard mutation was insensitive: ${input.mutation.name}`);
    assert(rejection.actual >= 200 && rejection.actual < 300, "RED requires unsafe acceptance, not an incidental error");
    await appendFile(resolve(input.evidence, "mutation-red.log"), `${input.mutation.name}: ${rejection.stack}\n`);
  } finally {
    await sql.query(`${original};`);
    const restored = await sql.query(`SELECT to_json(pg_get_functiondef(${literal(signature)}::regprocedure));`);
    assert.deepEqual(restored, [encoded], "Exact original database function must be restored");
  }
  await check("green");
  await appendFile(resolve(input.evidence, "green.log"), `${input.mutation.name}: unchanged assertion GREEN after exact function restore\n`);
}
const publication = "rpg_zzu.publish_spatial_project(text,text,jsonb,text,jsonb)";
export const guards = {
  stale: { name: "loaded-sha", functionName: publication,
    remove: "root.current_sha256 IS DISTINCT FROM p_expected_sha256", replacement: "false" },
  version: { name: "spatial-version", functionName: publication,
    remove: "marker->'version' = '1'::jsonb", replacement: "true" },
  root: { name: "sticky-root-fence", functionName: "rpg_zzu.spatial_guard_write()",
    remove: "IF current_user = 'spatial_project_writer' THEN", replacement: "IF current_user = 'spatial_project_writer' OR TG_TABLE_NAME='projects' THEN" },
  mirror: { name: "sticky-mirror-fence", functionName: "rpg_zzu.spatial_guard_write()",
    remove: "IF current_user = 'spatial_project_writer' THEN", replacement: "IF current_user = 'spatial_project_writer' OR TG_TABLE_NAME='maps' THEN" },
  baseline: { name: "effective-raw-baseline", functionName: publication,
    remove: "IF baseline IS DISTINCT FROM p_legacy_baseline THEN", replacement: "baseline := p_legacy_baseline;\n      IF baseline IS DISTINCT FROM p_legacy_baseline THEN" },
  create: { name: "insert-only-create", functionName: publication,
    remove: "IF p_operation='create' THEN\n    BEGIN", replacement: "IF p_operation='create' AND EXISTS (SELECT FROM rpg_zzu.projects WHERE project_id=p_project_id) THEN\n    p_operation := 'update';\n    SELECT current_sha256 INTO p_expected_sha256 FROM rpg_zzu.projects WHERE project_id=p_project_id;\n  END IF;\n  IF p_operation='create' THEN\n    BEGIN" },
} as const satisfies Readonly<Record<string, GuardMutation>>;
