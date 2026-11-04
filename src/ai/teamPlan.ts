import { CODEX_ACCOUNT_PROVIDER_ID, GOOGLE_ACCOUNT_PROVIDER_ID, type DetectedAccount, type DetectedCli } from "./planDefaults.ts";
import { FAMILY_MODEL_KEYS, TEAM_MODELS, UNRATED_DEFAULT_WORKER, chooseTeam, type ModelFamily, type TeamChoice, type TeamModel, type TeamModelKey } from "./teamScoreboard.ts";

export interface DetectedKey {
  readonly id: string;
  readonly family: ModelFamily;
  readonly label: string;
  readonly models: Readonly<Partial<Record<TeamModelKey, string>>>;
}

export type TeamRoute =
  | { readonly kind: "cli"; readonly cli: "claude" | "codex" }
  | { readonly kind: "account"; readonly providerId: string }
  | { readonly kind: "key"; readonly sourceId: string; readonly label: string };

export interface TeamSlot {
  readonly model: TeamModel;
  readonly route: TeamRoute;
  readonly modelId: string;
}

export interface TeamPlan {
  readonly worker: TeamSlot;
  readonly lead?: TeamSlot;
  readonly choice?: TeamChoice;
  readonly routes: readonly TeamRoute[];
}

export interface TeamInputs {
  readonly clis: readonly DetectedCli[];
  readonly accounts: readonly DetectedAccount[];
  readonly keys: readonly DetectedKey[];
}

const cliReady = (clis: readonly DetectedCli[], id: "claude" | "codex"): boolean =>
  clis.some((row) => row.id === id && row.state === "ready" && row.billing === "subscription");

const accountReady = (accounts: readonly DetectedAccount[], providerId: string): boolean =>
  accounts.some((row) => row.providerId === providerId && row.connected && row.expired !== true && row.env !== true && row.authKind === "oauth");

/** 모델마다 쓸 길 하나 — 구독 CLI → 앱 안 로그인 → 키 순. */
export function modelRoutes(inputs: TeamInputs): Map<TeamModelKey, { route: TeamRoute; modelId: string }> {
  const out = new Map<TeamModelKey, { route: TeamRoute; modelId: string }>();
  const own = (family: ModelFamily, route: TeamRoute): void => {
    for (const key of FAMILY_MODEL_KEYS[family]) if (!out.has(key)) out.set(key, { route, modelId: TEAM_MODELS[key].id });
  };
  if (cliReady(inputs.clis, "claude")) own("claude", { kind: "cli", cli: "claude" });
  if (cliReady(inputs.clis, "codex")) own("openai", { kind: "cli", cli: "codex" });
  else if (accountReady(inputs.accounts, CODEX_ACCOUNT_PROVIDER_ID)) own("openai", { kind: "account", providerId: CODEX_ACCOUNT_PROVIDER_ID });
  if (accountReady(inputs.accounts, GOOGLE_ACCOUNT_PROVIDER_ID)) own("google", { kind: "account", providerId: GOOGLE_ACCOUNT_PROVIDER_ID });
  for (const key of inputs.keys) {
    const route: TeamRoute = { kind: "key", sourceId: key.id, label: key.label };
    for (const model of FAMILY_MODEL_KEYS[key.family]) {
      const modelId = key.models[model];
      if (modelId && !out.has(model)) out.set(model, { route, modelId });
    }
  }
  return out;
}

/** 가진 것 전부로 만들 수 있는 가장 좋은 팀. 점수표가 채점한 조합이 없으면 점수 없는 제품 기본값, 그것도 없으면 undefined. */
export function buildTeamPlan(inputs: TeamInputs): TeamPlan | undefined {
  const routes = modelRoutes(inputs);
  const choice = chooseTeam(new Set(routes.keys()));
  const slot = (key: TeamModelKey): TeamSlot | undefined => {
    const found = routes.get(key);
    return found ? { model: TEAM_MODELS[key], route: found.route, modelId: found.modelId } : undefined;
  };
  if (choice) {
    const worker = slot(choice.worker)!;
    const lead = choice.lead ? slot(choice.lead) : undefined;
    const used = [worker.route, ...(lead ? [lead.route] : [])];
    return { worker, ...(lead ? { lead } : {}), choice, routes: dedupeRoutes(used) };
  }
  for (const family of ["google"] as const) {
    const fallback = UNRATED_DEFAULT_WORKER[family];
    const worker = fallback ? slot(fallback) : undefined;
    if (worker) return { worker, routes: [worker.route] };
  }
  return undefined;
}

function routeKey(route: TeamRoute): string {
  return route.kind === "cli" ? `cli:${route.cli}` : route.kind === "account" ? `account:${route.providerId}` : `key:${route.sourceId}`;
}

function dedupeRoutes(routes: readonly TeamRoute[]): TeamRoute[] {
  const seen = new Set<string>();
  return routes.filter((route) => (seen.has(routeKey(route)) ? false : (seen.add(routeKey(route)), true)));
}

export const sameRoute = (a: TeamRoute, b: TeamRoute): boolean => routeKey(a) === routeKey(b);
