import { parseToolVerdict, VERIFICATION_TOOL_NAMES, type ToolResultLike, type Verdict } from "./agentVerification";

function stableKey(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)))
      : entry);
}

/** Scoped by the session to a work item or goal, including continuations. */
export class ToolVerificationEvidence {
  private readonly checks = new Map<string, { name: string; verdict: Verdict; stale: boolean; executionFailed: boolean }>();

  clear(): void {
    this.checks.clear();
  }

  observe(name: string, args: Record<string, unknown>, result: ToolResultLike): Verdict | null {
    if (!VERIFICATION_TOOL_NAMES.has(name)) return null;
    const verdict = parseToolVerdict(name, result);
    // A corrected invocation supersedes transport/argument errors, which did not
    // check any artifact. Actual negative verdicts remain tied to their targets.
    if (result.ok === true) {
      for (const [key, check] of this.checks) {
        if (check.name === name && check.executionFailed) this.checks.delete(key);
      }
    }
    this.checks.set(stableKey([name, args]), { name, verdict, stale: false, executionFailed: result.ok !== true });
    return verdict;
  }

  invalidateAfterWrite(): void {
    for (const check of this.checks.values()) check.stale = true;
  }

  passed(name: string): boolean {
    const checks = [...this.checks.values()].filter((check) => check.name === name);
    return checks.length > 0 && checks.every((check) => check.verdict.pass && !check.stale);
  }

  problems(): readonly string[] {
    return [...new Set([...this.checks.values()].flatMap(({ name, verdict, stale }) => {
      const issues = verdict.blockingIssues.map((issue) => `${name}: ${issue}`);
      if (stale) issues.push(`${name}: 변경 후 재검증 필요`);
      return issues;
    }))];
  }
}
