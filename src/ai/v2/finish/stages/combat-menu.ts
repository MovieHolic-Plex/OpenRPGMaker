// 전투를 넣었는데 ESC 메뉴가 전투 없는 이야기용이다 → 스킬·장비·상태 칸을 소지품 뒤에 되돌린다(게임 검사 [게임 검사 메뉴] 와 같은 판정).
// 2026-10-30 omo-loop-1030: 관문이 configure_field_menu 로 고치라고 했지만 v2 동사 목록에 그 도구가 없어, 할 일 항목이 세 장면 모두 «도구 없음 → 막힘»으로 남았다.
// 결정적인 수리라 모델에게 맡기지 않고 끝맺음이 한다. 저작한 메뉴의 다른 칸·이름은 그대로 두고, 12칸을 넘으면 뒤쪽 비전투 칸(타이틀로 제외)을 뺀다.
import type { FinishStage } from "../types";
import { fieldMenu, type AuthoredFieldMenu, type FieldMenuCommand } from "@/project/fieldMenu";
import { usesRelationshipMenu } from "@/project/relationshipMenu";
import type { Project } from "@/project/types";

const COMBAT_ROWS: readonly { command: FieldMenuCommand; label: string }[] = [
  { command: "skills", label: "스킬" }, { command: "equipment", label: "장비" }, { command: "status", label: "상태" },
];

const hasBattle = (project: Project): boolean => {
  const scan = (commands: unknown): boolean => JSON.stringify(commands ?? []).includes('"kind":"battleProcessing"');
  return Object.values(project.maps).some((m) => (m?.events ?? []).some((e) => scan(e.pages)))
    || ((project.commonEvents ?? []) as unknown as { commands?: unknown }[]).some((c) => scan(c.commands));
};

/** 고칠 것이 있으면 새 메뉴, 없으면 undefined. */
export function combatMenuFix(project: Project): AuthoredFieldMenu | undefined {
  const menu = fieldMenu(project);
  if (!menu || usesRelationshipMenu(project)) return undefined;
  const have = new Set(menu.entries.map((e) => e.command));
  if (have.has("skills") || have.has("equipment") || !hasBattle(project)) return undefined;
  const entries = [...menu.entries];
  const at = Math.max(0, entries.findIndex((e) => e.command === "items") + 1);
  entries.splice(at, 0, ...COMBAT_ROWS.filter((r) => !have.has(r.command)));
  const optional: FieldMenuCommand[] = ["gallery", "backlog", "endings", "load", "wait", "journal"];
  while (entries.length > 12) {
    const i = entries.findIndex((e) => optional.includes(e.command));
    if (i < 0) break;
    entries.splice(i, 1);
  }
  return { version: 1, entries: entries.slice(0, 12) };
}

export const stage: FinishStage = {
  id: "combat-menu", phase: "reload", order: 100,
  run(ctx) {
    const { env } = ctx;
    try {
      const next = combatMenuFix(env.ctx.project);
      if (!next) return;
      // 요청 사본과 meta 를 나눠 쓸 수 있어 제자리 수정하지 않는다.
      env.ctx.project = { ...env.ctx.project, meta: { ...env.ctx.project.meta, oprnFieldMenu: next } };
      const line = `ESC 메뉴: 전투를 넣어 스킬·장비·상태 칸을 되돌림 → ${next.entries.map((e) => e.label).join("·")}`;
      env.emit({ type: "execution_status", name: "v2.combat-menu", ok: true, summary: line });
      ctx.autoPath = ctx.autoPath ? `${ctx.autoPath}\n- ${line}` : `[자동으로 지음]\n- ${line}`;
    } catch (error) { env.emit({ type: "execution_status", name: "v2.combat-menu", ok: false, summary: `ESC 메뉴 되돌리기 실패: ${error instanceof Error ? error.message : String(error)}` }); }
  },
};
