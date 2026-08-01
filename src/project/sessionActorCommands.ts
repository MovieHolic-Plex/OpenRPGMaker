import type { ActorAmountOp, ActorId, Command, VariableOperand } from "@/project/types";
import type { PlaySessionLike } from "@/player/types";
import type { Project } from "@/project/types";
import { effectiveActorClassId } from "@/project/sessionClass";
import { transitionActorEquipment, type EquipmentTransitionResult } from "@/player/playerEquipmentRules";

type ActorVitalKind = "hp" | "mp";
type ActorVitalCommand = Extract<Command, { kind: "changeActorHp" | "changeActorMp" }>;

export function changeActorVital(session: PlaySessionLike, command: ActorVitalCommand): void {
  const kind = vitalKind(command);
  const actorIds = resolveExperienceTargets(session, command.actorId);
  for (const actorId of actorIds) {
    const vitals = session.actorVitals[actorId];
    if (!vitals) continue;
    const max = kind === "hp" ? vitals.maxHp : vitals.maxMp;
    const rawAmount = Math.trunc(command.amount);
    const amount =
      command.amountMode === "percent" ? Math.trunc((Math.max(0, max) * rawAmount) / 100) : rawAmount;
    vitals[kind] = clamp(applyAmount(vitals[kind], command.op, amount), 0, max);
  }
}

// 런타임 액터 이름을 세션 오버라이드에 저장한다(프로젝트 DB 는 건드리지 않음).
export function changeActorName(session: PlaySessionLike, actorId: ActorId, name: string): void {
  session.actorNames ??= {};
  session.actorNames[actorId] = name;
}

export function changeActorNickname(session: PlaySessionLike, actorId: ActorId, nickname: string): void {
  session.actorNicknames ??= {};
  session.actorNicknames[actorId] = nickname;
}

export function changeActorFaceset(session: PlaySessionLike, actorId: ActorId, faceResourceId: string, faceIndex: number): void {
  session.actorFaceResourceIds ??= {};
  session.actorFaceIndices ??= {};
  session.actorFaceResourceIds[actorId] = faceResourceId;
  session.actorFaceIndices[actorId] = faceIndex;
}

// 액터의 표시 이름을 조회한다. 세션 오버라이드가 있으면 우선, 없으면 DB 이름.
export function resolveActorName(
  session: Pick<PlaySessionLike, "actorNames">,
  actor: { readonly id: ActorId; readonly name: string }
): string {
  return session.actorNames?.[actor.id] ?? actor.name;
}

export function resolveActorNickname(
  session: Pick<PlaySessionLike, "actorNicknames">,
  actor: { readonly id: ActorId; readonly nickname?: string }
): string | undefined {
  return session.actorNicknames?.[actor.id] ?? actor.nickname;
}

export function resolveActorFaceResourceId(
  session: Pick<PlaySessionLike, "actorFaceResourceIds">,
  actor: { readonly id: ActorId; readonly faceResourceId?: string }
): string | undefined {
  return session.actorFaceResourceIds?.[actor.id] ?? actor.faceResourceId;
}

export function resolveActorFaceIndex(
  session: Pick<PlaySessionLike, "actorFaceIndices">,
  actor: { readonly id: ActorId; readonly faceIndex?: number }
): number {
  return session.actorFaceIndices?.[actor.id] ?? actor.faceIndex ?? 0;
}

export function recoverAll(session: PlaySessionLike, actorId: ActorId | undefined): void {
  const actorIds = actorId ? [actorId] : session.partyActorIds;
  for (const id of actorIds) {
    const vitals = session.actorVitals[id];
    if (!vitals) continue;
    vitals.hp = vitals.maxHp;
    vitals.mp = vitals.maxMp;
  }
}

export function changeActorExperience(session: PlaySessionLike, command: Extract<Command, { kind: "changeExp" }>): void {
  session.actorExperience ??= {};
  const amount = resolveOperandAmount(session, command.amount);
  for (const actorId of resolveExperienceTargets(session, command.actorId)) {
    session.actorExperience[actorId] = Math.max(
      0,
      applyAmount(session.actorExperience[actorId] ?? 0, command.op, amount)
    );
  }
}

export function changeActorLevel(session: PlaySessionLike, command: Extract<Command, { kind: "changeLevel" }>): void {
  session.actorLevels ??= {};
  session.actorLevels[command.actorId] = clamp(
    applyAmount(session.actorLevels[command.actorId] ?? 1, command.op, command.amount),
    1,
    99
  );
}

export function changeActorEquipment(
  session: PlaySessionLike,
  project: Project,
  command: Extract<Command, { kind: "changeEquipment" }>
): EquipmentTransitionResult {
  session.actorEquipment ??= {};
  const transition = transitionActorEquipment({
    project,
    actorId: command.actorId,
    classId: effectiveActorClassId(project, session, command.actorId),
    equipment: session.actorEquipment[command.actorId],
    inventory: session.inventory,
    slot: command.slot,
    equipmentId: command.equipmentId || undefined,
  });
  if (transition.kind === "accepted") {
    session.actorEquipment[command.actorId] = transition.equipment;
    session.inventory = transition.inventory;
  }
  return transition;
}

function vitalKind(command: ActorVitalCommand): ActorVitalKind {
  switch (command.kind) {
    case "changeActorHp":
      return "hp";
    case "changeActorMp":
      return "mp";
  }
}

function resolveExperienceTargets(session: PlaySessionLike, actorId: string | undefined): readonly string[] {
  if (!actorId || actorId === "party" || actorId === "all") {
    return session.partyActorIds ?? [];
  }
  return [actorId];
}

function resolveOperandAmount(session: PlaySessionLike, amount: VariableOperand): number {
  if (typeof amount === "number") return Math.trunc(amount);
  return Math.trunc(session.variables[amount.id] ?? 0);
}

function applyAmount(current: number, op: ActorAmountOp, amount: number): number {
  switch (op) {
    case "=":
      return amount;
    case "+=":
      return current + amount;
    case "-=":
      return current - amount;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
