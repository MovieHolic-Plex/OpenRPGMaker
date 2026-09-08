import { LocalDiagnosticSession, type DiagnosticCategory } from "@/util/localDiagnosticSession";
import { subscribeEditActivity } from "@/editor/editActivityLog";
import { subscribeLogs } from "@/util/logger";
import { store } from "@/project/store";
import { publishDiagnostic } from "@/util/diagnosticObserver";
export const localDiagnostics = new LocalDiagnosticSession();
let sources: (() => void)[] = [];
let projectLifetime: (() => void) | undefined;
localDiagnostics.subscribe(() => {
  const state = localDiagnostics.snapshot();
  if (!state.active) { for (const detach of sources) detach(); sources = []; }
  if (!state.sessionId) { projectLifetime?.(); projectLifetime = undefined; }
});
export function startLocalDiagnostics(consent: boolean, categories: readonly DiagnosticCategory[]): boolean {
  if (!localDiagnostics.start(consent, categories)) return false;
  projectLifetime = store.subscribe((_project, change) => { if (change.projectSwitch) localDiagnostics.clear(); });
  if (categories.includes("authoring")) sources.push(subscribeEditActivity(entry => publishDiagnostic({
    category: "authoring", phase: "written", generation: entry.generation,
    scope: entry.scope, origin: entry.origin,
  })));
  if (categories.includes("warning") || categories.includes("error")) sources.push(subscribeLogs(entry => {
    if (entry.level === "warn" || entry.level === "error") publishDiagnostic({
      category: entry.level === "warn" ? "warning" : "error", phase: "reported",
    });
  }));
  return true;
}
