// 시스템 탭 — 난이도 목록과 몬스터 합성 표.
//
// 둘 다 system 하위 배열이고 정규화는 project/difficulty.ts · project/monsterTrade.ts 가 소유한다.
// 편집기는 줄 추가/삭제/값 변경만 하고, 같은 정규화 함수를 거쳐 저장한다(저장 결과와 편집 상태가 어긋나지 않게).
import { DIFFICULTY_LIMIT, DIFFICULTY_RATE_MAX, DIFFICULTY_RATE_MIN, normalizeDifficulties, type DifficultyRateKey } from "@/project/difficulty";
import { MONSTER_FUSION_LIMIT, normalizeMonsterFusions } from "@/project/monsterTrade";
import type { DifficultyRecord, MonsterFusionRecord, Project } from "@/project/types";
import { genId } from "@/util/id";
import { el } from "@/util/dom";
import { field, numberField, selectField, textControl } from "./databaseControls";

type UpdateSystem = (mutator: (draft: Project) => void, snapshotKey?: string) => void;
type Refresh = () => void;

const RATE_LABELS: readonly { readonly key: DifficultyRateKey; readonly label: string }[] = [
  { key: "enemyHpRate", label: "적 HP" },
  { key: "enemyAttackRate", label: "적 공격력" },
  { key: "expRate", label: "경험치" },
  { key: "goldRate", label: "골드" },
  { key: "encounterRate", label: "인카운트율" },
];

function storeDifficulties(draft: Project, rows: readonly Partial<DifficultyRecord>[]): void {
  const normalized = normalizeDifficulties(rows);
  if (normalized) draft.system.difficulties = normalized;
  else delete draft.system.difficulties;
  if (!normalized || !normalized.some((row) => row.id === draft.system.defaultDifficultyId)) delete draft.system.defaultDifficultyId;
}

/** 난이도 편집 — 이름 + 배율 5개(1 = 그대로). */
export function difficultyFieldset(project: Project, updateSystem: UpdateSystem, refresh: Refresh): HTMLElement[] {
  const rows = project.system.difficulties ?? [];
  const nodes: HTMLElement[] = [];
  nodes.push(el("p", {
    class: "db-system-help",
    text: "난이도가 둘 이상이면 새 게임을 시작할 때 고릅니다. 배율 1은 그대로, 2는 두 배입니다. 이벤트의 「난이도 변경」 명령으로 바꾸고 「난이도」 조건으로 읽습니다.",
  }));
  rows.forEach((row, index) => {
    const patchRow = (patch: Partial<DifficultyRecord>, key?: string) => updateSystem((draft) => {
      const current = [...(draft.system.difficulties ?? [])];
      current[index] = { ...current[index]!, ...patch };
      storeDifficulties(draft, current);
    }, key);
    nodes.push(el("div", {
      class: "db-system-difficulty-row",
      dataset: { testid: `db-system-difficulty-row-${index}` },
      children: [
        textControl("이름", row.name, (name) => patchRow({ name }, `system:difficulty:${index}:name`), `db-field-system-difficulty-name-${index}`),
        ...RATE_LABELS.map(({ key, label }) => numberField(
          label,
          `db-field-system-difficulty-${key}-${index}`,
          row[key] ?? 1,
          (value) => patchRow({ [key]: value }, `system:difficulty:${index}:${key}`),
          { min: DIFFICULTY_RATE_MIN, max: DIFFICULTY_RATE_MAX, step: 0.1 },
        )),
        el("button", {
          class: "btn",
          text: "삭제",
          attrs: { type: "button", "aria-label": `${row.name} 난이도 삭제` },
          dataset: { testid: `db-system-difficulty-remove-${index}` },
          on: {
            click: () => {
              updateSystem((draft) => storeDifficulties(draft, (draft.system.difficulties ?? []).filter((_, i) => i !== index)));
              refresh();
            },
          },
        }),
      ],
    }));
  });
  if (rows.length > 0) {
    nodes.push(selectField(
      "새 게임 기본 난이도",
      "db-field-system-default-difficulty",
      project.system.defaultDifficultyId ?? rows[0]!.id,
      rows.map((row) => ({ id: row.id, name: row.name })),
      (value) => updateSystem((draft) => {
        if (value && value !== draft.system.difficulties?.[0]?.id) draft.system.defaultDifficultyId = value;
        else delete draft.system.defaultDifficultyId;
      }),
    ));
  }
  nodes.push(el("button", {
    class: "btn",
    text: "난이도 추가",
    attrs: { type: "button", ...(rows.length >= DIFFICULTY_LIMIT ? { disabled: "true" } : {}) },
    dataset: { testid: "db-system-difficulty-add" },
    on: {
      click: () => {
        updateSystem((draft) => {
          const current = draft.system.difficulties ?? [];
          const name = current.length === 0 ? "보통" : `난이도 ${current.length + 1}`;
          storeDifficulties(draft, [...current, { id: genId("difficulty"), name }]);
        });
        refresh();
      },
    },
  }));
  return nodes;
}

