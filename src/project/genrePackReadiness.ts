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
  schemaVersion: 1;
  packId: PackId;
  /** SHA-256 of the canonical serialized project this evidence was captured against. */
  projectRevision: string;
  assertions: readonly GenrePackAssertion[];
  screenshots?: readonly string[];
}>;

export type GenrePackCommandCheck<CommandId, Context extends string> = Readonly<{
  commandId: CommandId;
  context: Context;
  actual: GenrePackCommandSupport;
  passed: boolean;
}>;

export type GenrePackAuthoredCommandCheck<CommandId, Context extends string> = Readonly<{
  commandId: CommandId;
  context: Context;
  present: boolean;
}>;

export type GenrePackReadinessReceipt<PackId extends string, CommandId, Context extends string> = Readonly<{
  packId: PackId;
  status: GenrePackReadinessStatus;
  commandChecks: readonly GenrePackCommandCheck<CommandId, Context>[];
  authoredCommandChecks: readonly GenrePackAuthoredCommandCheck<CommandId, Context>[];
  blockingLintIssues: readonly GenrePackLintIssue[];
  observedLintIssues: readonly GenrePackLintIssue[];
  missingAssertions: readonly string[];
  failedAssertions: readonly string[];
  invalidAssertions: readonly string[];
  invalidReceiptReasons: readonly string[];
}>;

export type GenrePackReadinessMatrix<PackId extends string, CommandId, Context extends string> = Readonly<{
  ready: boolean;
  packs: Readonly<Record<PackId, GenrePackReadinessReceipt<PackId, CommandId, Context>>>;
}>;

export function evaluateGenrePackReadiness<PackId extends string, CommandId, Context extends string>(input: {
  readonly requirement: GenrePackRequirement<PackId, CommandId, Context>;
  readonly resolveCommandSupport: (commandId: CommandId, context: Context) => GenrePackCommandSupport;
  readonly resolveAuthoredCommand: (commandId: CommandId, context: Context) => boolean;
  readonly lintIssues: readonly GenrePackLintIssue[];
  readonly assertionReceipt?: GenrePackAssertionReceipt<PackId>;
  readonly expectedProjectRevision?: string;
}): GenrePackReadinessReceipt<PackId, CommandId, Context> {
  const commandChecks = input.requirement.requiredCommands.map(({ commandId, context }) => {
    const actual = input.resolveCommandSupport(commandId, context);
    return { commandId, context, actual, passed: actual === "full" };
  });
  const authoredCommandChecks = input.requirement.requiredCommands.map(({ commandId, context }) => ({
    commandId,
    context,
    present: input.resolveAuthoredCommand(commandId, context),
  }));
  const blockingLintIssues = input.lintIssues.filter((issue) => isBlockingLintIssue(input.requirement, issue));
  const assertionState = inspectAssertions(input.requirement.requiredAssertions, input.assertionReceipt?.assertions ?? []);
  const invalidReceiptReasons = inspectReceipt(
    input.assertionReceipt,
    input.requirement.packId,
    input.expectedProjectRevision
  );
  const blocked = commandChecks.some((check) => !check.passed)
    || blockingLintIssues.length > 0
    || assertionState.failedAssertions.length > 0
    || assertionState.invalidAssertions.length > 0
    || invalidReceiptReasons.length > 0;
  const status: GenrePackReadinessStatus = blocked
    ? "blocked"
    : assertionState.missingAssertions.length > 0 || authoredCommandChecks.some((check) => !check.present)
      ? "incomplete"
      : "ready";
  return {
    packId: input.requirement.packId,
    status,
    commandChecks,
    authoredCommandChecks,
    blockingLintIssues,
    observedLintIssues: input.lintIssues,
    ...assertionState,
    invalidReceiptReasons,
  };
}

export function evaluateGenrePackReadinessMatrix<PackId extends string, CommandId, Context extends string>(input: {
  readonly requirements: Readonly<Record<PackId, GenrePackRequirement<PackId, CommandId, Context>>>;
  readonly resolveCommandSupport: (commandId: CommandId, context: Context) => GenrePackCommandSupport;
  readonly resolveAuthoredCommand: (commandId: CommandId, context: Context) => boolean;
  readonly lintIssues: readonly GenrePackLintIssue[];
  readonly assertionReceipts?: Readonly<Partial<Record<PackId, GenrePackAssertionReceipt<PackId>>>>;
  readonly expectedProjectRevision?: string;
}): GenrePackReadinessMatrix<PackId, CommandId, Context> {
  const packs = {} as Record<PackId, GenrePackReadinessReceipt<PackId, CommandId, Context>>;
  for (const [packId, requirement] of Object.entries(input.requirements) as Array<[
    PackId,
    GenrePackRequirement<PackId, CommandId, Context>,
  ]>) {
    packs[packId] = evaluateGenrePackReadiness({
      requirement,
      resolveCommandSupport: input.resolveCommandSupport,
      resolveAuthoredCommand: input.resolveAuthoredCommand,
      lintIssues: input.lintIssues,
      assertionReceipt: input.assertionReceipts?.[packId],
      expectedProjectRevision: input.expectedProjectRevision,
    });
  }
  const receipts = Object.values(packs) as Array<GenrePackReadinessReceipt<PackId, CommandId, Context>>;
  return { ready: receipts.length > 0 && receipts.every((receipt) => receipt.status === "ready"), packs };
}

