import type { SupabaseProjectConfig } from "../supabaseProjectConfig";
import { resolveBrowserSupabaseUrl } from "../supabaseProxyPath";
import { SpatialPersistenceError, type RawJson, type RawObject } from "./persistenceTypes";
import { rawJson } from "./persistenceWire";

type SpatialRequest = {
  readonly path: string;
  readonly body?: RawObject;
  readonly signal?: AbortSignal;
};
/** Match existing Supabase config/profile/proxy behavior, but never its upsert preference.
 * Native fetch is the repository's installed transport; this seam adds bounded cancellation,
 * explicit HTTP errors and zero retries without adding a dependency or editable authority.
 */
export async function requestSpatialJson(config: SupabaseProjectConfig, request: SpatialRequest): Promise<RawJson> {
  const url = resolveBrowserSupabaseUrl(config.url, { pageProtocol: typeof window === "undefined" ? undefined : window.location?.protocol });
  if (!config.projectId.trim()) throw new SpatialPersistenceError("invalid-project", "Publication requires an explicit project target.");
  const timeout = AbortSignal.timeout(30_000);
  const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;
  const response = await fetch(`${url}/rest/v1/${request.path}`, {
    method: request.body === undefined ? "GET" : "POST",
    headers: {
      apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, Accept: "application/json",
      ...(request.body === undefined ? { "Accept-Profile": "rpg_zzu" } : { "Content-Profile": "rpg_zzu", "Content-Type": "application/json" }),
    },
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
    signal, redirect: "error",
  });
  const text = await response.text();
  if (response.status === 409) throw new SpatialPersistenceError("conflict", text, 409);
  let decoded: unknown;
  try { decoded = JSON.parse(text); }
  catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new SpatialPersistenceError(response.ok ? "invalid-response" : "http", text, response.status);
  }
  const parsed = rawJson(decoded);
  if (!response.ok) {
    const code = parsed && typeof parsed === "object" && "code" in parsed ? parsed.code : undefined;
    if (request.path.startsWith("rpc/") && (code === "PGRST202" || code === "42883")) {
      throw new SpatialPersistenceError("migration-required", "Apply 20260907000000_spatial_authoring_cas.sql before spatial publication.", response.status);
    }
    throw new SpatialPersistenceError("http", text, response.status);
  }
  return parsed;
}
