// 계절·날씨 탭 — 계절 레일 + 확률 인스펙터 (2026-08 모던 개편).
//
// 예전 구조는 "제목 / 툴바 / 2×2 계절 카드" 한 덩어리였다. 감사에서 나온 결함:
//   - 목록→상세 구조가 아예 없어 무엇도 선택할 수 없고 인스펙터도 없었다(축 A).
//   - 기본 CTA 가 두 번 그려졌다 — 툴바의 외곽선 `btn` 과 빈 상태의 채운 버튼이
//     둘 다 "4계절 기본 날씨 만들기" 였고 같은 seedDefaultWeather() 를 불렀다(축 D).
//   - 확률 시각화가 전무했다. 규칙은 숫자 입력 세 개, 카드는 "가중치 합계 N" 만 찍었다.
//     날씨 종류가 다섯으로 고정인데 **비율(%)** 이 어디에도 없었다(축 F).
//
// 그래서: 계절은 왼쪽 레일에서 고르고, 오른쪽 인스펙터가 그 계절의 누적 막대 + 규칙
// 표를 보여준다. 가중치는 사람이 % 로 읽고 싶어하는 값이라 규칙마다 비율 칩을 붙이고,
// 다섯 종류 전부를 범례에 세워 0% 인 종류도 "없다"는 사실이 보이게 한다.
//
// 계약(테스트가 의존):
//   db-weather-workspace          — 탭 루트
//   db-weather-season-<season>    — 계절마다 **항상 보이는** 노드 + data-count
//                                   (stardew-p1-editor.spec.ts:54)
//   db-weather-enabled            — checkbox (toBeChecked)
//   db-weather-forecast-days      — number input (toHaveValue "3")
//   db-weather-seed-defaults      — 기본값 CTA. 설정이 없을 땐 생성, 있을 땐 되돌리기.
//                                   **한 화면에 하나만** 존재한다.

import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { numberField, toggleSwitch } from "@/editor/panels/databaseControls";
import {
  detailHero,
  detailPane,
  emptyState,
  listPane,
  listRow,
  listSearch,
  listToolbar,
  noticeBar,
  sectionCard,
  workspaceShell,
} from "@/editor/panels/databaseWorkspace";
import { SEASONS } from "@/project/gameTime";
import { store } from "@/project/store";
import type { DailyWeatherConfig, DailyWeatherRule, Season, WeatherKind } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

/** 날씨 종류는 다섯으로 고정 — "잔잔함 → 거침" 순으로 세워 막대가 그라데이션처럼 읽힌다. */
const WEATHER_KINDS: readonly WeatherKind[] = ["none", "fog", "rain", "snow", "storm"];
const SEASON_LABEL: Record<Season, string> = { spring: "봄", summer: "여름", fall: "가을", winter: "겨울" };
const WEATHER_LABEL: Record<WeatherKind, string> = {
  none: "맑음",
  rain: "비",
  storm: "폭풍",
  snow: "눈",
  fog: "안개",
};
/**
 * 종류별 색 대신 **단일 액센트의 농도 램프**를 쓴다. DB 모달은 --db-studio-* 토큰만
 * 허용하는데(스타일 규약) 다섯 가지 색상(hue)을 만들 토큰이 없다. 농도 + 범례 라벨로
 * 구분하는 편이 임의의 새 hex 를 들이는 것보다 낫다.
 */
const WEATHER_SHADE: Record<WeatherKind, string> = {
  none: "0.16",
  fog: "0.34",
  rain: "0.54",
  snow: "0.72",
  storm: "0.94",
};

let selectedSeason: Season = "spring";
let seasonQuery = "";

export function renderDailyWeatherTab(host: HTMLElement, rerender: () => void): void {
  const weather = store.getCurrent().system.dailyWeather;
  host.append(weather ? configuredWorkspace(weather, rerender) : unconfiguredWorkspace(rerender));
}

