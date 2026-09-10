// editor/panels/mapLocationAdoptionPanel.ts
// 「설계 영역 이관」 창 — 빌더가 만든 `layoutPlan.regions` 를 사람이 **보고 골라서** 명명
// 로케이션으로 옮기는 표면. OPRN-OUT-020 이 제품 책임자에게 미뤄 둔 일괄 이관의 실물이다.
//
// 화면 순서가 곧 안전 계약이다:
//   1) **조사 먼저.** 창을 열면 맵별로 몇 개가 후보인지 보여 주기만 한다 — 열기만으로는 아무것도 안 바뀐다.
//   2) **역할 필터.** 기본은 광장·장터뿐이다(시공 전용 낱말은 꺼져 있고, 왜 껐는지 화면에 적혀 있다).
//   3) **맵 체크박스.** 아무것도 안 고르면 실행이 거부된다. 「전체」는 사용자가 누르는 버튼이지 기본값이 아니다.
//   4) **실행 후 영수증.** 만든 것 / 이름이 밀린 것 / 다시 묶은 것 / 건너뛴 것을 전부 적는다.
//      두 번째 실행은 「이미 전부 승격돼 있습니다」로 끝나고, 그게 화면에 남는 멱등성 증거다.
//
// 되돌림: 실행 전체가 스냅샷 1건이다(상태 모듈이 보장). 영수증에도 그 사실을 적어 둔다.

import {
  ADOPTION_HISTORY_LABEL,
  adoptionWorkbenchState,
  closeAdoptionWorkbench,
  currentAdoptionSurvey,
  openAdoptionWorkbench,
  resetAdoptionRoles,
  runAdoption,
  setAdoptionCollisionPolicy,
  setAdoptionMapSelection,
  subscribeAdoptionWorkbench,
  toggleAdoptionMap,
  toggleAdoptionRole,
} from "@/editor/mapLocationAdoptionState";
import {
  DEFAULT_ADOPTION_ROLES,
  adoptionRoleCaution,
  adoptionRoleLabel,
  describeAdoptionOutcome,
  type AdoptionOutcome,
  type MapAdoptionSurvey,
  type ProjectAdoptionSurvey,
} from "@/project/mapLocationAdoption";
import { store } from "@/project/store";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { clearChildren, el } from "@/util/dom";
import { toast } from "@/util/toast";

export const ADOPTION_TESTIDS = {
  host: "location-adoption-panel",
  open: "location-adoption-open",
  close: "location-adoption-close",
  survey: "location-adoption-survey",
  summary: "location-adoption-summary",
  roleFilter: "location-adoption-roles",
  selectAll: "location-adoption-select-all",
  clearSelection: "location-adoption-clear-selection",
  run: "location-adoption-run",
  receipt: "location-adoption-receipt",
  empty: "location-adoption-empty",
  policy: "location-adoption-policy",
} as const;

export function adoptionMapRowTestId(mapId: string): string {
  return `location-adoption-map-${mapId}`;
}

export function adoptionMapCheckboxTestId(mapId: string): string {
  return `location-adoption-check-${mapId}`;
}

export function adoptionRoleCheckboxTestId(role: string): string {
  return `location-adoption-role-${role}`;
}

let overlayEl: HTMLElement | null = null;
let unregister: (() => void) | null = null;
let unsubscribe: (() => void) | null = null;
let storeUnsubscribe: (() => void) | null = null;

function domAvailable(): boolean {
  return typeof document !== "undefined" && typeof document.createElement === "function" && Boolean(document.body);
}

/** 창을 여는 유일한 진입점. 조사만 하고 store 를 만지지 않는다. */
export function openLocationAdoptionPanel(): void {
  openAdoptionWorkbench();
  mount();
}

export function closeLocationAdoptionPanel(): void {
  closeAdoptionWorkbench();
  unmount();
}

function unmount(): void {
  if (overlayEl) {
    unregisterModal(overlayEl);
    overlayEl.remove();
    overlayEl = null;
  }
  unregister?.();
  unregister = null;
  unsubscribe?.();
  unsubscribe = null;
  storeUnsubscribe?.();
  storeUnsubscribe = null;
}

