export type GenrePackCommandSupport = "full" | "partial" | "editorOnly" | "missing";
export type GenrePackReadinessStatus = "blocked" | "incomplete" | "ready";
export type GenrePackAssertionStatus = "passed" | "failed";

export type GenrePackCommandRequirement<CommandId, Context extends string> = Readonly<{
  commandId: CommandId;
  context: Context;
}>;

export type GenrePackRequirement<PackId extends string, CommandId, Context extends string> = Readonly<{
  packId: PackId;
  label: string;
  requiredCommands: readonly GenrePackCommandRequirement<CommandId, Context>[];
  requiredAssertions: readonly string[];
  blockingLintCodePrefixes?: readonly string[];
}>;

export type GenrePackLintIssue = Readonly<{
  severity: "error" | "warning" | "info";
  code: string;
  message?: string;
}>;

export type GenrePackAssertion = Readonly<{
  assertionId: string;
  status: GenrePackAssertionStatus;
  evidence?: string;
}>;

export type GenrePackAssertionReceipt<PackId extends string> = Readonly<{
  packId: PackId;
  assertions: readonly GenrePackAssertion[];
  screenshots?: readonly string[];
}>;

export type GenrePackCommandCheck<CommandId, Context extends string> = Readonly<{
  commandId: CommandId;
  context: Context;
  actual: GenrePackCommandSupport;
  passed: boolean;
}>;

export type GenrePackReadinessReceipt<PackId extends string, CommandId, Context extends string> = Readonly<{
  packId: PackId;
  status: GenrePackReadinessStatus;
  commandChecks: readonly GenrePackCommandCheck<CommandId, Context>[];
  blockingLintIssues: readonly GenrePackLintIssue[];
  observedLintIssues: readonly GenrePackLintIssue[];
  missingAssertions: readonly string[];
  failedAssertions: readonly string[];
  invalidAssertions: readonly string[];
}>;

export type GenrePackReadinessMatrix<PackId extends string, CommandId, Context extends string> = Readonly<{
  ready: boolean;
  packs: Readonly<Record<PackId, GenrePackReadinessReceipt<PackId, CommandId, Context>>>;
}>;

export function evaluateGenrePackReadiness<PackId extends string, CommandId, Context extends string>(input: {
  readonly requirement: GenrePackRequirement<PackId, CommandId, Context>;
  readonly resolveCommandSupport: (commandId: CommandId, context: Context) => GenrePackCommandSupport;
  readonly lintIssues: readonly GenrePackLintIssue[];
  readonly assertionReceipt?: GenrePackAssertionReceipt<PackId>;
}): GenrePackReadinessReceipt<PackId, CommandId, Context> {
  const commandChecks = input.requirement.requiredCommands.map(({ commandId, context }) => {
    const actual = input.resolveCommandSupport(commandId, context);
    return { commandId, context, actual, passed: actual === "full" };
  });
  const blockingLintIssues = input.lintIssues.filter((issue) => isBlockingLintIssue(input.requirement, issue));
  const assertionState = inspectAssertions(input.requirement.requiredAssertions, input.assertionReceipt?.assertions ?? []);
  const blocked = commandChecks.some((check) => !check.passed)
    || blockingLintIssues.length > 0
    || assertionState.failedAssertions.length > 0
    || assertionState.invalidAssertions.length > 0;
  const status: GenrePackReadinessStatus = blocked
    ? "blocked"
    : assertionState.missingAssertions.length > 0
      ? "incomplete"
      : "ready";
  return {
    packId: input.requirement.packId,
    status,
    commandChecks,
    blockingLintIssues,
    observedLintIssues: input.lintIssues,
    ...assertionState,
  };
}

export function evaluateGenrePackReadinessMatrix<PackId extends string, CommandId, Context extends string>(input: {
  readonly requirements: Readonly<Record<PackId, GenrePackRequirement<PackId, CommandId, Context>>>;
  readonly resolveCommandSupport: (commandId: CommandId, context: Context) => GenrePackCommandSupport;
  readonly lintIssues: readonly GenrePackLintIssue[];
  readonly assertionReceipts?: Readonly<Partial<Record<PackId, GenrePackAssertionReceipt<PackId>>>>;
}): GenrePackReadinessMatrix<PackId, CommandId, Context> {
  const packs = {} as Record<PackId, GenrePackReadinessReceipt<PackId, CommandId, Context>>;
  for (const [packId, requirement] of Object.entries(input.requirements) as Array<[
    PackId,
    GenrePackRequirement<PackId, CommandId, Context>,
  ]>) {
    packs[packId] = evaluateGenrePackReadiness({
      requirement,
      resolveCommandSupport: input.resolveCommandSupport,
      lintIssues: input.lintIssues,
      assertionReceipt: input.assertionReceipts?.[packId],
    });
  }
  const receipts = Object.values(packs) as Array<GenrePackReadinessReceipt<PackId, CommandId, Context>>;
  return { ready: receipts.length > 0 && receipts.every((receipt) => receipt.status === "ready"), packs };
}