// ---------------------------------------------------------------------------
// 아직 설정이 없을 때
//
// 빈 상태를 가운데 420px 카드 하나로 끝내면 인스펙터의 84% 가 흰 여백으로 남는다
// (게이트 detailDead). 그래서 "누르면 무엇이 생기는가"를 실제 기본값으로 미리 그린다 —
// 밀도도 채우고 CTA 의 결과도 설명한다.
// ---------------------------------------------------------------------------

function unconfiguredWorkspace(rerender: () => void): HTMLElement {
  const empty = emptyState({
    icon: "🌦",
    title: "아직 날씨 규칙이 없습니다",
    body: "기본값을 만들면 네 계절의 맑음·비·폭풍·눈·안개 확률표가 한 번에 채워집니다.",
    action: {
      label: "4계절 기본 날씨 만들기",
      kind: "primary",
      testid: "db-weather-seed-defaults",
      onClick: () => seedDefaultWeather(rerender),
    },
    testid: "db-weather-empty",
  });
  const notice = noticeBar({
    text: "아래 네 장은 저장된 값이 아니라 기본값 미리보기입니다. 만든 뒤에는 계절마다 규칙을 자유롭게 고칠 수 있습니다.",
    testid: "db-weather-preview-notice",
  });
  notice.classList.add("db-ws-span");

  return workspaceShell({
    testid: "db-weather-workspace",
    detail: detailPane({
      hero: detailHero({
        eyebrow: "계절·날씨",
        title: "계절·날씨",
        subtitle: "계절별 확률표에서 오늘 날씨와 예보를 결정합니다.",
        tags: ["규칙 0개", "날씨 사용 안 함"],
        testid: "db-weather-hero",
      }),
      body: el("div", {
        class: "db-ws-stack",
        children: [
          notice,
          empty,
          ...SEASONS.map((season) => previewCard(season)),
          effectsCard(),
        ],
      }),
      testid: "db-weather-detail-pane",
    }),
  });
}

function previewCard(season: Season): HTMLElement {
  const rules = defaultRulesFor(season);
  const total = sumWeight(rules);
  return sectionCard({
    title: `${SEASON_LABEL[season]} 기본값`,
    hint: `규칙 ${rules.length}개 · 가중치 합계 ${total}`,
    children: [
      shareBar(rules),
      el("div", {
        class: "db-wa-preview-rules",
        children: rules.map((rule) => previewRuleRow(rule, total)),
      }),
    ],
    testid: `db-weather-preview-${season}`,
  });
}

function previewRuleRow(rule: DailyWeatherRule, total: number): HTMLElement {
  const swatch = el("span", { class: "db-wa-swatch", attrs: { "aria-hidden": "true" } });
  swatch.style.setProperty("opacity", WEATHER_SHADE[rule.kind]);
  return el("div", {
    class: "db-wa-preview-rule",
    children: [
      swatch,
      el("span", { class: "db-wa-preview-rule-name", text: WEATHER_LABEL[rule.kind] }),
      el("span", { class: "db-wa-preview-rule-weight", text: `가중치 ${rule.weight}` }),
      el("span", { class: "db-wa-preview-rule-percent", text: formatPercent(total > 0 ? (rule.weight / total) * 100 : 0) }),
    ],
  });
}

/** 여기 적힌 건 전부 런타임 코드에서 확인한 동작이다 — "아마 이럴 것" 을 쓰지 않는다. */
function effectsCard(): HTMLElement {
  const rows: readonly (readonly [string, string])[] = [
    ["뽑는 방식", "같은 계절 안에서 가중치 비율대로 하루치를 뽑습니다. 합계가 0이면 언제나 맑음입니다."],
    ["밭 자동 급수", "비·폭풍이고 강도가 0보다 클 때만 갈아둔 밭이 자동으로 젖습니다."],
    ["예보", "날씨 사용이 켜져 있을 때 내일부터 예보 일수만큼 미리 계산합니다."],
    ["낚시", "물고기 규칙에 날씨 조건이 걸려 있으면 그날 날씨로 걸러집니다."],
    ["재현성", "같은 날짜와 같은 세이브라면 언제 다시 계산해도 같은 날씨가 나옵니다."],
  ];
  return sectionCard({
    title: "이 확률표가 게임에서 하는 일",
    hint: "규칙을 만들기 전에 알아두면 좋은 것들",
    children: [
      el("dl", {
        class: "db-wa-facts",
        children: rows.flatMap(([label, text]) => [
          el("dt", { class: "db-wa-fact-label", text: label }),
          el("dd", { class: "db-wa-fact-text", text }),
        ]),
      }),
    ],
    testid: "db-weather-effects-card",
  });
}

