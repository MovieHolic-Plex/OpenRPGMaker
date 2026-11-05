/**
 * 폴른 스타 — 자료집 「이야기」 색인 (빌더 맨 끝에서 한 번).
 *
 * 편집기에서 데모를 연 사람이 이 게임의 줄거리 뼈대(막별 본줄 임무·잔 의뢰·엔딩)를 읽을 수 있게,
 * 이미 있는 임무·엔딩 기록을 **실제 배선에 맞춰** 다듬는다. 새 비트·새 엔딩은 만들지 않는다.
 *
 * - 제1막 본줄 `fs_main`(단계형): 이름 없는 단계(대화·전투)는 플레이어 일지와 편집기에
 *   「1. 대화」「3. 전투」로만 보였다. 단계가 가리키는 실제 대상(브람·발렌 추락지 전투·지하 4층 패널)에서
 *   한 줄 목표를 붙인다. 이벤트는 컴파일 때 이미 만들어졌으므로 label 은 글자만 바꾼다.
 * - 임무·엔딩이 기대는 스위치 중 이름이 비었거나 id 그대로인 것에 읽을 수 있는 이름을 준다.
 * - 진실성 검사: 그래프 임무의 각 단계 스위치가 실제로 있고 어떤 이벤트가 켜는지, 단계형 임무의
 *   컴파일 스위치가 있는지, 엔딩마다 그것을 부르는 triggerEnding 이 있는지 센다. 어긋나면 경고만 한다
 *   (제2막은 다른 작업자가 짓는 중이라 여기서 빌드를 멈추지 않는다).
 */
import { isQuestGraphDef, isStepQuestDef, questFlagIds, type QuestStep } from "@/project/quest/questDef";
import type { Project } from "@/project/types";

type Rec = Record<string, unknown>;

/** 제1막 본줄 단계 — 단계 종류·대상으로 찾아 한 줄 목표를 붙인다(대상이 바뀌면 붙이지 않는다). */
function act1StepLabel(step: QuestStep): string | undefined {
  if (step.kind === "talk" && "eventId" in step.target && step.target.eventId === "ev_fs_bram") return "숲지기 브람에게 별이 떨어진 곳을 묻는다";
  if (step.kind === "inspect" && step.at.mapId === "fs_forest") return "북쪽 숲 추락지에서 떨어진 별을 살핀다";
  if (step.kind === "kill" && step.at.mapId === "fs_forest") return "추락지에서 심문관 발렌과 맞선다";
  if (step.kind === "inspect" && step.at.mapId === "fs_vault_b4") return "천문대 지하 4층의 기계 패널을 조사한다";
  return undefined;
}

/** 이름이 비었거나 id 그대로인 이야기 스위치에 붙일 이름. 이미 저자가 이름을 준 스위치는 건드리지 않는다. */
const SWITCH_NAMES: Readonly<Record<string, string>> = {
  sw_fs_hanel_met: "제1막: 천문대장 하넬을 만났다",
  sw_fs_q_bread_done: "Q1 토마의 납작빵 완료",
  sw_fs_q_spoon_done: "Q2 마르타의 은수저 완료",
};

export interface FallenStoryIndexReport {
  readonly quests: number;
  readonly endings: number;
  readonly steps: number;
  readonly problems: readonly string[];
}

function walk(value: unknown, visit: (node: Rec) => void): void {
  if (Array.isArray(value)) { for (const item of value) walk(item, visit); return; }
  if (!value || typeof value !== "object") return;
  visit(value as Rec);
  for (const child of Object.values(value as Rec)) walk(child, visit);
}

/** 이벤트·공용 이벤트·적 그룹 안에서 켜지는 스위치와 불리는 엔딩을 모은다. */
function collectWiring(project: Project): { setSwitches: Set<string>; triggered: Map<string, number> } {
  const setSwitches = new Set<string>();
  const triggered = new Map<string, number>();
  const roots: unknown[] = [Object.values(project.maps).map((map) => map.events), project.commonEvents, project.database.troops];
  walk(roots, (node) => {
    if (node.kind === "setSwitch" && typeof node.switchId === "string") setSwitches.add(node.switchId);
    if (node.kind === "triggerEnding" && typeof node.endingId === "string") triggered.set(node.endingId, (triggered.get(node.endingId) ?? 0) + 1);
  });
  return { setSwitches, triggered };
}

export function applyFallenStoryIndex(project: Project): FallenStoryIndexReport {
  const problems: string[] = [];
  const switchById = new Map(project.switches.map((s) => [s.id, s]));

  // 1. 제1막 본줄 단계 목표.
  for (const quest of project.quests ?? []) {
    if (!isStepQuestDef(quest) || quest.key !== "fs_main") continue;
    const steps = quest.steps as QuestStep[];
    steps.forEach((step, index) => {
      const label = act1StepLabel(step);
      if (label) steps[index] = { ...step, label };
      else if (!step.label) problems.push(`fs_main ${index + 1}단계(${step.kind})의 대상을 알아보지 못해 목표 글이 없다`);
    });
  }

  // 2. 이야기 스위치 이름.
  for (const [id, name] of Object.entries(SWITCH_NAMES)) {
    const record = switchById.get(id);
    if (record && (!record.name || record.name === id)) record.name = name;
  }

  // 3. 진실성 검사.
  const { setSwitches, triggered } = collectWiring(project);
  let stepCount = 0;
  for (const quest of project.quests ?? []) {
    if (isQuestGraphDef(quest)) {
      for (const node of quest.nodes) {
        stepCount += 1;
        const conditions: Rec[] = [];
        walk(node.completesWhen, (c) => { if (c.kind === "switch") conditions.push(c); });
        if (conditions.length === 0) problems.push(`${quest.id}/${node.id}: 스위치 조건이 없다`);
        for (const c of conditions) {
          const id = typeof c.switchId === "string" ? c.switchId : undefined;
          if (!id) continue;
          if (!switchById.has(id)) problems.push(`${quest.id}/${node.id}: 스위치 ${id} 가 프로젝트에 없다`);
          else if (!setSwitches.has(id)) problems.push(`${quest.id}/${node.id}: 스위치 ${id} 를 켜는 이벤트가 없다`);
        }
      }
    } else if (isStepQuestDef(quest)) {
      const flags = questFlagIds(quest.key, quest.steps.length);
      stepCount += quest.steps.length;
      for (const id of [flags.started, flags.done]) {
        if (!switchById.has(id)) problems.push(`${quest.key}: 컴파일 스위치 ${id} 가 없다`);
      }
    }
  }
  for (const ending of project.endings ?? []) {
    if ((ending.conditions?.length ?? 0) === 0 && !triggered.has(ending.id)) problems.push(`엔딩 ${ending.id}: 조건도 triggerEnding 도 없어 도달할 수 없다`);
  }
  for (const id of triggered.keys()) {
    if (!(project.endings ?? []).some((e) => e.id === id)) problems.push(`triggerEnding ${id}: 그런 엔딩이 없다`);
  }

  const report = { quests: project.quests?.length ?? 0, endings: project.endings?.length ?? 0, steps: stepCount, problems };
  if (problems.length > 0) console.warn(`[fallen-story-index] ${problems.length}건: ${problems.join(" / ")}`);
  return report;
}
