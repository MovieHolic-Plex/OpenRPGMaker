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
 */
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { battleLookFields } from "@/editor/panels/databaseBattleLook";
import { battleStudioHeading } from "@/editor/panels/databaseBattleStudio";
import { field } from "@/editor/panels/databaseControls";
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

function updateSystem(mutator: (draft: Project) => void): void {
  recordProjectSnapshot();
  store.update(mutator, { scope: "system", label: "전투 화면 편집" });
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
        updateSystem((draft) => applyBattleMethod(draft, method));
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
    attrs: { title: BATTLE_HIT_FEEL_IDS.map((id) => `${BATTLE_HIT_FEEL_LABELS[id]}: ${BATTLE_HIT_FEEL_DESCRIPTIONS[id]}`).join("\n") },
  });
  for (const id of BATTLE_HIT_FEEL_IDS) {
    select.append(el("option", { text: BATTLE_HIT_FEEL_LABELS[id], attrs: { value: id } }));
  }
  select.value = resolveBattleHitFeel(project.system.battleHitFeel);
  select.addEventListener("change", () => {
    updateSystem((draft) => {
      const next = resolveBattleHitFeel(select.value);
      if (next === DEFAULT_BATTLE_HIT_FEEL) delete draft.system.battleHitFeel;
      else draft.system.battleHitFeel = next;
    });
  });
  return field("타격감", select);
}

export function renderBattleScreenTab(host: HTMLElement): void {
  const project = store.getCurrent();
  const rerender = (): void => {
    host.replaceChildren();
    renderBattleScreenTab(host);
  };
  const form = el("section", {
    class: "db-detail-form db-parity-form db-battle-studio-surface db-battle-screen-studio db-ws-studio",
    dataset: { testid: "db-detail-form" },
  });
  form.append(
    battleStudioHeading("battleScreen", "전투 화면", "전투가 어떻게 보이는지 정합니다. 전투 흐름·참전 수 같은 규칙은 시스템 › 시작 설정에 있습니다."),
    el("div", {
      class: "db-battle-screen-stack",
      children: [
        battleMethodCard(project, rerender),
        sectionCard({ title: "타격감", testid: "db-battle-hit-feel-card", children: [hitFeelField(project)] }),
        sectionCard({
          title: "전투 화면 꾸미기",
          hint: "도트 측면 전투에 적용됩니다",
          testid: "db-battle-look-card",
          children: battleLookFields(project, updateSystem, rerender),
        }),
      ],
    }),
  );
  host.append(form);
}