// ---------------------------------------------------------------------------
// 설정이 있을 때 — 계절 레일 + 인스펙터
// ---------------------------------------------------------------------------

function configuredWorkspace(weather: DailyWeatherConfig, rerender: () => void): HTMLElement {
  const query = seasonQuery.trim();
  const visible = SEASONS.filter((season) => matchesSeason(season, weather.seasons[season] ?? [], query));
  if (!visible.includes(selectedSeason)) selectedSeason = visible[0] ?? "spring";

  const list = listPane({
    title: "계절",
    count: `${SEASONS.length}계절`,
    search: listSearch({
      placeholder: "계절·날씨 종류 검색",
      value: seasonQuery,
      testid: "db-weather-search",
      onInput: (value) => {
        seasonQuery = value;
        rerender();
      },
    }),
    rows: visible.map((season) => seasonRailRow(season, weather.seasons[season] ?? [], rerender)),
    empty: emptyState({
      icon: "⌕",
      title: "일치하는 계절이 없습니다",
      body: `"${query}" 를 쓰는 날씨 규칙이 없습니다.`,
      compact: true,
    }),
    toolbar: listToolbar([
      {
        label: "+ 날씨 규칙",
        kind: "primary",
        testid: `db-weather-add-${selectedSeason}`,
        title: `${SEASON_LABEL[selectedSeason]}에 규칙을 하나 더 추가합니다`,
        onClick: () => mutateRules(selectedSeason, (next) => next.push({ kind: "none", weight: 1, intensity: 0 }), rerender),
      },
    ]),
    testid: "db-weather-list-pane",
  });

  const rules = weather.seasons[selectedSeason] ?? [];
  const detail = detailPane({
    hero: detailHero({
      eyebrow: "계절",
      title: `${SEASON_LABEL[selectedSeason]} 확률표`,
      subtitle: "가중치는 서로의 비율로만 의미가 있습니다 — 오른쪽 비율 칩이 실제 확률입니다.",
      tags: [
        `규칙 ${rules.length}개`,
        `가중치 합계 ${sumWeight(rules)}`,
        weather.enabled ? `예보 ${weather.forecastDays ?? 3}일` : "날씨 사용 안 함",
      ],
      testid: "db-weather-hero",
    }),
    body: weatherInspector(weather, selectedSeason, rerender),
    testid: "db-weather-detail-pane",
  });

  return workspaceShell({ list, detail, testid: "db-weather-workspace" });
}

/**
 * 계절 레일 행. stardew-p1-editor.spec.ts 는 `db-weather-season-<season>` 이 **보이고**
 * `data-count` 가 1 이상이길 요구한다 — 예전엔 카드에 붙어 있던 계약을 이 행이 잇는다.
 */
function seasonRailRow(season: Season, rules: readonly DailyWeatherRule[], rerender: () => void): HTMLElement {
  const total = sumWeight(rules);
  const top = dominantKind(rules);
  return listRow({
    name: SEASON_LABEL[season],
    sub: `${rules.length}개 규칙`,
    number: top ? `${WEATHER_LABEL[top.kind]} ${formatPercent(top.percent)}` : "규칙 없음",
    active: season === selectedSeason,
    title: `${SEASON_LABEL[season]} · 가중치 합계 ${total}`,
    testid: `db-weather-season-${season}`,
    dataset: { count: String(rules.length), season },
    onSelect: () => {
      selectedSeason = season;
      rerender();
    },
  });
}

