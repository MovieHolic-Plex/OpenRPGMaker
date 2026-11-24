/**
 * 자료집 「전투 화면」 탭 — 전투가 어떻게 보이는지를 한곳에서 정한다(2026-10-02 정리).
 *
 * - 전투 방식: 도트 측면(RM2003식, retro2003 + RM 규칙) / 몬스터 대치(포켓몬식, pokemon + Gen1 규칙) 둘뿐이다.
 *   방식 하나가 화면(system.battleUiStyle)과 규칙(system.battleModel)을 같이 정한다 — 따로 고르면 어긋난 조합이 됐다.
 *   창 색만 다르던 측면 스킨 여섯(rm2003·ff·goldensun·chrono·octopath·bravely)은 지웠다 — 저장값은 로드 때 retro2003 이 되고
 *   창 색은 꾸미기 창(battleLook.window)으로 옮겨진다. 창 색은 아래 꾸미기에서 고른다.
 * - 타격감, 전투 화면 꾸미기(프리셋·칸별 덮어쓰기·전투 테스트).
 * 전투 흐름·참전 수·초기 적 그룹 같은 규칙은 시스템 › 시작 설정에 있다.
 * 예전 이 탭의 가짜 무대 미리보기(적 그림을 사선으로 늘어놓기)와 쓰이지 않는 「전투 시스템 리소스」는 지웠다.
 * 오른쪽(좁은 화면은 위)에 진짜 전투 화면 미리보기가 있다(battleScreenPreview.ts, qa1124 항목 6). 설정을 바꾸면 그 설정이 보이는 장면을
 * 처음부터 다시 돌린다 — 타격감·적 달려들기 → 피격, 상성 알림·전투 흐름 → 공격, 연계기 컷인·화려함 → 연계기, 팡파레 → 결과, 꾸미기·전투 방식 → 대기.
 */
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { createBattleScreenPreview, type BattleScreenPreview } from "@/editor/panels/battleScreenPreview";
import type { BattlePreviewScene } from "@/editor/panels/battleScreenPreviewDemo";
import { battleLookFields } from "@/editor/panels/databaseBattleLook";
import { battleStudioHeading } from "@/editor/panels/databaseBattleStudio";
import { field, selectField, toggleSwitch } from "@/editor/panels/databaseControls";
import { BATTLE_COMBO_CUT_INS, BATTLE_COMBO_CUT_IN_LABELS, BATTLE_COMBO_FXS, BATTLE_COMBO_FX_LABELS, BATTLE_EFFECTIVENESS_FEEDBACKS, BATTLE_EFFECTIVENESS_FEEDBACK_LABELS, BATTLE_ENEMY_LUNGES, BATTLE_ENEMY_LUNGE_LABELS, BATTLE_PACES, BATTLE_PACE_LABELS, BATTLE_REVEAL_WEAKNESSES, BATTLE_REVEAL_WEAKNESS_LABELS, BATTLE_SKILL_HINTS, BATTLE_SKILL_HINT_LABELS, normalizeBattleStaging, resolveBattleStaging, type BattleComboCutIn, type BattleComboFx, type BattleEffectivenessFeedback, type BattleEnemyLunge, type BattlePace, type BattleRevealWeakness, type BattleSkillHint, type BattleStagingSettings } from "@/project/battleStaging";
import { BATTLE_FANFARE_STYLES, BATTLE_FANFARE_STYLE_LABELS, isBattleFanfareStyle, normalizeBattleFanfare, resolveBattleFanfare, type BattleFanfareSettings } from "@/project/battleFanfare";
import { ENEMY_STILL_MOTION_DESCRIPTION, ENEMY_STILL_MOTION_LABELS, ENEMY_STILL_MOTION_MODES, resolveEnemyStillMotion, type EnemyStillMotionMode } from "@/project/enemyStillMotion";
import { sectionCard } from "@/editor/panels/databaseWorkspace";
import { BATTLE_HIT_FEEL_DESCRIPTIONS, BATTLE_HIT_FEEL_IDS, BATTLE_HIT_FEEL_LABELS, DEFAULT_BATTLE_HIT_FEEL, resolveBattleHitFeel } from "@/project/battleHitFeel";
import { applyBattleMethod, BATTLE_METHOD_LABELS, battleMethodOf, type BattleMethod } from "@/project/battleMethod";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

