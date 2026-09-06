import { isActionCombatMap } from "@/project/actionCombat";
import type { Project } from "@/project/types";

export const ACTION_COMBAT_OUTCOMES = [
  "swing-hit", "enemy-defeat", "player-damage", "dodge-rejection",
  "stamina-spent", "stamina-recovered", "enemy-projectile", "reward-granted",
] as const;
export type ActionCombatOutcome = typeof ACTION_COMBAT_OUTCOMES[number];
export type ActionCombatObservation = {
  readonly outcome: ActionCombatOutcome;
  readonly mapId: string;
  readonly sequence: number;
  readonly before: number;
  readonly after: number;
  readonly eventId?: string;
  readonly attackId?: string;
};
export type ActionCombatProofReceipt = {
  readonly version: 1;
  readonly projectFingerprint: string;
  readonly mapId: string;
  readonly scenarioId: "action-combat-v1";
  readonly runId: string;
  readonly status: "verified" | "unverified" | "cancelled" | "timeout";
  readonly pass: boolean;
  readonly observations: readonly ActionCombatObservation[];
  readonly reason?: string;
};
export type ActionCombatProbeOptions = {
  readonly mapId: string;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
};
export type ActionCombatRuntimeResult = {
  readonly pass: boolean;
  readonly observations: readonly ActionCombatObservation[];
  readonly reason?: string;
};

// Only the private player transport below can mint a receipt. A JSON/tool result is
// intentionally not an attestation, even when every visible field matches.
const issued = new WeakMap<object, ActionCombatProofReceipt>();

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function actionCombatProjectFingerprint(project: Project): string {
  const source = canonical(project);
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < source.length; i += 1) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(source.charCodeAt(i))) * 0x100000001b3n);
  }
  return `action-v1:${source.length}:${hash.toString(16)}`;
}

export function isVerifiedActionCombatProof(
  receipt: unknown, project: Project, mapId: string,
): receipt is ActionCombatProofReceipt {
  if (receipt === null || typeof receipt !== "object") return false;
  const owned = issued.get(receipt);
  return owned !== undefined && owned.status === "verified" && owned.pass
    && owned.mapId === mapId && owned.projectFingerprint === actionCombatProjectFingerprint(project);
}

function isObservation(value: unknown): value is ActionCombatObservation {
  return value !== null && typeof value === "object"
    && "outcome" in value && ACTION_COMBAT_OUTCOMES.some((kind) => kind === value.outcome)
    && "mapId" in value && typeof value.mapId === "string"
    && "sequence" in value && Number.isSafeInteger(value.sequence)
    && "before" in value && typeof value.before === "number" && Number.isFinite(value.before)
    && "after" in value && typeof value.after === "number" && Number.isFinite(value.after)
    && (!("eventId" in value) || typeof value.eventId === "string")
    && (!("attackId" in value) || typeof value.attackId === "string");
}