function weatherInspector(weather: DailyWeatherConfig, season: Season, rerender: () => void): HTMLElement {
  const rules = weather.seasons[season] ?? [];
  const bar = shareBar(rules);
  const legend = shareLegend(rules);
  const percentChips: HTMLElement[] = [];
  const totalReadout = el("span", {
    class: "db-wa-chip db-wa-chip-mono",
    text: String(sumWeight(rules)),
    dataset: { testid: `db-weather-total-${season}` },
  });

  // 가중치/강도는 타이핑마다 커밋한다(코얼레스 스냅샷). 전체 재렌더 대신 막대·범례·비율
  // 칩만 갈아끼워 입력 포커스와 캐럿을 지킨다 — 용어 탭 미리보기와 같은 패턴.
  const repaint = (): void => {
    const current = store.getCurrent().system.dailyWeather?.seasons[season] ?? [];
    const total = sumWeight(current);
    bar.replaceChildren(...barSegments(current, total));
    legend.replaceChildren(...legendItems(current, total));
    totalReadout.textContent = String(total);
    for (const [index, rule] of current.entries()) {
      const chip = percentChips[index];
      if (chip) chip.textContent = formatPercent(total > 0 ? (rule.weight / total) * 100 : 0);
    }
  };

  const table = el("div", {
    class: "db-wa-table",
    dataset: { testid: `db-weather-table-${season}` },
    children: rules.length === 0
      ? [emptyState({ icon: "○", title: "이 계절에는 규칙이 없습니다", body: "규칙이 없으면 언제나 맑음으로 처리됩니다.", compact: true })]
      : [
          tableHead(),
          ...rules.map((rule, index) => ruleRow(season, rule, index, rules, percentChips, repaint, rerender)),
        ],
  });

  return el("div", {
    class: "db-ws-stack",
    children: [
      spanCard(sectionCard({
        title: "확률 분포",
        hint: "다섯 종류 전부를 세워 0% 인 날씨도 눈에 보이게 합니다.",
        children: [bar, legend],
        testid: `db-weather-share-${season}`,
      })),
      spanCard(sectionCard({
        title: "날씨 규칙",
        hint: "가중치는 상대값입니다. 합계가 커도 비율만 같으면 결과는 같습니다.",
        children: [
          table,
          el("div", {
            class: "db-wa-table-foot",
            children: [
              el("span", { class: "db-wa-foot-label", text: "가중치 합계" }),
              totalReadout,
              el("button", {
                class: "db-ws-btn db-ws-btn-ghost",
                text: "규칙 추가",
                attrs: { type: "button" },
                dataset: { testid: `db-weather-add-rule-${season}` },
                on: { click: () => mutateRules(season, (next) => next.push({ kind: "none", weight: 1, intensity: 0 }), rerender) },
              }),
            ],
          }),
        ],
        testid: `db-weather-rules-${season}`,
      })),
      sectionCard({
        title: "날씨 시스템",
        hint: "네 계절 공통 설정입니다.",
        children: [
          toggleSwitch("날씨 사용", "db-weather-enabled", weather.enabled, (checked) => updateWeather("enabled", checked, rerender)),
          el("div", {
            class: "db-wa-narrow",
            children: [numberField("예보 일수", "db-weather-forecast-days", weather.forecastDays ?? 3, (value) => updateWeather("forecastDays", value, rerender), { min: 1, max: 7 })],
          }),
          el("button", {
            class: "db-ws-btn db-ws-btn-ghost",
            text: "기본 확률로 되돌리기",
            attrs: { type: "button", title: "네 계절을 모두 기본 확률표로 덮어씁니다 (Ctrl+Z 로 되돌리기 가능)" },
            dataset: { testid: "db-weather-seed-defaults" },
            on: { click: () => seedDefaultWeather(rerender) },
          }),
        ],
        testid: "db-weather-system-card",
      }),
      sectionCard({
        title: "다른 계절",
        hint: "눌러서 바로 이동합니다.",
        children: SEASONS.filter((entry) => entry !== season).map((entry) => seasonMiniRow(entry, weather.seasons[entry] ?? [], rerender)),
        testid: "db-weather-other-seasons",
      }),
    ],
  });
}

