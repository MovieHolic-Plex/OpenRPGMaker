import { commandSummaryParts } from "@/editor/panels/eventEditor/commandSummary";
import { displayText } from "@/editor/smallTask/target";
import { equipmentSlotLabel } from "@/project/equipmentSlots";
import type { ActorAmountOp, Project, VariableOperand } from "@/project/types";
import { josa, roJosa, withJosa } from "@/util/josa";
import type { PartyActorCommand } from "../05-cmd-party-actor";

function name(value: string | undefined, fallback: string, id?: string): string {
  if (!value || value === id) return fallback;
  return displayText(value.replace(/[.?!{}\[\]"「」]/gu, " "), fallback).slice(0, 24);
}

function recordName(records: readonly { id: string; name: string }[] | undefined, id: string, fallback: string): string {
  return name(records?.find(record => record.id === id)?.name, fallback, id);
}

function amountChange(value: string, op: ActorAmountOp): string {
  if (op === "+=") return `${value}만큼 올리는`;
  if (op === "-=") return `${value}만큼 내리는`;
  return `${value}에 맞추는`;
}

function operand(project: Project, amount: VariableOperand): string {
  return typeof amount === "number"
    ? String(amount)
    : recordName(project.variables, amount.id, "변수의 값") + " 기준";
}

export function describePartyActorCommand(project: Project, cmd: PartyActorCommand): string {
  const { database } = project;
  const actorId = "actorId" in cmd ? cmd.actorId : undefined;
  const actor = actorId ? recordName(database.actors, actorId, "주인공") : "파티 전체";
  switch (cmd.kind) {
    case "learnSkill": {
      const skill = recordName(database.skills, cmd.skillId, "스킬");
      return `${actor}에게 ${withJosa(skill, "을/를")} ${cmd.action === "forget" ? "잊게 하는" : "가르치는"}`;
    }
    case "changeExp": return `${actor}의 경험치를 ${amountChange(operand(project, cmd.amount), cmd.op)}`;
    case "changeLevel": return `${actor}의 레벨을 ${amountChange(String(cmd.amount), cmd.op)}`;
    case "changeLifeSkillExp": {
      const skill = recordName(database.lifeSkills, cmd.skillId, "생활 스킬");
      return `${skill} 경험치를 ${amountChange(operand(project, cmd.amount), cmd.op)}`;
    }
    case "promoteActor": {
      const job = cmd.toClassId ? recordName(database.classes, cmd.toClassId, "지정한 직업") : "게임에서 정한 직업";
      return `${actor}의 직업을 ${job}${roJosa(job)} 승급하는`;
    }
    case "changeEquipment": {
      const slot = name(equipmentSlotLabel(project, cmd.slot), "장비 부위", cmd.slot);
      if (!cmd.equipmentId) return `${actor}의 ${slot} 장비를 벗기는`;
      const equipment = recordName(database.equipment, cmd.equipmentId, "지정한 장비");
      return `${actor}의 ${slot} 장비를 ${equipment}${roJosa(equipment)} 바꾸는`;
    }
    case "changeActorHp":
    case "changeActorMp": {
      const vital = cmd.kind === "changeActorHp" ? "체력" : "마력";
      const quantity = cmd.amountMode === "percent" ? `최대치의 ${cmd.amount}%` : String(cmd.amount);
      return `${actor}의 ${vital}을 ${amountChange(quantity, cmd.op)}`;
    }
    case "recoverAll": return `${actor}의 상태 이상을 없애고 체력과 마력을 모두 채우는`;
    case "changeParty": {
      const adjustment = { add: "파티에 넣는", remove: "파티에서 빼는", lead: "파티 선두로 옮기는" }[cmd.action];
      return `${withJosa(actor, "을/를")} ${adjustment}`;
    }
    case "storeParty": {
      const label = name(cmd.partySetId, "기본 파티");
      const party = cmd.actorIds?.length ? `${cmd.actorIds.length}명으로 편성한 파티` : "현재 파티";
      const map = cmd.mapId ? name(project.maps[cmd.mapId]?.name, "지정한 맵", cmd.mapId) : "";
      const position = [map, cmd.x === undefined ? "" : `가로 ${cmd.x}`, cmd.y === undefined ? "" : `세로 ${cmd.y}`]
        .filter(Boolean).join(" ");
      return `${party}를 「${label}」에 ${position ? `${position} 위치와 함께 ` : ""}저장하는`;
    }
    case "recallParty": {
      const label = name(cmd.partySetId, "기본 파티");
      return `「${label}」${josa(label, "을/를")} 불러오는`;
    }
    case "addFollower": return `${withJosa(name(cmd.name, actorId ? actor : "동행자"), "이/가")} 따라오게 하는`;
    case "removeFollower": {
      const subject = cmd.all || !cmd.name
        ? commandSummaryParts({ kind: "removeFollower", all: true }).find(part => part.tone === "value")?.text ?? "전체"
        : name(cmd.name, "한 명");
      return `동행자 ${withJosa(subject, "이/가")} 떠나게 하는`;
    }
  }
}