const BATTLE_METHOD_HELP: Readonly<Record<BattleMethod, string>> = {
  side: "적은 왼쪽, 파티는 오른쪽에 도트로 서서 싸웁니다. RM식 대미지·상태 규칙. 기본값.",
  monster: "내 몬스터 한 마리와 상대가 마주 봅니다. 타입 상성과 포획이 있는 Gen1 규칙.",
};

/** 탭 하나에 미리보기 하나 — 설정을 바꿔 탭이 다시 그려져도 같은 미리보기를 새 틀에 다시 붙인다(전투를 새로 만들지 않는다). */
const previews = new WeakMap<HTMLElement, BattleScreenPreview>();
let currentPreview: BattleScreenPreview | undefined;

function previewFor(host: HTMLElement): BattleScreenPreview {
  const existing = previews.get(host);
  if (existing && !existing.isDisposed()) return existing;
  const created = createBattleScreenPreview();
  previews.set(host, created);
  return created;
}

/** 시스템 설정을 저장하고, 그 설정이 보이는 미리보기 장면을 처음부터 다시 돌린다. */
function updateSystem(mutator: (draft: Project) => void, scene: BattlePreviewScene = "idle"): void {
  recordProjectSnapshot();
  store.update(mutator, { scope: "system", label: "전투 화면 편집" });
  currentPreview?.replay(scene);
}

function battleMethodCard(project: Project, rerender: () => void): HTMLElement {
  const current = battleMethodOf(project);
  const rulesMismatch = (current === "monster") !== (project.system.battleModel === "gen1");
  const options = (Object.keys(BATTLE_METHOD_LABELS) as BattleMethod[]).map((method) => el("button", {
    class: `db-battle-method-option${method === current ? " active" : ""}`,
    attrs: { type: "button", role: "radio", "aria-checked": String(method === current) },
    dataset: { testid: `db-battle-method-${method}` },
    children: [
      el("strong", { text: BATTLE_METHOD_LABELS[method] }),
      el("small", { text: BATTLE_METHOD_HELP[method] }),
    ],
    on: {
      click: () => {
        if (method === current && !rulesMismatch) return;
        updateSystem((draft) => applyBattleMethod(draft, method), "idle");
        rerender();
      },
    },
  }));
  const notes: HTMLElement[] = [];
  if (rulesMismatch) {
    notes.push(el("p", {
      class: "db-ws-usage",
      dataset: { testid: "db-battle-method-rules-mismatch" },
      text: `화면과 규칙이 어긋나 있습니다(화면 ${BATTLE_METHOD_LABELS[current]}, 규칙 ${project.system.battleModel === "gen1" ? "Gen1" : "RM식"}). 방식을 다시 누르면 맞춰집니다.`,
    }));
  }
  return sectionCard({
    title: "전투 방식",
    hint: "화면과 규칙을 같이 정합니다",
    testid: "db-battle-method-card",
    children: [
      el("div", { class: "db-battle-method-options", attrs: { role: "radiogroup", "aria-label": "전투 방식" }, children: options }),
      ...notes,
    ],
  });
}