/** Evidence arguments deliberately do not exist on this entry point. */
export async function runActionCombatTest(
  project: Project, options: ActionCombatProbeOptions,
): Promise<ActionCombatProofReceipt> {
  const snapshot: Project = structuredClone(project);
  const projectFingerprint = actionCombatProjectFingerprint(snapshot);
  const runId = crypto.randomUUID();
  const controller = new AbortController();
  const cancel = (): void => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", cancel, { once: true });
  let timedOut = false;
  const deadline = setTimeout(() => { timedOut = true; controller.abort(); },
    Math.max(1, Math.min(120_000, options.timeoutMs ?? 60_000)));
  let frame: HTMLIFrameElement | undefined;
  let projectUrl: string | undefined;
  let unsubscribe: (() => void) | undefined;
  const finish = (
    status: ActionCombatProofReceipt["status"],
    observations: readonly ActionCombatObservation[] = [],
    reason?: string,
  ): ActionCombatProofReceipt => {
    const receipt: ActionCombatProofReceipt = Object.freeze({
      version: 1, projectFingerprint, mapId: options.mapId,
      scenarioId: "action-combat-v1", runId, status, pass: status === "verified",
      observations: Object.freeze(observations.map((entry) => Object.freeze({ ...entry }))),
      ...(reason ? { reason } : {}),
    });
    issued.set(receipt, receipt);
    return receipt;
  };
  try {
    if (options.signal?.aborted) return finish("cancelled", [], "Action proof cancelled");
    if (!isActionCombatMap(snapshot, snapshot.maps[options.mapId])) {
      return finish("unverified", [], "Requested map is not an authored action-combat map");
    }
    if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
      return finish("unverified", [], "A real exported-player browser is unavailable");
    }
    const playerUrl = new URL("export-player/player.html", document.baseURI);
    const response = await fetch(playerUrl, { signal: controller.signal });
    if (!response.ok) return finish("unverified", [], `Exported player unavailable (${response.status})`);
    const html = new DOMParser().parseFromString(await response.text(), "text/html");
    if (!html.querySelector('script[type="module"]')) {
      return finish("unverified", [], "Exported player entry is unavailable");
    }
    projectUrl = URL.createObjectURL(new Blob([JSON.stringify(snapshot)], { type: "application/json" }));
    const base = html.createElement("base");
    base.href = new URL(".", playerUrl).href;
    const boot = html.createElement("script");
    boot.textContent = `window.__OPENRPG_BOOT__=${JSON.stringify({
      projectUrl, saveNamespace: `action-proof-${runId}`, qaInstrumentation: true,
      actionCombatProbe: { runId, mapId: options.mapId },
    }).replace(/</g, "\\u003c")};`;
    html.head.prepend(base, boot);
    frame = document.createElement("iframe");
    frame.title = "Action combat runtime proof";
    frame.width = "640";
    frame.height = "480";
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:640px;height:480px;z-index:2147483647";
    const playerFrame = frame;
    const result = new Promise<ActionCombatRuntimeResult>((resolve, reject) => {
      const onAbort = (): void => reject(new DOMException("Action proof aborted", "AbortError"));
      const receive = (event: MessageEvent<unknown>): void => {
        if (event.source !== playerFrame.contentWindow || event.origin !== location.origin) return;
        const data = event.data;
        if (!data || typeof data !== "object" || !("type" in data) || data.type !== "oprn:combat-proof"
          || !("runId" in data) || data.runId !== runId) return;
        if (!("mapId" in data) || data.mapId !== options.mapId
          || !("observations" in data) || !Array.isArray(data.observations)
          || !data.observations.every(isObservation)) {
          resolve({ pass: false, observations: [], reason: "Invalid runtime proof binding" });
          return;
        }
        const observations = data.observations.filter((entry) => entry.mapId === options.mapId);
        const complete = ACTION_COMBAT_OUTCOMES.every((outcome) => observations.some((entry) => entry.outcome === outcome));
        resolve({
          pass: "pass" in data && data.pass === true && complete
            && observations.length === data.observations.length,
          observations,
          ...("reason" in data && typeof data.reason === "string" ? { reason: data.reason } : {}),
        });
      };
      window.addEventListener("message", receive);
      controller.signal.addEventListener("abort", onAbort, { once: true });
      unsubscribe = () => {
        window.removeEventListener("message", receive);
        controller.signal.removeEventListener("abort", onAbort);
      };
      if (controller.signal.aborted) onAbort();
    });
    frame.srcdoc = `<!doctype html>${html.documentElement.outerHTML}`;
    document.body.append(frame);
    const runtime = await result;
    if (options.signal?.aborted) return finish("cancelled", [], "Action proof cancelled");
    return finish(runtime.pass ? "verified" : "unverified", runtime.observations, runtime.reason);
  } catch (error) {
    return finish(timedOut ? "timeout" : controller.signal.aborted ? "cancelled" : "unverified", [],
      error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(deadline);
    unsubscribe?.();
    options.signal?.removeEventListener("abort", cancel);
    frame?.remove();
    if (projectUrl) URL.revokeObjectURL(projectUrl);
  }
}
