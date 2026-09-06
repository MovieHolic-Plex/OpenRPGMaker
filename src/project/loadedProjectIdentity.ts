import type { SupabaseProjectConfig } from "./supabaseProjectConfig";

/** Kept outside exported project JSON and independent of editor/AI runtime code. */
export interface LoadedProjectIdentity { readonly backend: string; readonly projectId: string }
export function sameProjectIdentity(a: LoadedProjectIdentity | null, b: LoadedProjectIdentity | null): boolean {
  return a !== null && b !== null && a.backend === b.backend && a.projectId === b.projectId;
}
export async function connectionProjectIdentity(config: SupabaseProjectConfig): Promise<LoadedProjectIdentity> {
  let backend: string;
  if (config.url === "/supabase") {
    const response = await fetch("/api/ai-jobs/session", { cache: "no-store" });
    if (!response.ok) throw new Error("Cannot establish configured backend identity");
    const session = await response.json() as { configuredBackend?: string };
    if (!session.configuredBackend) throw new Error("Proxy backend identity unavailable");
    backend = session.configuredBackend;
  } else {
    const url = new URL(config.url);
    url.username = ""; url.password = ""; url.search = ""; url.hash = "";
    backend = `supabase:${url.href.replace(/\/+$/, "")}:rpg_zzu`;
  }
  return { backend, projectId: config.projectId };
}