function hitFeelField(project: Project): HTMLElement {
  const select = el("select", {
    dataset: { testid: "db-field-system-battle-hit-feel" },
  });
  for (const id of BATTLE_HIT_FEEL_IDS) {
    select.append(el("option", { text: BATTLE_HIT_FEEL_LABELS[id], attrs: { value: id } }));
  }
  select.value = resolveBattleHitFeel(project.system.battleHitFeel);
  select.title = BATTLE_HIT_FEEL_DESCRIPTIONS[resolveBattleHitFeel(select.value)];
  select.addEventListener("change", () => {
    const next = resolveBattleHitFeel(select.value);
    select.title = BATTLE_HIT_FEEL_DESCRIPTIONS[next];
    updateSystem((draft) => {
      if (next === DEFAULT_BATTLE_HIT_FEEL) delete draft.system.battleHitFeel;
      else draft.system.battleHitFeel = next;
    }, "hit");
  });
  return field("타격감", select);
}

/** 결과 팡파레(system.battleFanfare) — LEVEL UP 배너·「새 기술 습득!」·「새 연계기!」 카드·소리. 도트 결과 화면에 적용된다. */
function fanfareCard(project: Project, rerender: () => void): HTMLElement {
  const current = resolveBattleFanfare(project.system.battleFanfare);
  const save = (patch: Partial<BattleFanfareSettings>): void => {
    updateSystem((draft) => {
      const next = normalizeBattleFanfare({ ...resolveBattleFanfare(draft.system.battleFanfare), ...patch });
      if (next) draft.system.battleFanfare = next;
      else delete draft.system.battleFanfare;
    }, "result");
    rerender();
  };
  return sectionCard({
    title: "레벨 업 · 기술 습득 연출",
    hint: "전투 결과 화면",
    testid: "db-battle-fanfare-card",
    children: [
      selectField("세기", "db-battle-fanfare-style", current.style, BATTLE_FANFARE_STYLES.map((id) => ({ id, name: BATTLE_FANFARE_STYLE_LABELS[id] })), (value) => {
        if (isBattleFanfareStyle(value)) save({ style: value });
      }),
      toggleSwitch("레벨 업 배너", "db-battle-fanfare-levelup", current.levelUp, (checked) => save({ levelUp: checked })),
      toggleSwitch("「새 기술 습득!」 카드", "db-battle-fanfare-skill", current.skillLearned, (checked) => save({ skillLearned: checked })),
      toggleSwitch("「새 연계기!」 카드", "db-battle-fanfare-combo", current.comboUnlocked, (checked) => save({ comboUnlocked: checked })),
      toggleSwitch("소리", "db-battle-fanfare-sound", current.sound, (checked) => save({ sound: checked })),
    ],
  });
}

