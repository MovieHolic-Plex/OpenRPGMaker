// 난이도·파티 묶음·몬스터 놓아주기/교환/합성 명령의 입력 폼.
// 기존 몬스터 명령(commandBodyDatabase.moveMonsterBody/giveMonsterBody)과 같은 모양·같은 피커를 쓴다.
import { store } from "@/project/store";
import type { Command, Project } from "@/project/types";
import { el } from "@/util/dom";
import { numberInput } from "./commandBodyAdvanced";
import { amountStepper, imageIconOf, recordPickerWithPreview } from "./recordPicker";
import type { CommandEditContext } from "./types";

function speciesPicker(project: Project, selectedId: string, testid: string, placeholder: string) {
  return recordPickerWithPreview({
    records: project.database.monsterSpecies ?? [],
    selectedId,
    placeholder,
    testid,
    iconOf: (record) => imageIconOf(project, record.graphic.monsterResourceId),
    subtitleOf: (record) => `HP ${record.baseStats.maxHp}`,
  });
}

function textInput(value: string, placeholder: string, testid: string): HTMLInputElement {
  return el("input", { attrs: { type: "text", placeholder }, value, dataset: { testid } }) as HTMLInputElement;
}

function formRows(...rows: HTMLElement[]): HTMLElement {
  return el("span", {
    class: "rich-command-form cream-command-form",
    children: rows.map((row) => el("span", { class: "rich-form-row", children: [row] })),
  });
}

function hint(text: string, testid: string): HTMLElement {
  return el("span", { class: "empty-hint", text, dataset: { testid } });
}

export function setDifficultyBody(context: CommandEditContext, cmd: Extract<Command, { kind: "setDifficulty" }>): HTMLElement {
  const rows = store.getCurrent().system.difficulties ?? [];
  if (rows.length === 0) {
    return formRows(hint("난이도가 없습니다. 데이터베이스 「시스템 → 난이도」에서 먼저 만드세요.", "set-difficulty-empty"));
  }
  const picker = recordPickerWithPreview({
    records: rows,
    selectedId: cmd.difficultyId,
    placeholder: "난이도 선택",
    testid: "set-difficulty-select",
  });
  picker.select.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, { kind: "setDifficulty", difficultyId: picker.select.value });
  });
  return formRows(picker.root, hint("적 HP·공격력, 경험치·골드, 인카운트율 배율이 바로 바뀝니다.", "set-difficulty-hint"));
}

export function partySetBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "storeParty" | "recallParty" }>,
): HTMLElement {
  const name = textInput(cmd.partySetId, "파티 이름", `${cmd.kind === "storeParty" ? "store" : "recall"}-party-name-input`);
  name.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, { kind: cmd.kind, partySetId: name.value.trim() });
  });
  const text = cmd.kind === "storeParty"
    ? "지금 파티(구성원·선 자리)를 이 이름으로 저장합니다. 같은 이름은 덮어씁니다."
    : "저장한 파티로 조작을 바꾸고 그 자리로 이동합니다. 지금 파티는 자기 이름으로 자동 저장됩니다. 결과는 기억 recallPartySuccess.";
  return formRows(name, hint(text, `${cmd.kind === "storeParty" ? "store" : "recall"}-party-hint`));
}

export function removeMonsterBody(context: CommandEditContext, cmd: Extract<Command, { kind: "removeMonster" }>): HTMLElement {
  const instanceId = textInput(cmd.instanceId, "비우면 보관함 첫 몬스터", "remove-monster-instance-input");
  instanceId.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, { kind: "removeMonster", instanceId: instanceId.value.trim() });
  });
  return formRows(instanceId, hint("파티의 마지막 한 마리는 놓아줄 수 없습니다. 결과는 기억 removeMonsterSuccess.", "remove-monster-hint"));
}

export function tradeMonsterBody(context: CommandEditContext, cmd: Extract<Command, { kind: "tradeMonster" }>): HTMLElement {
  const project = store.getCurrent();
  const from = speciesPicker(project, cmd.fromSpeciesId, "trade-monster-from-select", "내줄 종");
  const to = speciesPicker(project, cmd.toSpeciesId, "trade-monster-to-select", "받을 종");
  const level = numberInput(cmd.level ?? 0, "레벨", "trade-monster-level-input");
  level.min = "0";
  level.max = "99";
  const nickname = textInput(cmd.nickname ?? "", "받을 몬스터 별명(선택)", "trade-monster-nickname-input");
  const apply = (): void => {
    const levelValue = Math.max(0, Math.min(99, parseInt(level.value, 10) || 0));
    context.actions.replaceCommand(context.path, {
      kind: "tradeMonster",
      fromSpeciesId: from.select.value,
      toSpeciesId: to.select.value,
      ...(levelValue > 0 ? { level: levelValue } : {}),
      ...(nickname.value.trim() ? { nickname: nickname.value.trim() } : {}),
    });
  };
  for (const control of [from.select, to.select, level, nickname]) control.addEventListener("change", apply);
  return formRows(
    from.root,
    to.root,
    el("label", { class: "inline-field", children: [el("span", { text: "레벨(0 = 내준 몬스터와 같게)" }), amountStepper(level, { testidBase: "trade-monster-level" })] }),
    nickname,
    hint("가진 몬스터 중 내줄 종 한 마리(보관함 먼저)를 받을 종으로 바꿉니다. 결과는 기억 tradeMonsterSuccess.", "trade-monster-hint"),
  );
}

export function fuseMonstersBody(context: CommandEditContext, cmd: Extract<Command, { kind: "fuseMonsters" }>): HTMLElement {
  const a = textInput(cmd.instanceIdA, "첫째 몬스터", "fuse-monsters-a-input");
  const b = textInput(cmd.instanceIdB, "둘째 몬스터", "fuse-monsters-b-input");
  const apply = (): void => {
    context.actions.replaceCommand(context.path, { kind: "fuseMonsters", instanceIdA: a.value.trim(), instanceIdB: b.value.trim() });
  };
  a.addEventListener("change", apply);
  b.addEventListener("change", apply);
  const fusions = store.getCurrent().system.monsterFusions?.length ?? 0;
  return formRows(
    a,
    b,
    hint(
      fusions > 0
        ? `합성 표(${fusions}줄)에서 두 종의 결과를 찾습니다. 결과 레벨은 두 재료 평균. 결과는 기억 fuseMonstersSuccess.`
        : "합성 표가 비어 있습니다. 데이터베이스 「시스템 → 몬스터 합성」에서 만드세요.",
      "fuse-monsters-hint",
    ),
  );
}