function storeFusions(draft: Project, rows: readonly Partial<MonsterFusionRecord>[]): void {
  // 편집 중에는 빈 칸 줄도 남아야 한다 — 정규화는 완성된 줄만 남기므로 여기서는 원본 배열을 둔다.
  const kept = rows.map((row) => ({
    speciesA: row.speciesA ?? "",
    speciesB: row.speciesB ?? "",
    resultSpeciesId: row.resultSpeciesId ?? "",
  }));
  if (kept.length > 0) draft.system.monsterFusions = kept;
  else delete draft.system.monsterFusions;
}

/** 몬스터 합성 표 — 종 A + 종 B → 결과 종(순서 무관). */
export function monsterFusionFieldset(project: Project, updateSystem: UpdateSystem, refresh: Refresh): HTMLElement[] {
  const species = [{ id: "", name: "(선택)" }, ...(project.database.monsterSpecies ?? []).map((record) => ({ id: record.id, name: record.name }))];
  const rows = project.system.monsterFusions ?? [];
  const complete = normalizeMonsterFusions(rows)?.length ?? 0;
  const nodes: HTMLElement[] = [el("p", {
    class: "db-system-help",
    text: `이벤트의 「몬스터 합성」 명령이 두 몬스터의 종으로 이 표를 찾습니다. 완성된 줄 ${complete}개 — 칸이 빈 줄은 저장할 때 빠집니다.`,
  })];
  rows.forEach((row, index) => {
    const patchRow = (patch: Partial<MonsterFusionRecord>) => updateSystem((draft) => {
      const current = [...(draft.system.monsterFusions ?? [])];
      current[index] = { ...current[index]!, ...patch };
      storeFusions(draft, current);
    });
    nodes.push(el("div", {
      class: "db-system-fusion-row",
      dataset: { testid: `db-system-fusion-row-${index}` },
      children: [
        selectField("재료 A", `db-field-system-fusion-a-${index}`, row.speciesA, species, (speciesA) => patchRow({ speciesA })),
        selectField("재료 B", `db-field-system-fusion-b-${index}`, row.speciesB, species, (speciesB) => patchRow({ speciesB })),
        selectField("결과", `db-field-system-fusion-result-${index}`, row.resultSpeciesId, species, (resultSpeciesId) => patchRow({ resultSpeciesId })),
        el("button", {
          class: "btn",
          text: "삭제",
          attrs: { type: "button", "aria-label": `합성 ${index + 1}번 줄 삭제` },
          dataset: { testid: `db-system-fusion-remove-${index}` },
          on: {
            click: () => {
              updateSystem((draft) => storeFusions(draft, (draft.system.monsterFusions ?? []).filter((_, i) => i !== index)));
              refresh();
            },
          },
        }),
      ],
    }));
  });
  nodes.push(el("button", {
    class: "btn",
    text: "합성 줄 추가",
    attrs: { type: "button", ...(rows.length >= MONSTER_FUSION_LIMIT || species.length <= 1 ? { disabled: "true" } : {}) },
    dataset: { testid: "db-system-fusion-add" },
    on: {
      click: () => {
        updateSystem((draft) => storeFusions(draft, [...(draft.system.monsterFusions ?? []), { speciesA: "", speciesB: "", resultSpeciesId: "" }]));
        refresh();
      },
    },
  }));
  if (species.length <= 1) nodes.push(field("안내", el("span", { text: "몬스터 종이 없습니다. 먼저 몬스터 종을 만드세요." })));
  return nodes;
}