function mount(): void {
  if (!domAvailable() || overlayEl) {
    if (overlayEl) render();
    return;
  }
  overlayEl = el("div", { class: "app-modal-overlay location-adoption-overlay", dataset: { testid: ADOPTION_TESTIDS.host } });
  overlayEl.addEventListener("click", (event) => {
    if (event.target === overlayEl) closeLocationAdoptionPanel();
  });
  document.body.append(overlayEl);
  unregister = registerModal(overlayEl, () => closeLocationAdoptionPanel());
  unsubscribe = subscribeAdoptionWorkbench(() => render());
  // 실행 결과가 store 로 들어가면 조사도 즉시 다시 세어야 한다(멱등 표시가 살아 있어야 한다).
  storeUnsubscribe = store.subscribe(() => {
    if (adoptionWorkbenchState().open) render();
  });
  render();
}

function render(): void {
  if (!overlayEl) return;
  clearChildren(overlayEl);
  const state = adoptionWorkbenchState();
  const survey = currentAdoptionSurvey();
  const card = el("div", {
    class: "app-modal-card location-adoption-card",
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": "설계 영역 이관" },
  });

  card.append(
    el("div", {
      class: "location-adoption-header",
      children: [
        el("div", {
          children: [
            el("strong", { text: "설계 영역 → 이름 붙은 구역 이관" }),
            el("p", {
              class: "location-adoption-lede",
              text:
                "마을 빌더가 남긴 설계 기록(layoutPlan)을 사람·이벤트·인카운터가 이름으로 가리키는 구역으로 옮깁니다. " +
                "설계 기록 자체는 한 바이트도 바뀌지 않고, 고른 맵에만 적용됩니다.",
            }),
          ],
        }),
        el("button", {
          class: "btn btn-ghost",
          text: "닫기",
          attrs: { type: "button" },
          dataset: { testid: ADOPTION_TESTIDS.close },
          on: { click: () => closeLocationAdoptionPanel() },
        }),
      ],
    }),
  );

  if (survey.maps.length === 0) {
    card.append(
      el("p", {
        class: "location-adoption-empty",
        text: "이 프로젝트에는 빌더 설계 기록(layoutPlan.regions)이 있는 맵이 없습니다. 이관할 것이 없습니다.",
        dataset: { testid: ADOPTION_TESTIDS.empty },
      }),
    );
    overlayEl.append(card);
    return;
  }

  card.append(renderRoleFilter(survey));
  card.append(renderSummary(survey, state.selectedMapIds));
  card.append(renderSurvey(survey, state.selectedMapIds));
  card.append(renderPolicy(state.collisionPolicy));
  card.append(renderActions(survey, state.selectedMapIds.size));
  if (state.lastError) {
    card.append(el("p", { class: "location-adoption-error", text: state.lastError }));
  }
  if (state.lastOutcome) card.append(renderReceipt(state.lastOutcome));
  overlayEl.append(card);
}

function renderRoleFilter(survey: ProjectAdoptionSurvey): HTMLElement {
  const box = el("fieldset", { class: "location-adoption-roles", dataset: { testid: ADOPTION_TESTIDS.roleFilter } });
  box.append(el("legend", { text: "가져올 역할" }));
  box.append(
    el("p", {
      class: "location-adoption-roles-why",
      text:
        `기본은 ${DEFAULT_ADOPTION_ROLES.map(adoptionRoleLabel).join(" · ")} 뿐입니다. ` +
        "나머지는 빌더가 시공·검증용으로 남긴 낱말이라, 켜면 저작자가 쓴 적 없는 이름이 게임에 그대로 실립니다.",
    }),
  );
  for (const role of survey.roles) {
    const checked = survey.selectedRoles.includes(role);
    const input = el("input", {
      attrs: { type: "checkbox", "aria-label": `${adoptionRoleLabel(role)} 역할 가져오기` },
      dataset: { testid: adoptionRoleCheckboxTestId(role) },
    }) as HTMLInputElement;
    input.checked = checked;
    input.addEventListener("change", () => toggleAdoptionRole(role, input.checked));
    const total = survey.maps.reduce(
      (sum, map) => sum + (map.roleCounts.find((entry) => entry.role === role)?.total ?? 0),
      0,
    );
    const caution = adoptionRoleCaution(role);
    const row = el("label", {
      class: `location-adoption-role-row${caution ? " is-cautious" : ""}`,
      ...(caution ? { attrs: { title: caution } } : {}),
    });
    row.append(
      input,
      el("span", { class: "location-adoption-role-name", text: `${adoptionRoleLabel(role)} (${role})` }),
      el("span", { class: "location-adoption-role-count", text: `${total}개` }),
    );
    if (caution) row.append(el("span", { class: "location-adoption-role-caution", text: caution }));
    box.append(row);
  }
  box.append(
    el("button", {
      class: "btn btn-ghost",
      text: "기본값으로",
      attrs: { type: "button", title: `기본 선택: ${DEFAULT_ADOPTION_ROLES.join(", ")}` },
      on: { click: () => resetAdoptionRoles() },
    }),
  );
  return box;
}

