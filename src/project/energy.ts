import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

export type EnergyChangeResult =
  | { readonly ok: true; readonly before: number; readonly after: number; readonly spent: number }
  | { readonly ok: true; readonly before: number; readonly after: number; readonly restored: number }
  | { readonly ok: false; readonly reason: "disabled" | "invalid-config" | "invalid-amount" | "insufficient-energy" };

export function spendEnergy(project: Project, session: PlaySession, amount: number): EnergyChangeResult {
  const resolved = resolveEnergy(project, session);
  if (!resolved.ok) return resolved;
  if (!isPositiveInteger(amount)) return { ok: false, reason: "invalid-amount" };
  if (resolved.current < amount) return { ok: false, reason: "insufficient-energy" };
  const after = resolved.current - amount;
  session.energy = after;
  return { ok: true, before: resolved.current, after, spent: amount };
}

export function restoreEnergy(project: Project, session: PlaySession, amount?: number): EnergyChangeResult {
  const resolved = resolveEnergy(project, session);
  if (!resolved.ok) return resolved;
  const requested = amount ?? resolved.max;
  if (!isNonNegativeInteger(requested)) return { ok: false, reason: "invalid-amount" };
  const after = Math.min(resolved.max, resolved.current + requested);
  session.energy = after;
  return { ok: true, before: resolved.current, after, restored: after - resolved.current };
}

function resolveEnergy(
  project: Project,
  session: PlaySession,
):
  | { readonly ok: true; readonly current: number; readonly max: number }
  | { readonly ok: false; readonly reason: "disabled" | "invalid-config" } {
  const config = project.system.energy;
  if (!config) return { ok: false, reason: "disabled" };
  if (!isPositiveInteger(config.max)) return { ok: false, reason: "invalid-config" };
  const fallback = isNonNegativeInteger(config.initial) ? Math.min(config.max, config.initial) : config.max;
  const current = isNonNegativeInteger(session.energy) ? Math.min(config.max, session.energy) : fallback;
  return { ok: true, current, max: config.max };
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}