function tableHead(): HTMLElement {
  return el("div", {
    class: "db-wa-row db-wa-thead db-wa-row-weather",
    attrs: { "aria-hidden": "true" },
    children: ["날씨", "가중치", "비율", "강도", ""].map((label) => el("span", { class: "db-wa-col", text: label })),
  });
}

function ruleRow(
  season: Season,
  rule: DailyWeatherRule,
  index: number,
  rules: readonly DailyWeatherRule[],
  percentChips: HTMLElement[],
  repaint: () => void,
  rerender: () => void,
): HTMLElement {
  const total = sumWeight(rules);
  const intensity = rule.intensity ?? (rule.kind === "none" ? 0 : 0.65);

  const kindSelect = el("select", {
    class: "db-wa-kind",
    attrs: { "aria-label": `${SEASON_LABEL[season]} ${index + 1}번 규칙 날씨` },
    on: { change: (event) => patchRule(season, index, { kind: selectValue(event) as WeatherKind }, rerender) },
    children: WEATHER_KINDS.map((kind) => el("option", {
      text: WEATHER_LABEL[kind],
      attrs: { value: kind, ...(kind === rule.kind ? { selected: "" } : {}) },
    })),
  });

  const weightInput = el("input", {
    class: "db-wa-weight",
    attrs: { type: "number", min: "1", max: "1000000", step: "1", "aria-label": `${SEASON_LABEL[season]} ${index + 1}번 규칙 가중치` },
    value: String(rule.weight),
  }) as HTMLInputElement;
  weightInput.addEventListener("input", () => {
    if (weightInput.value === "") return;
    patchRuleQuiet(season, index, { weight: clampInt(weightInput.value, 1, 1_000_000) });
    repaint();
  });
  weightInput.addEventListener("change", () => {
    const next = clampInt(weightInput.value, 1, 1_000_000);
    weightInput.value = String(next);
    patchRuleQuiet(season, index, { weight: next });
    repaint();
  });

  const percentChip = el("span", {
    class: "db-wa-chip db-wa-chip-mono db-wa-percent",
    text: formatPercent(total > 0 ? (rule.weight / total) * 100 : 0),
    dataset: { testid: `db-weather-percent-${season}-${index}` },
  });
  percentChips[index] = percentChip;

  const intensityValue = el("span", { class: "db-wa-chip db-wa-chip-mono", text: intensity.toFixed(2) });
  const intensityRange = el("input", {
    class: "db-wa-range",
    attrs: {
      type: "range",
      min: "0",
      max: "1",
      step: "0.05",
      "aria-label": `${SEASON_LABEL[season]} ${index + 1}번 규칙 강도`,
      ...(rule.kind === "none" ? { title: "맑음은 강도를 쓰지 않습니다" } : {}),
    },
    value: String(intensity),
  }) as HTMLInputElement;
  intensityRange.addEventListener("input", () => {
    const next = clampNumber(intensityRange.value, 0, 1);
    intensityValue.textContent = next.toFixed(2);
    patchRuleQuiet(season, index, { intensity: next });
  });

  return el("div", {
    class: `db-wa-row db-wa-row-weather${rule.kind === "none" ? " db-wa-row-calm" : ""}`,
    dataset: { testid: `db-weather-rule-${season}-${index}` },
    children: [
      kindSelect,
      weightInput,
      percentChip,
      el("span", { class: "db-wa-intensity", children: [intensityRange, intensityValue] }),
      el("button", {
        class: "db-wa-row-remove",
        text: "삭제",
        attrs: { type: "button", "aria-label": `${SEASON_LABEL[season]} ${index + 1}번 날씨 규칙 삭제` },
        dataset: { testid: `db-weather-remove-${season}-${index}` },
        on: { click: () => mutateRules(season, (next) => next.splice(index, 1), rerender) },
      }),
    ],
  });
}

function seasonMiniRow(season: Season, rules: readonly DailyWeatherRule[], rerender: () => void): HTMLElement {
  return el("button", {
    class: "db-wa-mini",
    attrs: { type: "button" },
    dataset: { testid: `db-weather-mini-${season}` },
    on: {
      click: () => {
        selectedSeason = season;
        rerender();
      },
    },
    children: [
      el("span", { class: "db-wa-mini-name", text: SEASON_LABEL[season] }),
      shareBar(rules),
      el("span", { class: "db-wa-mini-count", text: `${rules.length}개` }),
    ],
  });
}

