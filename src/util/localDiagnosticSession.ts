import { z } from "zod";
import { DIAGNOSTIC_CATEGORIES, observeDiagnostics, type DiagnosticCategory } from "./diagnosticObserver";
export { DIAGNOSTIC_CATEGORIES, diagnosticObserved, publishDiagnostic, type DiagnosticCategory } from "./diagnosticObserver";

const count = z.number().int().min(0).max(1_000_000_000);
const coordinate = z.number().int().min(-1_000_000).max(1_000_000);
// No open strings: even a plausible-looking identifier can contain a credential.
// Zod's object projection drops every non-allowlisted property before retention.
const inputSchema = z.discriminatedUnion("category", [
  z.object({ category: z.literal("conversation"), phase: z.enum(["user", "assistant"]), count }),
  z.object({ category: z.literal("authoring"), phase: z.enum(["written", "saved"]), generation: count,
    scope: z.enum(["map", "database", "system", "assets", "project"]).optional(),
    origin: z.enum(["human", "ai", "tool", "system"]).optional(), storage: z.enum(["local", "remote"]).optional(), count: count.optional() }),
  z.object({ category: z.literal("movement"), phase: z.literal("completed"), x: coordinate, y: coordinate }),
  z.object({ category: z.literal("collision"), phase: z.enum(["terrain", "event"]), x: coordinate, y: coordinate }),
  z.object({ category: z.literal("event"), phase: z.enum(["started", "completed", "cancelled", "failed"]), count: count.optional() }),
  z.object({ category: z.literal("transfer"), phase: z.enum(["completed", "missing"]), x: coordinate.optional(), y: coordinate.optional() }),
  z.object({ category: z.literal("asset"), phase: z.enum(["assets", "ready", "missing", "error", "timeout"]), ok: z.boolean().optional(), count: count.optional() }),
  z.object({ category: z.literal("warning"), phase: z.literal("reported") }),
  z.object({ category: z.literal("error"), phase: z.literal("reported") }),
]);
type Input = z.infer<typeof inputSchema>;
export type DiagnosticReceipt = Input & {
  readonly sequence: number; readonly elapsedMs: number;
  readonly provenance: "authoring-audit" | "persistence" | "assistant-audit" | "runtime" | "logger";
  readonly evidence: "written" | "observed" | "unverified";
  readonly savedGeneration: number | null;
};
export type DiagnosticSnapshot = {
  readonly active: boolean; readonly sessionId: string | null; readonly omitted: number;
  readonly categories: readonly DiagnosticCategory[]; readonly receipts: readonly DiagnosticReceipt[];
};

export class LocalDiagnosticSession {
  private detach: (() => void) | undefined;
  private sessionId: string | null = null;
  private categories: DiagnosticCategory[] = [];
  private receipts: DiagnosticReceipt[] = [];
  private omitted = 0;
  private startedAt = 0;
  private savedGeneration: number | null = null;
  private expiry: ReturnType<typeof setTimeout> | undefined;
  private readonly listeners = new Set<() => void>();

  start(consent: boolean, categories: readonly DiagnosticCategory[]): boolean {
    if (consent !== true || categories.length === 0 || categories.some(category => !DIAGNOSTIC_CATEGORIES.includes(category))) return false;
    this.clear();
    this.sessionId = crypto.randomUUID();
    this.categories = [...new Set(categories)];
    this.startedAt = performance.now();
    this.detach = observeDiagnostics(new Set(this.categories), input => this.receive(input));
    // Retention time is itself a product limit, not a test synchronization strategy.
    this.expiry = setTimeout(() => this.clear(), 30 * 60 * 1000);
    this.notify();
    return true;
  }
  stop(): void { this.detach?.(); this.detach = undefined; this.notify(); }
  clear(): void {
    this.detach?.(); this.detach = undefined;
    clearTimeout(this.expiry); this.expiry = undefined;
    this.sessionId = null; this.receipts = []; this.categories = []; this.omitted = 0; this.savedGeneration = null;
    this.notify();
  }
  snapshot(): DiagnosticSnapshot {
    return { active: this.detach !== undefined, sessionId: this.sessionId, omitted: this.omitted,
      categories: [...this.categories], receipts: this.receipts.map(receipt => ({ ...receipt })) };
  }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(): void { for (const listener of this.listeners) listener(); }
  private receive(input: unknown): void {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success || !this.categories.includes(parsed.data.category)) return;
    const data = parsed.data;
    if (data.category === "authoring" && data.phase === "saved") this.savedGeneration = data.generation;
    const provenance = data.category === "authoring" ? (data.phase === "saved" ? "persistence" : "authoring-audit")
      : data.category === "conversation" ? "assistant-audit"
        : data.category === "warning" || data.category === "error" ? "logger" : "runtime";
    const evidence = data.category === "authoring" ? "written"
      : data.category === "conversation" || data.category === "warning" || data.category === "error" ? "unverified" : "observed";
    this.receipts.push({ ...data, sequence: this.omitted + this.receipts.length + 1,
      elapsedMs: Math.round(performance.now() - this.startedAt), provenance, evidence, savedGeneration: this.savedGeneration });
    if (this.receipts.length > 500) { this.receipts.shift(); this.omitted++; }
    this.notify();
  }
}