function isBlockingLintIssue<PackId extends string, CommandId, Context extends string>(
  requirement: GenrePackRequirement<PackId, CommandId, Context>,
  issue: GenrePackLintIssue
): boolean {
  if (issue.severity === "error") return true;
  return (requirement.blockingLintCodePrefixes ?? []).some((prefix) => issue.code.startsWith(prefix));
}

function inspectAssertions(required: readonly string[], assertions: readonly GenrePackAssertion[]): {
  readonly missingAssertions: readonly string[];
  readonly failedAssertions: readonly string[];
  readonly invalidAssertions: readonly string[];
} {
  const missingAssertions: string[] = [];
  const failedAssertions: string[] = [];
  const invalidAssertions: string[] = [];
  for (const assertionId of required) {
    const matches = assertions.filter((assertion) => assertion.assertionId === assertionId);
    if (matches.length === 0) {
      missingAssertions.push(assertionId);
      continue;
    }
    if (matches.length > 1) invalidAssertions.push(assertionId);
    if (matches.some((assertion) => assertion.status === "failed")) {
      failedAssertions.push(assertionId);
      continue;
    }
    if (!matches.some((assertion) => assertion.status === "passed" && assertion.evidence?.trim())) {
      invalidAssertions.push(assertionId);
    }
  }
  return {
    missingAssertions,
    failedAssertions: [...new Set(failedAssertions)],
    invalidAssertions: [...new Set(invalidAssertions)],
  };
}

export function verifyGenrePackAssertionReceipts<
  PackId extends string,
  CommandId,
  Context extends string,
>(
  requirements: Readonly<Record<PackId, GenrePackRequirement<PackId, CommandId, Context>>>,
  receipts: readonly unknown[]
): Readonly<{
  ok: boolean;
  invalidReceiptIndexes: readonly number[];
  unknownPackIds: readonly string[];
  packs: Readonly<Record<PackId, Readonly<{
    ok: boolean;
    missingAssertions: readonly string[];
    failedAssertions: readonly string[];
    invalidAssertions: readonly string[];
  }>>>;
}> {
  const validReceipts: GenrePackAssertionReceipt<string>[] = [];
  const invalidReceiptIndexes: number[] = [];
  receipts.forEach((receipt, index) => {
    if (isGenrePackAssertionReceipt(receipt)) validReceipts.push(receipt);
    else invalidReceiptIndexes.push(index);
  });
  const knownPackIds = new Set(Object.keys(requirements));
  const unknownPackIds = [...new Set(validReceipts
    .map((receipt) => receipt.packId)
    .filter((packId) => !knownPackIds.has(packId)))];
  const packs = {} as Record<PackId, {
    ok: boolean;
    missingAssertions: readonly string[];
    failedAssertions: readonly string[];
    invalidAssertions: readonly string[];
  }>;
  for (const [packId, requirement] of Object.entries(requirements) as Array<[
    PackId,
    GenrePackRequirement<PackId, CommandId, Context>,
  ]>) {
    const matches = validReceipts.filter((receipt) => receipt.packId === packId);
    const assertionState = inspectAssertions(
      requirement.requiredAssertions,
      matches.flatMap((receipt) => receipt.assertions)
    );
    const invalidAssertions = matches.length > 1
      ? [...new Set([...assertionState.invalidAssertions, "duplicate-pack-receipt"])]
      : assertionState.invalidAssertions;
    packs[packId] = {
      ok: matches.length === 1
        && assertionState.missingAssertions.length === 0
        && assertionState.failedAssertions.length === 0
        && invalidAssertions.length === 0,
      ...assertionState,
      invalidAssertions,
    };
  }
  return {
    ok: invalidReceiptIndexes.length === 0
      && unknownPackIds.length === 0
      && (Object.values(packs) as Array<{ readonly ok: boolean }>).every((pack) => pack.ok),
    invalidReceiptIndexes,
    unknownPackIds,
    packs,
  };
}

function isGenrePackAssertionReceipt(value: unknown): value is GenrePackAssertionReceipt<string> {
  if (!isRecord(value) || typeof value.packId !== "string" || !Array.isArray(value.assertions)) return false;
  if (value.screenshots !== undefined && (!Array.isArray(value.screenshots)
    || !value.screenshots.every((entry) => typeof entry === "string"))) return false;
  return value.assertions.every((assertion) => isRecord(assertion)
    && typeof assertion.assertionId === "string"
    && (assertion.status === "passed" || assertion.status === "failed")
    && (assertion.evidence === undefined || typeof assertion.evidence === "string"));
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
