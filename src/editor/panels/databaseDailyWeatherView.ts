import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { SEASONS } from "@/project/gameTime";
import { store } from "@/project/store";
import type { DailyWeatherConfig, DailyWeatherRule, Season, WeatherKind } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

const WEATHER_KINDS: readonly WeatherKind[] = ["none", "rain", "storm", "snow", "fog"];
const SEASON_LABEL: Record<Season, string> = { spring: "봄", summer: "여름", fall: "가을", winter: "겨울" };
const WEATHER_LABEL: Record<WeatherKind, string> = {
  none: "맑음",
  rain: "비",
  storm: "폭풍",
  snow: "눈",
  fog: "안개",
};

export function renderDailyWeatherTab(host: HTMLElement, rerender: () => void): void {
  const weather = store.getCurrent().system.dailyWeather;
  host.append(el("section", {
    class: "db-life-authoring-workspace db-weather-workspace",
    dataset: { testid: "db-weather-workspace" },
    children: [
      el("header", {
        class: "db-life-panel-heading",
        children: [
          el("span", { class: "db-life-panel-eyebrow", text: "하루의 리듬" }),
          el("div", { children: [
            el("h2", { text: "계절·날씨" }),
            el("p", { text: "계절별 확률표에서 오늘 날씨와 예보를 결정합니다. 비와 폭풍은 밭에 자동으로 물을 줍니다." }),
          ] }),
        ],
      }),
      weatherToolbar(weather, rerender),
      ...(weather ? [seasonGrid(weather, rerender)] : [emptyWeather(rerender)]),
    ],
  }));
}

function weatherToolbar(weather: DailyWeatherConfig | undefined, rerender: () => void): HTMLElement {
  return el("div", {
    class: "db-life-toolbar",
    children: [
      el("button", {
        class: "btn",
        text: weather ? "기본 확률로 되돌리기" : "4계절 기본 날씨 만들기",
        attrs: { type: "button" },
        dataset: { testid: "db-weather-seed-defaults" },
        on: { click: () => seedDefaultWeather(rerender) },
      }),
      ...(weather ? [
        labelWithControl("날씨 사용", el("input", {
          attrs: { type: "checkbox", ...(weather.enabled ? { checked: "" } : {}) },
          dataset: { testid: "db-weather-enabled" },
          on: { change: (event) => updateWeather("enabled", checkedOf(event), rerender) },
        })),
        labelWithControl("예보 일수", el("input", {
          attrs: { type: "number", min: "1", max: "7", value: String(weather.forecastDays ?? 3) },
          dataset: { testid: "db-weather-forecast-days" },
          on: { change: (event) => updateWeather("forecastDays", clampInt(valueOf(event), 1, 7), rerender) },
        })),
      ] : []),
    ],
  });
}

function emptyWeather(rerender: () => void): HTMLElement {
  return el("div", {
    class: "empty-state empty-state--large empty-state--inset",
    children: [
      el("span", { class: "empty-state__icon", text: "🌦️", attrs: { "aria-hidden": "true" } }),
      el("h3", { class: "empty-state__title", text: "아직 날씨 규칙이 없습니다" }),
      el("p", { class: "empty-state__desc", text: "기본값을 만들면 봄·여름·가을·겨울의 맑음, 비, 폭풍, 눈 확률이 즉시 채워집니다." }),
      el("button", {
        class: "empty-state__action empty-state__action--primary",
        text: "4계절 기본 날씨 만들기",
        attrs: { type: "button" },
        on: { click: () => seedDefaultWeather(rerender) },
      }),
    ],
  });
}

function seasonGrid(weather: DailyWeatherConfig, rerender: () => void): HTMLElement {
  return el("div", {
    class: "db-life-card-grid db-weather-season-grid",
    children: SEASONS.map((season) => seasonCard(season, weather.seasons[season] ?? [], rerender)),
  });
}