function renderSummary(survey: ProjectAdoptionSurvey, selected: ReadonlySet<string>): HTMLElement {
  const chosen = survey.maps.filter((map) => selected.has(map.mapId));
  const chosenCount = chosen.reduce((sum, map) => sum + map.adoptableCount, 0);
  return el("p", {
    class: "location-adoption-summary",
    dataset: { testid: ADOPTION_TESTIDS.summary },
    text:
      `설계 기록이 있는 맵 ${survey.maps.length}개 · 지금 필터로 승격 후보 ${survey.totalAdoptable}개. ` +
      (selected.size === 0
        ? "고른 맵이 없어 실행해도 아무것도 바뀌지 않습니다."
        : `고른 맵 ${selected.size}개에서 ${chosenCount}개를 새로 만듭니다.`),
  });
}

function renderSurvey(survey: ProjectAdoptionSurvey, selected: ReadonlySet<string>): HTMLElement {
  const list = el("ul", { class: "location-adoption-list", dataset: { testid: ADOPTION_TESTIDS.survey } });
  for (const map of survey.maps) list.append(renderMapRow(map, selected.has(map.mapId)));
  return list;
}

function renderMapRow(map: MapAdoptionSurvey, checked: boolean): HTMLElement {
  const item = el("li", {
    class: `location-adoption-row${checked ? " is-selected" : ""}`,
    dataset: { testid: adoptionMapRowTestId(map.mapId) },
  });
  const input = el("input", {
    attrs: { type: "checkbox", "aria-label": `${map.mapName} 이관 대상으로 선택` },
    dataset: { testid: adoptionMapCheckboxTestId(map.mapId) },
  }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener("change", () => toggleAdoptionMap(map.mapId, input.checked));

  const roleBreakdown = map.roleCounts
    .map((entry) => `${adoptionRoleLabel(entry.role)} ${entry.adoptable}/${entry.total}`)
    .join(" · ");

  const label = el("label", { class: "location-adoption-row-main" });
  label.append(
    input,
    el("span", {
      class: "location-adoption-row-text",
      children: [
        el("span", { class: "location-adoption-map-name", text: `${map.mapName} (${map.mapId})` }),
        el("span", {
          class: "location-adoption-map-counts",
          text: `승격 후보 ${map.adoptableCount}개 · 이미 승격 ${map.adoptedCount}개${
            map.rebindableCount > 0 ? ` · 재시공으로 다시 묶을 것 ${map.rebindableCount}개` : ""
          }`,
        }),
        el("span", { class: "location-adoption-map-roles", text: roleBreakdown || "선택한 역할에 해당하는 영역 없음" }),
      ],
    }),
  );
  item.append(label);

  if (map.collisions.length > 0) {
    item.append(
      el("p", {
        class: "location-adoption-collision",
        dataset: { testid: `location-adoption-collision-${map.mapId}` },
        text: `이름 충돌 ${map.collisions.length}건: ${map.collisions.map((entry) => entry.name).join(", ")} — 기존 구역 이름은 그대로 두고 아래 정책대로 처리합니다.`,
      }),
    );
  }
  if (map.orphanedLocations.length > 0) {
    item.append(
      el("p", {
        class: "location-adoption-orphan",
        dataset: { testid: `location-adoption-orphan-${map.mapId}` },
        text: `출처 설계 영역이 사라진 구역 ${map.orphanedLocations.length}개(${map.orphanedLocations
          .map((entry) => entry.name)
          .join(", ")}) — 재시공 흔적입니다. 구역과 참조는 그대로 두고 알리기만 합니다.`,
      }),
    );
  }
  return item;
}

function renderPolicy(policy: "suffix" | "skip"): HTMLElement {
  const box = el("fieldset", { class: "location-adoption-policy", dataset: { testid: ADOPTION_TESTIDS.policy } });
  box.append(el("legend", { text: "이름이 겹칠 때" }));
  const options: readonly { readonly value: "suffix" | "skip"; readonly label: string }[] = [
    { value: "suffix", label: "뒤에 번호를 붙여 만든다 (영수증에 어떤 이름이 밀렸는지 적힙니다)" },
    { value: "skip", label: "겹치는 것은 만들지 않는다 (직접 정리한 뒤 다시 실행)" },
  ];
  for (const option of options) {
    const radio = el("input", {
      attrs: { type: "radio", name: "location-adoption-policy", value: option.value },
      dataset: { testid: `location-adoption-policy-${option.value}` },
    }) as HTMLInputElement;
    radio.checked = policy === option.value;
    radio.addEventListener("change", () => {
      if (radio.checked) setAdoptionCollisionPolicy(option.value);
    });
    const row = el("label", { class: "location-adoption-policy-row" });
    row.append(radio, el("span", { text: option.label }));
    box.append(row);
  }
  box.append(el("p", { class: "location-adoption-policy-note", text: "어느 쪽이든 기존 구역의 이름과 ID 는 바뀌지 않습니다." }));
  return box;
}

function renderActions(survey: ProjectAdoptionSurvey, selectedCount: number): HTMLElement {
  const bar = el("div", { class: "location-adoption-actions" });
  bar.append(
    el("button", {
      class: "btn btn-ghost",
      text: "후보 있는 맵 모두 고르기",
      attrs: { type: "button" },
      dataset: { testid: ADOPTION_TESTIDS.selectAll },
      on: {
        click: () =>
          setAdoptionMapSelection(survey.maps.filter((map) => map.adoptableCount > 0 || map.rebindableCount > 0).map((map) => map.mapId)),
      },
    }),
    el("button", {
      class: "btn btn-ghost",
      text: "선택 해제",
      attrs: { type: "button" },
      dataset: { testid: ADOPTION_TESTIDS.clearSelection },
      on: { click: () => setAdoptionMapSelection([]) },
    }),
    el("button", {
      class: "btn btn-primary",
      text: selectedCount === 0 ? "가져오기 (맵을 고르세요)" : `고른 ${selectedCount}개 맵에서 가져오기`,
      attrs: {
        type: "button",
        title: `되돌리기 한 번(Ctrl+Z, '${ADOPTION_HISTORY_LABEL}')으로 전부 취소됩니다.`,
      },
      dataset: { testid: ADOPTION_TESTIDS.run },
      on: {
        click: () => {
          const result = runAdoption();
          if (!result.ok) {
            toast(result.error, "error");
            return;
          }
          toast(result.message, "info");
        },
      },
    }),
  );
  return bar;
}

function renderReceipt(outcome: AdoptionOutcome): HTMLElement {
  const box = el("div", { class: "location-adoption-receipt", dataset: { testid: ADOPTION_TESTIDS.receipt } });
  box.append(el("strong", { text: "실행 결과" }));
  box.append(el("p", { class: "location-adoption-receipt-line", text: describeAdoptionOutcome(outcome) }));
  box.append(
    el("p", {
      class: "location-adoption-receipt-undo",
      text: `되돌리기 한 번(Ctrl+Z, '${ADOPTION_HISTORY_LABEL}')이면 이 실행 전체가 사라집니다.`,
    }),
  );
  const renamed = outcome.adopted.filter((entry) => entry.renamedFrom);
  if (renamed.length > 0) {
    const list = el("ul", { class: "location-adoption-renamed", dataset: { testid: "location-adoption-renamed" } });
    for (const entry of renamed) {
      list.append(el("li", { text: `${entry.renamedFrom} → ${entry.name} (${entry.mapId} / ${entry.locationId})` }));
    }
    box.append(el("p", { class: "location-adoption-receipt-line", text: "이름이 겹쳐 이렇게 바꿔 만들었습니다:" }), list);
  }
  if (outcome.skippedNameCollision.length > 0) {
    box.append(
      el("p", {
        class: "location-adoption-receipt-line",
        dataset: { testid: "location-adoption-skipped-collision" },
        text: `이름이 겹쳐 만들지 않은 것: ${outcome.skippedNameCollision.map((entry) => entry.name).join(", ")}`,
      }),
    );
  }
  if (outcome.rebound.length > 0) {
    box.append(
      el("p", {
        class: "location-adoption-receipt-line",
        dataset: { testid: "location-adoption-rebound" },
        text: `재시공으로 설계 ID 가 바뀐 ${outcome.rebound.length}개는 기존 구역에 다시 묶었습니다 — 새 구역을 만들지 않았고 참조도 그대로입니다.`,
      }),
    );
  }
  return box;
}
