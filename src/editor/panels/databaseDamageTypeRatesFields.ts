import { numberField, selectField } from "@/editor/panels/databaseControls";
import { store } from "@/project/store";
import type { DamageTypeRates } from "@/project/types";
import { el } from "@/util/dom";

/**
 * 받는 피해 계열 % — 물리 · 마법 · 속성 예외(맞은 속성이 여기 있으면 계열 값 대신 이 값).
 * 적(EnemyRecord.damageTypeRates)과 상태(runtimeEffects.damageTypeRates, 걸린 동안 적 값을 갈아 끼움)가 같이 쓴다.
 * 100 = 보통, 0 = 무효, 300 = 세 배. 모두 100·예외 없음이면 undefined 를 넘긴다(옛 JSON 을 바꾸지 않는다).
 */
export function damageTypeRatesFields(
  testidPrefix: string,
  read: () => DamageTypeRates | undefined,
  write: (rates: DamageTypeRates | undefined) => void,
  rerender: () => void,
): HTMLElement[] {
  const commit = (next: DamageTypeRates): void => {
    const out: DamageTypeRates = {};
    if (next.physical !== undefined && next.physical !== 100) out.physical = next.physical;
    if (next.magic !== undefined && next.magic !== 100) out.magic = next.magic;
    if (next.elements && Object.keys(next.elements).length > 0) out.elements = next.elements;
    write(Object.keys(out).length > 0 ? out : undefined);
  };
  const clamp = (value: number) => Math.round(Math.max(0, Math.min(1000, value)));
  const current = read() ?? {};
  const elements = store.getCurrent().database.elements ?? [];
  const nameOf = (id: string) => elements.find((entry) => entry.id === id)?.name ?? id;
  const exceptionRows = Object.entries(current.elements ?? {}).map(([elementId, value]) =>
    el("div", {
      class: "db-damage-type-exception",
      children: [
        numberField(`속성 예외 · ${nameOf(elementId)} (%)`, `${testidPrefix}-element-${elementId}`, value, (next) => {
          const now = read() ?? {};
          commit({ ...now, elements: { ...(now.elements ?? {}), [elementId]: clamp(next) } });
        }, { min: 0, max: 1000, step: 25 }),
        el("button", {
          class: "db-ws-btn",
          text: "빼기",
          attrs: { type: "button" },
          dataset: { testid: `${testidPrefix}-element-${elementId}-remove` },
          on: { click: () => {
            const now = read() ?? {};
            const rest = { ...(now.elements ?? {}) };
            delete rest[elementId];
            commit({ ...now, elements: rest });
            rerender();
          } },
        }),
      ],
    }));
  const unused = elements.filter((entry) => current.elements?.[entry.id] === undefined);
  return [
    el("p", { class: "db-skill-card-note", text: "받는 피해 % — 100 보통 · 0 무효 · 300 세 배. 속성 예외는 그 속성으로 맞으면 물리·마법 값 대신 쓴다(예: 기계 형태 물리 0 · 마법 25 · 번개 200)." }),
    numberField("받는 물리 피해 (%)", `${testidPrefix}-physical`, current.physical ?? 100, (value) =>
      commit({ ...(read() ?? {}), physical: clamp(value) }), { min: 0, max: 1000, step: 25 }),
    numberField("받는 마법 피해 (%)", `${testidPrefix}-magic`, current.magic ?? 100, (value) =>
      commit({ ...(read() ?? {}), magic: clamp(value) }), { min: 0, max: 1000, step: 25 }),
    ...exceptionRows,
    ...(unused.length
      ? [selectField("속성 예외 더하기", `${testidPrefix}-element-add`, "", [{ id: "", name: "(속성 고르기)" }, ...unused.map((entry) => ({ id: entry.id, name: entry.name }))], (elementId) => {
          if (!elementId) return;
          const now = read() ?? {};
          commit({ ...now, elements: { ...(now.elements ?? {}), [elementId]: 200 } });
          rerender();
        })]
      : []),
  ];
}
