/** Observation-only bus. No storage, network, payload construction or QA capability. */
export const DIAGNOSTIC_CATEGORIES = ["conversation", "authoring", "movement", "collision", "event", "transfer", "asset", "warning", "error"] as const;
export type DiagnosticCategory = typeof DIAGNOSTIC_CATEGORIES[number];
type Observer = { readonly categories: ReadonlySet<DiagnosticCategory>; readonly receive: (input: unknown) => void };
let observer: Observer | undefined;
let token: symbol | undefined;
export function diagnosticToken(): symbol | undefined { return token; }
export function diagnosticObserved(category: DiagnosticCategory): boolean {
  return observer?.categories.has(category) ?? false;
}
export function publishDiagnostic(input: unknown): void { observer?.receive(input); }
export function observeDiagnostics(categories: ReadonlySet<DiagnosticCategory>, receive: (input: unknown) => void): () => void {
  const owner = { categories, receive };
  observer = owner;
  token = Symbol();
  return () => { if (observer === owner) { observer = undefined; token = undefined; } };
}