// ---------------------------------------------------------------------------
// 확률 시각화
// ---------------------------------------------------------------------------

function shareBar(rules: readonly DailyWeatherRule[]): HTMLElement {
  return el("div", {
    class: "db-wa-bar",
    attrs: { role: "img", "aria-label": barLabel(rules) },
    children: barSegments(rules, sumWeight(rules)),
  });
}

function barSegments(rules: readonly DailyWeatherRule[], total: number): HTMLElement[] {
  if (total <= 0) return [el("span", { class: "db-wa-bar-empty", text: "규칙 없음" })];
  const segments: HTMLElement[] = [];
  for (const kind of WEATHER_KINDS) {
    const weight = weightOf(rules, kind);
    if (weight <= 0) continue;
    const percent = (weight / total) * 100;
    const segment = el("span", {
      class: "db-wa-bar-seg",
      attrs: { title: `${WEATHER_LABEL[kind]} ${formatPercent(percent)}` },
      dataset: { kind },
    });
    segment.style.setProperty("width", `${percent}%`);
    segment.style.setProperty("opacity", WEATHER_SHADE[kind]);
    segments.push(segment);
  }
  return segments;
}

/** 다섯 종류를 **전부** 세운다 — 0% 인 날씨가 "없다"는 것도 정보다. */
function shareLegend(rules: readonly DailyWeatherRule[]): HTMLElement {
  return el("div", { class: "db-wa-legend", children: legendItems(rules, sumWeight(rules)) });
}

function legendItems(rules: readonly DailyWeatherRule[], total: number): HTMLElement[] {
  return WEATHER_KINDS.map((kind) => {
    const weight = weightOf(rules, kind);
    const percent = total > 0 ? (weight / total) * 100 : 0;
    const swatch = el("span", { class: "db-wa-swatch", attrs: { "aria-hidden": "true" } });
    swatch.style.setProperty("opacity", WEATHER_SHADE[kind]);
    return el("span", {
      class: `db-wa-legend-item${weight === 0 ? " db-wa-legend-zero" : ""}`,
      dataset: { kind },
      children: [
        swatch,
        el("span", { class: "db-wa-legend-label", text: WEATHER_LABEL[kind] }),
        el("span", { class: "db-wa-legend-value", text: formatPercent(percent) }),
      ],
    });
  });
}

function barLabel(rules: readonly DailyWeatherRule[]): string {
  const total = sumWeight(rules);
  if (total <= 0) return "규칙 없음";
  return WEATHER_KINDS
    .filter((kind) => weightOf(rules, kind) > 0)
    .map((kind) => `${WEATHER_LABEL[kind]} ${formatPercent((weightOf(rules, kind) / total) * 100)}`)
    .join(", ");
}

function dominantKind(rules: readonly DailyWeatherRule[]): { readonly kind: WeatherKind; readonly percent: number } | null {
  const total = sumWeight(rules);
  if (total <= 0) return null;
  let best: WeatherKind = WEATHER_KINDS[0];
  let bestWeight = -1;
  for (const kind of WEATHER_KINDS) {
    const weight = weightOf(rules, kind);
    if (weight > bestWeight) {
      best = kind;
      bestWeight = weight;
    }
  }
  return { kind: best, percent: (bestWeight / total) * 100 };
}

function matchesSeason(season: Season, rules: readonly DailyWeatherRule[], query: string): boolean {
  if (query.length === 0) return true;
  const needle = query.toLowerCase();
  if (SEASON_LABEL[season].includes(query) || season.toLowerCase().includes(needle)) return true;
  return rules.some((rule) => WEATHER_LABEL[rule.kind].includes(query) || rule.kind.toLowerCase().includes(needle));
}