/** 전투 연출(system.battleStaging · system.enemyStillMotion) — 적 달려들기 속도·연계기·기술 도움말·적 그림 움직임. */
function stagingCard(project: Project, rerender: () => void): HTMLElement {
  const current = resolveBattleStaging(project.system.battleStaging);
  const save = (patch: Partial<BattleStagingSettings>, scene: BattlePreviewScene): void => {
    updateSystem((draft) => {
      const next = normalizeBattleStaging({ ...resolveBattleStaging(draft.system.battleStaging), ...patch });
      if (next) draft.system.battleStaging = next;
      else delete draft.system.battleStaging;
    }, scene);
    rerender();
  };
  return sectionCard({
    title: "전투 연출",
    hint: "적 달려들기 · 연계기 · 기술 도움말",
    testid: "db-battle-staging-card",
    children: [
      selectField("적이 달려드는 속도", "db-battle-staging-lunge", current.enemyLunge, BATTLE_ENEMY_LUNGES.map((id) => ({ id, name: BATTLE_ENEMY_LUNGE_LABELS[id] })), (value) => save({ enemyLunge: value as BattleEnemyLunge }, "hit")),
      selectField("연계기 컷인", "db-battle-staging-cutin", current.comboCutIn, BATTLE_COMBO_CUT_INS.map((id) => ({ id, name: BATTLE_COMBO_CUT_IN_LABELS[id] })), (value) => save({ comboCutIn: value as BattleComboCutIn }, "combo")),
      selectField("연계기 화려함", "db-battle-staging-fx", current.comboFx, BATTLE_COMBO_FXS.map((id) => ({ id, name: BATTLE_COMBO_FX_LABELS[id] })), (value) => save({ comboFx: value as BattleComboFx }, "combo")),
      selectField("기술 도움말", "db-battle-staging-hint", current.skillHint, BATTLE_SKILL_HINTS.map((id) => ({ id, name: BATTLE_SKILL_HINT_LABELS[id] })), (value) => save({ skillHint: value as BattleSkillHint }, "idle")),
      selectField("적 약점 표시", "db-battle-staging-reveal-weakness", current.revealWeakness, BATTLE_REVEAL_WEAKNESSES.map((id) => ({ id, name: BATTLE_REVEAL_WEAKNESS_LABELS[id] })), (value) => save({ revealWeakness: value as BattleRevealWeakness }, "idle")),
      selectField("맞힌 뒤 상성 알림", "db-battle-staging-effectiveness-feedback", current.effectivenessFeedback, BATTLE_EFFECTIVENESS_FEEDBACKS.map((id) => ({ id, name: BATTLE_EFFECTIVENESS_FEEDBACK_LABELS[id] })), (value) => save({ effectivenessFeedback: value as BattleEffectivenessFeedback }, "attack")),
      selectField("전투 흐름", "db-battle-staging-pace", current.pace, BATTLE_PACES.map((id) => ({ id, name: BATTLE_PACE_LABELS[id] })), (value) => save({ pace: value as BattlePace }, "attack")),
      selectField("적 그림 움직임", "db-battle-enemy-still-motion", resolveEnemyStillMotion(project),
        ENEMY_STILL_MOTION_MODES.map((id) => ({ id, name: ENEMY_STILL_MOTION_LABELS[id] })),
        (value) => {
          updateSystem((draft) => {
            if (value === "all") delete draft.system.enemyStillMotion;
            else draft.system.enemyStillMotion = value as EnemyStillMotionMode;
          }, "idle");
          rerender();
        }),
      el("p", { class: "db-ws-card-hint", text: ENEMY_STILL_MOTION_DESCRIPTION }),
    ],
  });
}

export function renderBattleScreenTab(host: HTMLElement): void {
  const project = store.getCurrent();
  const rerender = (): void => {
    host.replaceChildren();
    renderBattleScreenTab(host);
  };
  const preview = previewFor(host);
  currentPreview = preview;
  const form = el("section", {
    class: "db-detail-form db-parity-form db-battle-studio-surface db-battle-screen-studio db-ws-studio",
    dataset: { testid: "db-detail-form" },
  });
  // 「전투 테스트」는 진짜 전투를 편집기 위에 따로 연다 — 그동안 미리보기는 소리·화면을 내려 둔다.
  form.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("[data-testid='db-battle-look-test']")) preview.pause();
  }, true);
  const stack = el("div", {
    class: "db-battle-screen-stack",
    children: [
      battleMethodCard(project, rerender),
      sectionCard({ title: "타격감", testid: "db-battle-hit-feel-card", children: [hitFeelField(project)] }),
      fanfareCard(project, rerender),
      stagingCard(project, rerender),
      sectionCard({
        title: "전투 화면 꾸미기",
        hint: "도트 측면 전투에 적용됩니다",
        testid: "db-battle-look-card",
        children: battleLookFields(project, updateSystem, rerender),
      }),
    ],
  });
  form.append(
    battleStudioHeading("battleScreen", "전투 화면", "전투가 어떻게 보이는지 정합니다. 전투 흐름·참전 수 같은 규칙은 시스템 › 시작 설정에 있습니다."),
    el("div", {
      class: "db-battle-screen-layout",
      children: [stack, el("aside", { class: "db-battle-screen-aside", children: [preview.element] })],
    }),
  );
  host.append(form);
}
