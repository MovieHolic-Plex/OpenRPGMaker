import {
  BATTLE_MOTION_PATTERNS,
  BATTLE_MOTION_LABELS,
  buildBattleMotionTracks,
  type MotionPoint,
  type MotionRole,
  type BattleMotionProgram,
} from "@/battle/battleMotionProgram";
import { BATTLE_MOTION_DESCRIPTIONS } from "@/assets/battleMotionCatalog";
import type { SkillRecord } from "@/project/types";
import type { BattleGimmick } from "@/battle/battleGimmickRules";
import {
  numberField,
  selectField,
  textField,
  toggleSwitch,
} from "@/editor/panels/databaseControls";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { partyPixelChoices } from "@/assets/partyPixelSheets";
import { store } from "@/project/store";
import { EXTENDED_POSE_FRAME } from "@/battle/battlePose";
import { el } from "@/util/dom";
const options = BATTLE_MOTION_PATTERNS.map((id, i) => ({
  id,
  name: BATTLE_MOTION_LABELS[i]!,
}));
export function battleMotionFields(
  value: BattleMotionProgram | undefined,
  save: (next: BattleMotionProgram | undefined) => void,
): HTMLElement[] {
  const host = el("div");
  let current = value ? structuredClone(value) : undefined;
  const emit = (next: BattleMotionProgram | undefined) =>
    save(next ? structuredClone(next) : undefined);
  const render = () => {
    host.replaceChildren(
      selectField(
        "동작 설계",
        "db-motion-pattern",
        current?.pattern ?? "",
        [{ id: "", name: "기존 모션" }, ...options],
        (v) => {
          current = v
            ? { ...current, pattern: v as BattleMotionProgram["pattern"] }
            : undefined;
          emit(current);
          render();
        },
      ),
    );
    if (!current) return;
    host.append(
      el("p", {
        text: BATTLE_MOTION_DESCRIPTIONS[current.pattern],
        class: "db-skill-card-note",
      }),
    );
    const fields = [
      ["anticipationMs", "준비 시간 (ms)", 140, 40, 800, 10],
      ["travelMs", "접근 시간 (ms)", 180, 80, 1200, 10],
      ["recoveryMs", "회수 시간 (ms)", 320, 100, 1000, 10],
      ["jumpHeight", "도약 높이 (px)", 100, 24, 360, 2],
      ["apexMs", "정점 체류 (ms)", 70, 0, 400, 10],
      ["acceleration", "가속 강도", 1, 0.2, 3, 0.1],
    ] as const;
    for (const [key, label, fallback, min, max, step] of fields)
      host.append(
        numberField(
          label,
          `db-motion-${key}`,
          current[key] ?? fallback,
          (v) => {
            current = { ...current!, [key]: v };
            emit(current);
          },
          { min, max, step },
        ),
      );

    const custom = el("button", {
      text: current.tracks ? "기본 경로로 되돌리기" : "배우별 경로 직접 편집",
      attrs: { type: "button" },
      on: {
        click: () => {
          if (!current) return;
          current = { ...current };
          if (current.tracks) delete current.tracks;
          else
            current.tracks = structuredClone(
              buildBattleMotionTracks(current, [600, 860, 1120]),
            ).map((t) => ({ ...t, points: [...t.points] }));
          emit(current);
          render();
        },
      },
    });
    host.append(custom);
    if (current.tracks) {
      const anchors = [
          "home",
          "front",
          "target",
          "target2",
          "target3",
          "ally",
          "left",
          "right",
          "top",
        ],
        curves = [
          "linear",
          "pull",
          "burst",
          "walk",
          "rise",
          "fall",
          "settle",
          "flow",
        ];
      const commit = () => {
        emit(current);
      };
      for (const [index, track] of current.tracks.entries()) {
        const group = el("fieldset", {
          children: [el("legend", { text: track.role })],
        });
        for (const [i, p] of track.points.entries()) {
          const row = el("div", { class: "db-retro-choreo-layer" });
          const patch = (next: Partial<MotionPoint>) => {
            const points = [...track.points];
            points[i] = { ...points[i]!, ...next };
            track.points = points;
            commit();
          };
          row.append(
            numberField(
              "시각 ms",
              `db-motion-${index}-${i}-at`,
              p.at,
              (v) => patch({ at: v }),
              { min: 0, max: 10000 },
            ),
            selectField(
              "자리",
              `db-motion-${index}-${i}-anchor`,
              p.anchor,
              anchors.map((id) => ({ id, name: id })),
              (v) => patch({ anchor: v as MotionPoint["anchor"] }),
            ),
            numberField(
              "가로 이동 px",
              `db-motion-${index}-${i}-x`,
              p.x ?? 0,
              (v) => patch({ x: v }),
              { min: -1000, max: 1000 },
            ),
            numberField(
              "높이 px",
              `db-motion-${index}-${i}-y`,
              p.y ?? 0,
              (v) => patch({ y: v }),
              { min: -1000, max: 1000 },
            ),
            selectField(
              "속도 곡선",
              `db-motion-${index}-${i}-curve`,
              p.curve ?? "linear",
              curves.map((id) => ({ id, name: id })),
              (v) => patch({ curve: v as MotionPoint["curve"] }),
            ),
            selectField(
              "자세",
              `db-motion-${index}-${i}-pose`,
              p.pose ?? "idle",
              Object.keys(EXTENDED_POSE_FRAME).map((id) => ({ id, name: id })),
              (v) => patch({ pose: v as MotionPoint["pose"] }),
            ),
            numberField(
              "보이는 정도",
              `db-motion-${index}-${i}-alpha`,
              p.alpha ?? 1,
              (v) => patch({ alpha: v }),
              { min: 0, max: 1, step: 0.1 },
            ),
            toggleSwitch(
              "좌우 반전",
              `db-motion-${index}-${i}-flip`,
              p.flip ?? false,
              (v) => patch({ flip: v }),
            ),
            el("button", {
              text: "지점 삭제",
              attrs: {
                type: "button",
                ...(track.points.length <= 2 ? { disabled: "true" } : {}),
              },
              on: {
                click: () => {
                  track.points = track.points.filter((_, n) => n !== i);
                  commit();
                  render();
                },
              },
            }),
          );
          group.append(row);
        }
        group.append(
          el("button", {
            text: "지점 추가",
            attrs: {
              type: "button",
              ...(track.points.length >= 48 ? { disabled: "true" } : {}),
            },
            on: {
              click: () => {
                track.points = [
                  ...track.points,
                  { at: (track.points.at(-1)?.at ?? 0) + 180, anchor: "home" },
                ];
                commit();
                render();
              },
            },
          }),
        );
        host.append(group);
      }
      for (const role of [
        "user",
        "target",
        "ally",
        "cloneA",
        "cloneB",
        "summon",
      ] as MotionRole[])
        if (!current.tracks.some((t) => t.role === role))
          host.append(
            el("button", {
              text: `${role} 경로 추가`,
              attrs: { type: "button" },
              on: {
                click: () => {
                  current!.tracks!.push({
                    role,
                    points: [
                      { at: 0, anchor: role === "target" ? "target" : "home" },
                      {
                        at: 1200,
                        anchor: role === "target" ? "target" : "home",
                      },
                    ],
                  });
                  commit();
                  render();
                },
              },
            }),
          );
    }
  };
  render();
  return [host];
}
export function battleGimmickFields(record: SkillRecord): HTMLElement[] {
  const host = el("div", { dataset: { testid: "db-battle-gimmick" } });
  let current = record.battleGimmick;
  const save = (patch: Partial<BattleGimmick>) => {
    if (current) {
      current = { ...current, ...patch };
      updateDatabaseRecord("skills", record.id, { battleGimmick: current });
    }
  };
  const render = () => {
    host.replaceChildren(
      selectField(
        "전투 기믹",
        "db-gimmick-pattern",
        current?.pattern ?? "",
        [{ id: "", name: "기본 규칙" }, ...options],
        (v) => {
          current = v ? { pattern: v as BattleGimmick["pattern"] } : undefined;
          updateDatabaseRecord("skills", record.id, { battleGimmick: current });
          render();
        },
      ),
    );
    if (!current) return;
    host.append(
      el("p", {
        class: "db-skill-card-note",
        text: BATTLE_MOTION_DESCRIPTIONS[current.pattern],
      }),
      numberField(
        "지속 자기 차례",
        "db-gimmick-turns",
        current.durationTurns ?? 2,
        (v) => save({ durationTurns: v }),
        { min: 1, max: 6 },
      ),
      numberField(
        "지원 피해 배율",
        "db-gimmick-power",
        current.powerMultiplier ?? 0.45,
        (v) => save({ powerMultiplier: v }),
        { min: 0.1, max: 3, step: 0.05 },
      ),
      numberField(
        "기폭 성공률 %",
        "db-gimmick-chance",
        current.triggerChance ?? 85,
        (v) => save({ triggerChance: v }),
        { min: 0, max: 100 },
      ),
      textField(
        "표식 이름",
        "db-gimmick-mark",
        current.markKey ?? "motion",
        (v) => save({ markKey: v }),
      ),
      numberField(
        "표식 최대 중첩",
        "db-gimmick-stacks",
        current.maxStacks ?? 3,
        (v) => save({ maxStacks: v }),
        { min: 1, max: 9 },
      ),
      toggleSwitch(
        "첫 명중에 성공해야 후속 공격",
        "db-gimmick-follow",
        current.followOnHit === true,
        (v) => save({ followOnHit: v }),
      ),
      toggleSwitch(
        "표식이 있어야 공격",
        "db-gimmick-required",
        current.requiredMark === true,
        (v) => save({ requiredMark: v }),
      ),
      toggleSwitch(
        "마지막 타격에 표식 소비",
        "db-gimmick-consume",
        current.consumeMarks === true,
        (v) => save({ consumeMarks: v }),
      ),
      selectField(
        "협공·교대 동료",
        "db-gimmick-ally",
        current.allyActorId ?? "",
        [
          { id: "", name: "가능한 동료" },
          ...store.getCurrent().database.actors,
        ],
        (v) => save({ allyActorId: v || undefined }),
      ),
      selectField(
        "흡수할 속성",
        "db-gimmick-element",
        current.elementId ?? "",
        [
          { id: "", name: "모든 마법 속성" },
          ...(store.getCurrent().database.elements ?? []),
        ],
        (v) => save({ elementId: v || undefined }),
      ),
      selectField(
        "소환·변신 그림",
        "db-gimmick-resource",
        current.resourceId ?? "",
        partyPixelChoices("기본 그림", current.resourceId),
        (v) => save({ resourceId: v || undefined }),
      ),
      numberField(
        "장판 반경 (px)",
        "db-gimmick-radius",
        current.radius ?? 120,
        (v) => save({ radius: v }),
        { min: 16, max: 800 },
      ),
      numberField(
        "처치 시 최대 HP 환급 %",
        "db-gimmick-refund",
        current.killRefundPercent ?? 0,
        (v) => save({ killRefundPercent: v }),
        { min: 0, max: 100 },
      ),
    );
  };
  render();
  return [host];
}