function weightOf(rules: readonly DailyWeatherRule[], kind: WeatherKind): number {
  return rules.reduce((sum, rule) => (rule.kind === kind ? sum + Math.max(0, rule.weight) : sum), 0);
}

function sumWeight(rules: readonly DailyWeatherRule[]): number {
  return rules.reduce((sum, rule) => sum + Math.max(0, rule.weight), 0);
}

function formatPercent(percent: number): string {
  if (percent <= 0) return "0%";
  if (percent < 10) return `${percent.toFixed(1).replace(/\.0$/u, "")}%`;
  return `${Math.round(percent)}%`;
}

function spanCard(card: HTMLElement): HTMLElement {
  card.classList.add("db-ws-span");
  return card;
}

// ---------------------------------------------------------------------------
// 저장
// ---------------------------------------------------------------------------

function seedDefaultWeather(rerender: () => void): void {
  recordProjectSnapshot("4계절 기본 날씨 만들기");
  store.update((project) => {
    project.system.dailyWeather = {
      enabled: true,
      forecastDays: 3,
      seasons: {
        spring: defaultRulesFor("spring"),
        summer: defaultRulesFor("summer"),
        fall: defaultRulesFor("fall"),
        winter: defaultRulesFor("winter"),
      },
    };
  });
  toast("4계절 날씨 확률표를 만들었습니다.", "ok");
  rerender();
}

function defaultRulesFor(season: Season): DailyWeatherRule[] {
  if (season === "summer") {
    return [
      { kind: "none", weight: 70, intensity: 0 },
      { kind: "rain", weight: 22, intensity: 0.65 },
      { kind: "storm", weight: 8, intensity: 0.9 },
    ];
  }
  if (season === "winter") {
    return [
      { kind: "none", weight: 65, intensity: 0 },
      { kind: "snow", weight: 30, intensity: 0.7 },
      { kind: "fog", weight: 5, intensity: 0.45 },
    ];
  }
  return [
    { kind: "none", weight: 72, intensity: 0 },
    { kind: "rain", weight: 23, intensity: 0.65 },
    { kind: "storm", weight: 5, intensity: 0.9 },
  ];
}

function updateWeather(key: "enabled" | "forecastDays", value: boolean | number, rerender: () => void): void {
  recordCoalescedSnapshot(`db-weather:${key}`);
  store.update((project) => {
    const current = project.system.dailyWeather;
    if (!current) return;
    project.system.dailyWeather = { ...current, [key]: value };
  });
  rerender();
}

function patchRule(season: Season, index: number, patch: Partial<DailyWeatherRule>, rerender: () => void): void {
  mutateRules(season, (next) => { if (next[index]) next[index] = { ...next[index], ...patch }; }, rerender, true);
}

/** 재렌더 없이 값만 커밋 — 슬라이더/숫자 입력이 포커스를 잃지 않게 한다. */
function patchRuleQuiet(season: Season, index: number, patch: Partial<DailyWeatherRule>): void {
  recordCoalescedSnapshot(`db-weather:${season}`);
  store.update((project) => {
    const weather = project.system.dailyWeather;
    if (!weather) return;
    const rules = [...(weather.seasons[season] ?? [])];
    if (!rules[index]) return;
    rules[index] = { ...rules[index], ...patch };
    project.system.dailyWeather = { ...weather, seasons: { ...weather.seasons, [season]: rules } };
  });
}

function mutateRules(season: Season, mutate: (rules: DailyWeatherRule[]) => void, rerender: () => void, coalesce = false): void {
  if (coalesce) recordCoalescedSnapshot(`db-weather:${season}`);
  else recordProjectSnapshot(`날씨 규칙 ${season} 변경`);
  store.update((project) => {
    const weather = project.system.dailyWeather;
    if (!weather) return;
    const rules = [...(weather.seasons[season] ?? [])];
    mutate(rules);
    project.system.dailyWeather = { ...weather, seasons: { ...weather.seasons, [season]: rules } };
  });
  rerender();
}

function selectValue(event: Event): string {
  return (event.currentTarget as HTMLSelectElement).value;
}

function clampInt(value: string, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : min;
}

function clampNumber(value: string, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : min;
}