function inspectReceipt<PackId extends string>(
  receipt: GenrePackAssertionReceipt<PackId> | undefined,
  expectedPackId: PackId,
  expectedProjectRevision: string | undefined
): readonly string[] {
  if (receipt === undefined) return [];
  if (!isGenrePackAssertionReceipt(receipt)) return ["invalid-receipt-schema"];
  const reasons: string[] = [];
  if (receipt.packId !== expectedPackId) reasons.push("pack-id-mismatch");
  if (expectedProjectRevision !== undefined && receipt.projectRevision !== expectedProjectRevision) {
    reasons.push("project-revision-mismatch");
  }
  return reasons;
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
  receipts: readonly unknown[],
  options: Readonly<{
    expectedProjectRevision?: string;
    validateEvidence?: (
      assertion: GenrePackAssertion,
      receipt: GenrePackAssertionReceipt<string>,
      receiptIndex: number
    ) => Readonly<{ ok: boolean; code?: string }>;
  }> = {}
): Readonly<{
  ok: boolean;
  invalidReceiptIndexes: readonly number[];
  unknownPackIds: readonly string[];
  receiptErrors: readonly Readonly<{ receiptIndex: number; code: string; assertionId?: string }>[];
  packs: Readonly<Record<PackId, Readonly<{
    ok: boolean;
    missingAssertions: readonly string[];
    failedAssertions: readonly string[];
    invalidAssertions: readonly string[];
  }>>>;
}> {
  const validReceipts: Array<{ receipt: GenrePackAssertionReceipt<string>; index: number }> = [];
  const invalidReceiptIndexes: number[] = [];
  const receiptErrors: Array<{ receiptIndex: number; code: string; assertionId?: string }> = [];
  receipts.forEach((receipt, index) => {
    if (isGenrePackAssertionReceipt(receipt)) {
      validReceipts.push({ receipt, index });
      if (options.expectedProjectRevision !== undefined && receipt.projectRevision !== options.expectedProjectRevision) {
        receiptErrors.push({ receiptIndex: index, code: "project-revision-mismatch" });
      }
      for (const assertion of receipt.assertions) {
        const validation = options.validateEvidence?.(assertion, receipt, index) ?? {
          ok: false,
          code: "evidence-validation-missing",
        };
        if (!validation.ok) {
          receiptErrors.push({
            receiptIndex: index,
            assertionId: assertion.assertionId,
            code: validation.code ?? "invalid-evidence",
          });
        }
      }
    } else {
      invalidReceiptIndexes.push(index);
      receiptErrors.push({ receiptIndex: index, code: "invalid-receipt-schema" });
    }
  });
  const knownPackIds = new Set(Object.keys(requirements));
  const unknownPackIds = [...new Set(validReceipts
    .map(({ receipt }) => receipt.packId)
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
    const matches = validReceipts.filter(({ receipt }) => receipt.packId === packId);
    const evidenceInvalidAssertions = matches.flatMap(({ index }) => receiptErrors
      .filter((error) => error.receiptIndex === index && error.assertionId !== undefined)
      .map((error) => error.assertionId!));
    const assertionState = inspectAssertions(
      requirement.requiredAssertions,
      matches.flatMap(({ receipt }) => receipt.assertions)
    );
    const invalidAssertions = matches.length > 1
      ? [...new Set([...assertionState.invalidAssertions, ...evidenceInvalidAssertions, "duplicate-pack-receipt"])]
      : [...new Set([...assertionState.invalidAssertions, ...evidenceInvalidAssertions])];
    const receiptIndexes = new Set(matches.map(({ index }) => index));
    const hasReceiptError = receiptErrors.some((error) => receiptIndexes.has(error.receiptIndex));
    packs[packId] = {
      ok: matches.length === 1
        && assertionState.missingAssertions.length === 0
        && assertionState.failedAssertions.length === 0
        && invalidAssertions.length === 0
        && !hasReceiptError,
      ...assertionState,
      invalidAssertions,
    };
  }
  return {
    ok: invalidReceiptIndexes.length === 0
      && unknownPackIds.length === 0
      && receiptErrors.length === 0
      && (Object.values(packs) as Array<{ readonly ok: boolean }>).every((pack) => pack.ok),
    invalidReceiptIndexes,
    unknownPackIds,
    receiptErrors,
    packs,
  };
}

export function isGenrePackAssertionReceipt(value: unknown): value is GenrePackAssertionReceipt<string> {
  if (!isRecord(value) || !hasExactKeys(value, ["schemaVersion", "packId", "projectRevision", "assertions", "screenshots"])) {
    return false;
  }
  if (value.schemaVersion !== 1
    || typeof value.packId !== "string"
    || typeof value.projectRevision !== "string"
    || !/^[a-f0-9]{64}$/.test(value.projectRevision)
    || !Array.isArray(value.assertions)) return false;
  if (value.screenshots !== undefined && (!Array.isArray(value.screenshots)
    || !value.screenshots.every((entry) => typeof entry === "string"))) return false;
  return value.assertions.every((assertion) => isRecord(assertion)
    && hasExactKeys(assertion, ["assertionId", "status", "evidence"])
    && typeof assertion.assertionId === "string"
    && (assertion.status === "passed" || assertion.status === "failed")
    && (assertion.evidence === undefined || typeof assertion.evidence === "string"));
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed);
  return Object.keys(value).every((key) => allowedSet.has(key));
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