function seasonCard(season: Season, rules: readonly DailyWeatherRule[], rerender: () => void): HTMLElement {
  return el("article", {
    class: "db-life-card db-weather-season",
    dataset: { testid: `db-weather-season-${season}`, count: String(rules.length) },
    children: [
      el("h3", { text: `${SEASON_LABEL[season]} 확률표` }),
      el("p", { text: `가중치 합계 ${rules.reduce((sum, rule) => sum + rule.weight, 0)}` }),
      ...rules.map((rule, index) => weatherRuleRow(season, rule, index, rerender)),
      el("button", {
        class: "btn small",
        text: "날씨 규칙 추가",
        attrs: { type: "button" },
        dataset: { testid: `db-weather-add-${season}` },
        on: { click: () => mutateRules(season, (next) => next.push({ kind: "none", weight: 1, intensity: 0 }), rerender) },
      }),
    ],
  });
}

function weatherRuleRow(season: Season, rule: DailyWeatherRule, index: number, rerender: () => void): HTMLElement {
  return el("div", {
    class: "db-life-rule-row",
    dataset: { testid: `db-weather-rule-${season}-${index}` },
    children: [
      labelWithControl("날씨", el("select", {
        on: { change: (event) => patchRule(season, index, { kind: valueOf(event) as WeatherKind }, rerender) },
        children: WEATHER_KINDS.map((kind) => el("option", {
          text: WEATHER_LABEL[kind],
          attrs: { value: kind, ...(kind === rule.kind ? { selected: "" } : {}) },
        })),
      })),
      labelWithControl("가중치", el("input", {
        attrs: { type: "number", min: "1", max: "1000000", value: String(rule.weight) },
        on: { change: (event) => patchRule(season, index, { weight: clampInt(valueOf(event), 1, 1_000_000) }, rerender) },
      })),
      labelWithControl("강도", el("input", {
        attrs: { type: "number", min: "0", max: "1", step: "0.1", value: String(rule.intensity ?? (rule.kind === "none" ? 0 : 0.65)) },
        on: { change: (event) => patchRule(season, index, { intensity: clampNumber(valueOf(event), 0, 1) }, rerender) },
      })),
      el("button", {
        class: "btn small danger",
        text: "삭제",
        attrs: { type: "button", "aria-label": `${SEASON_LABEL[season]} ${index + 1}번 날씨 규칙 삭제` },
        on: { click: () => mutateRules(season, (next) => next.splice(index, 1), rerender) },
      }),
    ],
  });
}

function seedDefaultWeather(rerender: () => void): void {
  recordProjectSnapshot("4계절 기본 날씨 만들기");
  store.update((project) => {
    project.system.dailyWeather = {
      enabled: true,
      forecastDays: 3,
      seasons: {
        spring: defaultTemperateRules(),
        summer: [{ kind: "none", weight: 70, intensity: 0 }, { kind: "rain", weight: 22, intensity: 0.65 }, { kind: "storm", weight: 8, intensity: 0.9 }],
        fall: defaultTemperateRules(),
        winter: [{ kind: "none", weight: 65, intensity: 0 }, { kind: "snow", weight: 30, intensity: 0.7 }, { kind: "fog", weight: 5, intensity: 0.45 }],
      },
    };
  });
  toast("4계절 날씨 확률표를 만들었습니다.", "ok");
  rerender();
}

function defaultTemperateRules(): DailyWeatherRule[] {
  return [{ kind: "none", weight: 72, intensity: 0 }, { kind: "rain", weight: 23, intensity: 0.65 }, { kind: "storm", weight: 5, intensity: 0.9 }];
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

function labelWithControl(label: string, control: HTMLElement): HTMLElement {
  return el("label", { class: "field", children: [el("span", { text: label }), control] });
}

function valueOf(event: Event): string {
  return (event.currentTarget as HTMLInputElement | HTMLSelectElement).value;
}

function checkedOf(event: Event): boolean {
  return (event.currentTarget as HTMLInputElement).checked;
}

function clampInt(value: string, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : min;
}

function clampNumber(value: string, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : min;
}
