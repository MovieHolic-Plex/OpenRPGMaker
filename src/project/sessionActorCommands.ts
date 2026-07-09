import type { ActorAmountOp, ActorId, Command } from "@/project/types";
import type { PlaySessionLike } from "@/player/types";

type ActorVitalKind = "hp" | "mp";
type ActorVitalCommand = Extract<Command, { kind: "changeActorHp" | "changeActorMp" }>;

export function changeActorVital(session: PlaySessionLike, command: ActorVitalCommand): void {
  const kind = vitalKind(command);
  const vitals = session.actorVitals[command.actorId];
  if (!vitals) return;
  const max = kind === "hp" ? vitals.maxHp : vitals.maxMp;
  vitals[kind] = clamp(applyAmount(vitals[kind], command.op, command.amount), 0, max);
}

// 런타임 액터 이름을 세션 오버라이드에 저장한다(프로젝트 DB 는 건드리지 않음).
export function changeActorName(session: PlaySessionLike, actorId: ActorId, name: string): void {
  session.actorNames ??= {};
  session.actorNames[actorId] = name;
}

// 액터의 표시 이름을 조회한다. 세션 오버라이드가 있으면 우선, 없으면 DB 이름.
export function resolveActorName(
  session: Pick<PlaySessionLike, "actorNames">,
  actor: { readonly id: ActorId; readonly name: string }
): string {
  return session.actorNames?.[actor.id] ?? actor.name;
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
  session.actorExperience[command.actorId] = Math.max(
    0,
    applyAmount(session.actorExperience[command.actorId] ?? 0, command.op, command.amount)
  );
}

export function changeActorLevel(session: PlaySessionLike, command: Extract<Command, { kind: "changeLevel" }>): void {
  session.actorLevels ??= {};
  session.actorLevels[command.actorId] = clamp(
    applyAmount(session.actorLevels[command.actorId] ?? 1, command.op, command.amount),
    1,
    99
  );
}

export function changeActorEquipment(session: PlaySessionLike, command: Extract<Command, { kind: "changeEquipment" }>): void {
  session.actorEquipment ??= {};
  const current = session.actorEquipment[command.actorId] ?? {};
  if (command.equipmentId) {
    session.actorEquipment[command.actorId] = { ...current, [command.slot]: command.equipmentId };
    return;
  }
  const next = { ...current };
  delete next[command.slot];
  session.actorEquipment[command.actorId] = next;
}

function vitalKind(command: ActorVitalCommand): ActorVitalKind {
  switch (command.kind) {
    case "changeActorHp":
      return "hp";
    case "changeActorMp":
      return "mp";
  }
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
