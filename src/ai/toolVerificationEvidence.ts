import { parseToolVerdict, VERIFICATION_TOOL_NAMES, type ToolResultLike, type Verdict } from "./agentVerification";

function stableKey(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)))
      : entry);
}

/** Scoped by the session to a work item or goal, including continuations. */
export class ToolVerificationEvidence {
  private readonly checks = new Map<string, { name: string; verdict: Verdict; stale: boolean; executionFailed: boolean; explicit: boolean }>();

  clear(): void {
    this.checks.clear();
  }

  observe(name: string, args: Record<string, unknown>, result: ToolResultLike, source: "explicit" | "advisory" = "explicit"): Verdict | null {
    if (!VERIFICATION_TOOL_NAMES.has(name)) return null;
    const verdict = parseToolVerdict(name, result);
    // A corrected invocation supersedes transport/argument errors, which did not
    // check any artifact. Actual negative verdicts remain tied to their targets.
    if (result.ok === true) {
      for (const [key, check] of this.checks) {
        if (check.name === name && check.executionFailed) this.checks.delete(key);
      }
    }
    const key = stableKey([name, args]);
    const explicit = source === "explicit" || this.checks.get(key)?.explicit === true;
    // A clean automatic check resolves its own prior finding but never creates
    // a new required check after later writes. Preserve explicit check history.
    if (source === "advisory" && verdict.pass && !explicit) this.checks.delete(key);
    else this.checks.set(key, { name, verdict, stale: false, executionFailed: result.ok !== true, explicit });
    return verdict;
  }

  invalidateAfterWrite(): void {
    for (const check of this.checks.values()) {
      if (check.explicit) check.stale = true;
    }
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
