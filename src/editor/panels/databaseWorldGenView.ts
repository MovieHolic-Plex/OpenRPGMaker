// 「세계 생성」 탭 — AI 가 마을을 깔 때의 물·숲·길 규칙을 그림으로 고치는 자리.
//
// 설계 기준(사용자 요구): 초보 저자가 **설명 없이** 쓸 수 있어야 하고, 코드를 쓰게 하지
// 않으며, 자연어까지만 허용한다. 그래서 모든 수치 옆에 "지금 이 값이면 이렇게 깔린다"
// 미리보기가 붙고, 예시는 글이 아니라 실제 칩셋으로 그린 썸네일이다.
//
// DOM 계약(테스트가 의존):
//   db-worldgen-workspace          — 탭 루트
//   db-worldgen-section-<id>       — 왼쪽 레일 행
//   db-worldgen-preview            — 큰 미리보기(캔버스 포함)
//   db-worldgen-preset-<presetId>  — 예시 카드(누르면 적용)
//   db-worldgen-keyword-<ruleId>   — 낱말 규칙 행
//   db-worldgen-reset              — 기본값으로 되돌리기

import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { sliderStepperField, segmentedControl, textControl, toggleSwitch } from "@/editor/panels/databaseControls";
import {
  detailHero,
  detailPane,
  listPane,
  listRow,
  noticeBar,
  sectionCard,
  statStrip,
  workspaceShell,
} from "@/editor/panels/databaseWorkspace";
import { renderWorldGenPreview } from "@/editor/panels/worldGenPreview";
import { store } from "@/project/store";
import { WORLD_GEN_PRESETS, type WorldGenPreset } from "@/project/worldGenPresets";
import {
  BUILTIN_WORLD_GEN_KEYWORD_RULES,
  resolveWorldGenRules,
  WORLD_GEN_BOUNDS,
  WORLD_GEN_LANDMARK_KINDS,
  type ResolvedWorldGenRules,
  type WorldGenKeywordRule,
  type WorldGenLandmarkKind,
  type WorldGenRules,
} from "@/project/worldGenRules";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

type SectionId = "examples" | "water" | "forest" | "road" | "keywords";

const SECTIONS: readonly { readonly id: SectionId; readonly label: string; readonly sub: string; readonly icon: string }[] = [
  { id: "examples", label: "예시로 시작", sub: "그림 고르기", icon: "🖼" },
  { id: "water", label: "물 — 강·호수", sub: "크기·모양·방향", icon: "💧" },
  { id: "forest", label: "숲 — 나무", sub: "깊이·밀도·간격", icon: "🌲" },
  { id: "road", label: "길·광장", sub: "바닥·자리", icon: "🛣" },
  { id: "keywords", label: "말 → 지형", sub: "자연어 규칙", icon: "💬" },
];

const LANDMARK_LABEL: Record<WorldGenLandmarkKind, string> = {
  river: "강",
  lake: "호수",
  forest: "숲",
  market: "장터",
  harbor: "항구",
  farm: "농지",
};

let activeSection: SectionId = "examples";
/** 미리보기에 태우는 프롬프트. 저자가 여기 말을 바꿔 규칙을 즉석에서 시험한다. */
let previewQuery = "강촌마을";

export function renderWorldGenTab(host: HTMLElement, rerender: () => void): void {
  const project = store.getCurrent();
  const rules = resolveWorldGenRules(project.system.worldGen);

  host.append(
    workspaceShell({
      testid: "db-worldgen-workspace",
      list: listPane({
        title: "무엇을 고칠까요",
        rows: SECTIONS.map((section) =>
          listRow({
            name: `${section.icon} ${section.label}`,
            sub: section.sub,
            active: section.id === activeSection,
            testid: `db-worldgen-section-${section.id}`,
            onSelect: () => {
              activeSection = section.id;
              rerender();
            },
          }),
        ),
        testid: "db-worldgen-sections",
      }),
      detail: detailPane({
        hero: detailHero({
          eyebrow: "세계 생성",
          title: "AI 가 마을을 깔 때의 규칙",
          subtitle: "값을 움직이면 아래 그림이 바로 바뀝니다. 그림이 곧 결과입니다.",
          tags: [
            `물 ${rules.water.side === "auto" ? "자동" : sideLabel(rules.water.side)}`,
            `숲 ${rules.forest.side === "auto" ? "자동" : sideLabel(rules.forest.side)}`,
            `길 ${pathLabel(rules.road.pathStyle)}`,
          ],
          actions: [
            {
              label: "기본값으로 되돌리기",
              testid: "db-worldgen-reset",
              onClick: () => {
                recordProjectSnapshot("세계 생성 규칙 초기화");
                store.update((draft) => {
                  delete draft.system.worldGen;
                });
                toast("세계 생성 규칙을 기본값으로 되돌렸습니다.", "ok");
                rerender();
              },
            },
          ],
          testid: "db-worldgen-hero",
        }),
        body: [previewBlock(rules, rerender), ...sectionBody(activeSection, rules, rerender)],
        testid: "db-worldgen-detail",
      }),
    }),
  );
}

function previewBlock(rules: ResolvedWorldGenRules, rerender: () => void): HTMLElement {
  const preview = renderWorldGenPreview({ rules, query: previewQuery, testid: "db-worldgen-preview" });
  const landmarkText = preview.facts.landmarks.length > 0
    ? preview.facts.landmarks.map((kind) => LANDMARK_LABEL[kind as WorldGenLandmarkKind] ?? kind).join(" · ")
    : "없음 (집과 길만 깔립니다)";

  return sectionCard({
    title: "이렇게 깔립니다",
    hint: "60×44 칸 맵에 지금 규칙을 그대로 적용한 그림입니다.",
    testid: "db-worldgen-preview-card",
    children: [
      el("div", {
        class: "wg-preview-row",
        children: [
          preview.element,
          el("div", {
            class: "wg-preview-side",
            children: [
              textControl(
                "이 말로 시험해 보기",
                previewQuery,
                (value) => {
                  previewQuery = value;
                  rerender();
                },
                "db-worldgen-preview-query",
              ),
              el("p", {
                class: "wg-preview-landmarks",
                dataset: { testid: "db-worldgen-preview-landmarks" },
                text: `이 말에서 읽어낸 것: ${landmarkText}`,
              }),
              statStrip(
                [
                  { label: "물", value: `${preview.facts.waterCells}칸`, tone: preview.facts.waterCells > 0 ? "good" : "neutral" },
                  { label: "침엽수", value: `${preview.facts.coniferCount}그루` },
                  { label: "활엽수", value: `${preview.facts.broadleafCount}그루` },
                  { label: "집 지을 땅", value: `${preview.facts.buildable.w}×${preview.facts.buildable.h}` },
                ],
                { testid: "db-worldgen-preview-stats" },
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

function sectionBody(section: SectionId, rules: ResolvedWorldGenRules, rerender: () => void): readonly HTMLElement[] {
  switch (section) {
    case "examples":
      return examplesSection(rerender);
    case "water":
      return waterSection(rules, rerender);
    case "forest":
      return forestSection(rules, rerender);
    case "road":
      return roadSection(rules, rerender);
    case "keywords":
      return keywordsSection(rules, rerender);
  }
}

function examplesSection(rerender: () => void): readonly HTMLElement[] {
  const current = store.getCurrent().system.worldGen?.presetId;
  return [
    sectionCard({
      title: "마음에 드는 그림을 누르세요",
      hint: "누르면 그 규칙이 그대로 들어옵니다. 뒤에서 값을 더 만질 수 있습니다.",
      testid: "db-worldgen-presets",
      children: [
        el("div", {
          class: "wg-preset-grid",
          children: WORLD_GEN_PRESETS.map((preset) => presetCard(preset, preset.id === current, rerender)),
        }),
      ],
    }),
  ];
}

function presetCard(preset: WorldGenPreset, active: boolean, rerender: () => void): HTMLElement {
  const thumb = renderWorldGenPreview({
    rules: resolveWorldGenRules(preset.rules),
    query: preset.exampleQuery,
    cols: 44,
    rows: 32,
    cellPx: 5,
    testid: `db-worldgen-preset-thumb-${preset.id}`,
  });
  return el("button", {
    class: `wg-preset-card${active ? " is-active" : ""}`,
    attrs: { type: "button", "aria-pressed": active ? "true" : "false" },
    dataset: { testid: `db-worldgen-preset-${preset.id}` },
    children: [
      thumb.element,
      el("strong", { class: "wg-preset-name", text: preset.label }),
      el("span", { class: "wg-preset-summary", text: preset.summary }),
      el("span", { class: "wg-preset-example", text: `예: "${preset.exampleQuery}"` }),
    ],
    on: {
      click: () => {
        recordProjectSnapshot(`세계 생성 예시 적용: ${preset.label}`);
        store.update((draft) => {
          draft.system.worldGen = structuredClone(preset.rules) as WorldGenRules;
        });
        previewQuery = preset.exampleQuery;
        toast(`"${preset.label}" 규칙을 적용했습니다.`, "ok");
        rerender();
      },
    },
  });
}

function waterSection(rules: ResolvedWorldGenRules, rerender: () => void): readonly HTMLElement[] {
  const water = rules.water;
  return [
    sectionCard({
      title: "강",
      hint: "맵 한쪽 변에 붙는 물 띠입니다.",
      testid: "db-worldgen-water-river",
      children: [
        ratioField("강 띠 두께", "db-worldgen-river-ratio", water.riverBandRatio, "riverBandRatio", (value) =>
          patchWater({ riverBandRatio: value }, rerender)),
        sliderStepperField("가장 얇아도 이만큼", "db-worldgen-river-min", water.riverBandMin, (value) =>
          patchWater({ riverBandMin: value }, rerender), { ...WORLD_GEN_BOUNDS.riverBandMin, unit: "칸" }),
        sliderStepperField("가장 두꺼워도 이만큼", "db-worldgen-river-max", water.riverBandMax, (value) =>
          patchWater({ riverBandMax: value }, rerender), { ...WORLD_GEN_BOUNDS.riverBandMax, unit: "칸" }),
        segmentedControl("물이 붙는 쪽", "db-worldgen-water-side", water.side, sideOptions(), (value) =>
          patchWater({ side: value as typeof water.side }, rerender)),
      ],
    }),
    sectionCard({
      title: "호수",
      hint: "동그랗게 파는 물입니다. 강이 같이 있으면 자리를 양보해 작아집니다.",
      testid: "db-worldgen-water-lake",
      children: [
        ratioField("호수 크기 (호수만 있을 때)", "db-worldgen-lake-alone", water.lakeRatioAlone, "lakeRatioAlone", (value) =>
          patchWater({ lakeRatioAlone: value }, rerender)),
        ratioField("호수 크기 (강도 있을 때)", "db-worldgen-lake-river", water.lakeRatioWithRiver, "lakeRatioWithRiver", (value) =>
          patchWater({ lakeRatioWithRiver: value }, rerender)),
        sliderStepperField("아무리 작아도 이만큼", "db-worldgen-lake-min", water.lakeMinSize, (value) =>
          patchWater({ lakeMinSize: value }, rerender), { ...WORLD_GEN_BOUNDS.lakeMinSize, unit: "칸" }),
        segmentedControl("수면 모양", "db-worldgen-water-shape", water.shape, [
          { id: "auto", name: "알아서" },
          { id: "circle", name: "동그라미" },
          { id: "ellipse", name: "타원" },
          { id: "rect", name: "네모" },
        ], (value) => patchWater({ shape: value as typeof water.shape }, rerender)),
      ],
    }),
  ];
}

function forestSection(rules: ResolvedWorldGenRules, rerender: () => void): readonly HTMLElement[] {
  const forest = rules.forest;
  return [
    sectionCard({
      title: "숲이 차지하는 자리",
      testid: "db-worldgen-forest-band",
      children: [
        ratioField("숲 깊이", "db-worldgen-forest-ratio", forest.depthRatio, "depthRatio", (value) =>
          patchForest({ depthRatio: value }, rerender)),
        sliderStepperField("아무리 얕아도 이만큼", "db-worldgen-forest-min", forest.depthMin, (value) =>
          patchForest({ depthMin: value }, rerender), { ...WORLD_GEN_BOUNDS.depthMin, unit: "칸" }),
        segmentedControl("숲이 붙는 쪽", "db-worldgen-forest-side", forest.side, sideOptions(), (value) =>
          patchForest({ side: value as typeof forest.side }, rerender)),
      ],
    }),
    sectionCard({
      title: "뾰족한 나무 (침엽수)",
      hint: "1그루가 차지하는 넓이를 줄이면 빽빽해집니다.",
      testid: "db-worldgen-forest-conifer",
      children: [
        sliderStepperField("나무 1그루가 차지하는 넓이", "db-worldgen-conifer-area", forest.coniferAreaPerTree, (value) =>
          patchForest({ coniferAreaPerTree: value }, rerender), { ...WORLD_GEN_BOUNDS.coniferAreaPerTree, unit: "칸" }),
        sliderStepperField("적어도 이만큼은 심기", "db-worldgen-conifer-min", forest.coniferMinCount, (value) =>
          patchForest({ coniferMinCount: value }, rerender), { ...WORLD_GEN_BOUNDS.coniferMinCount, unit: "그루" }),
        sliderStepperField("나무 사이 최소 간격", "db-worldgen-conifer-gap", forest.coniferGap, (value) =>
          patchForest({ coniferGap: value }, rerender), { ...WORLD_GEN_BOUNDS.coniferGap, unit: "칸" }),
        percentField("줄 맞춤 흐트리기", "db-worldgen-conifer-natural", forest.coniferNaturalness, "coniferNaturalness", (value) =>
          patchForest({ coniferNaturalness: value }, rerender)),
      ],
    }),
    sectionCard({
      title: "넓은 나무 (활엽수, 2×2 큰 나무)",
      testid: "db-worldgen-forest-broadleaf",
      children: [
        sliderStepperField("큰 나무 1그루가 차지하는 넓이", "db-worldgen-broadleaf-area", forest.broadleafAreaPerTree, (value) =>
          patchForest({ broadleafAreaPerTree: value }, rerender), { ...WORLD_GEN_BOUNDS.broadleafAreaPerTree, unit: "칸" }),
        sliderStepperField("적어도 이만큼", "db-worldgen-broadleaf-min", forest.broadleafMinCount, (value) =>
          patchForest({ broadleafMinCount: value }, rerender), { ...WORLD_GEN_BOUNDS.broadleafMinCount, unit: "그루" }),
        sliderStepperField("많아도 이만큼까지", "db-worldgen-broadleaf-max", forest.broadleafMaxCount, (value) =>
          patchForest({ broadleafMaxCount: value }, rerender), { ...WORLD_GEN_BOUNDS.broadleafMaxCount, unit: "그루" }),
        sliderStepperField("큰 나무 사이 최소 간격", "db-worldgen-broadleaf-gap", forest.broadleafGap, (value) =>
          patchForest({ broadleafGap: value }, rerender), { ...WORLD_GEN_BOUNDS.broadleafGap, unit: "칸" }),
        percentField("줄 맞춤 흐트리기", "db-worldgen-broadleaf-natural", forest.broadleafNaturalness, "broadleafNaturalness", (value) =>
          patchForest({ broadleafNaturalness: value }, rerender)),
      ],
    }),
  ];
}

function roadSection(rules: ResolvedWorldGenRules, rerender: () => void): readonly HTMLElement[] {
  const road = rules.road;
  return [
    sectionCard({
      title: "길 바닥",
      hint: "「알아서」로 두면 프롬프트의 말(항구·농촌 등)을 보고 고릅니다.",
      testid: "db-worldgen-road-path",
      children: [
        segmentedControl("길 재료", "db-worldgen-path-style", road.pathStyle, [
          { id: "auto", name: "알아서" },
          { id: "sand", name: "모래" },
          { id: "dirt", name: "흙" },
          { id: "stone", name: "돌" },
        ], (value) => patchRoad({ pathStyle: value as typeof road.pathStyle }, rerender)),
      ],
    }),
    sectionCard({
      title: "광장",
      testid: "db-worldgen-road-plaza",
      children: [
        segmentedControl("광장 성격", "db-worldgen-plaza-style", road.plazaStyle, [
          { id: "auto", name: "알아서" },
          { id: "market", name: "장터" },
          { id: "garden", name: "정원" },
          { id: "empty", name: "안 만듦" },
        ], (value) => patchRoad({ plazaStyle: value as typeof road.plazaStyle }, rerender)),
        segmentedControl("광장 자리", "db-worldgen-plaza-layout", road.plazaLayout, [
          { id: "auto", name: "알아서" },
          { id: "center", name: "가운데" },
          { id: "north", name: "북" },
          { id: "south", name: "남" },
          { id: "west", name: "서" },
          { id: "east", name: "동" },
        ], (value) => patchRoad({ plazaLayout: value as typeof road.plazaLayout }, rerender)),
      ],
    }),
    sectionCard({
      title: "집 마당과 마을 테두리",
      testid: "db-worldgen-road-yard",
      children: [
        segmentedControl("마당 꾸밈", "db-worldgen-yard-style", road.yardStyle, [
          { id: "auto", name: "알아서" },
          { id: "mixed", name: "섞어서" },
          { id: "garden", name: "텃밭" },
          { id: "workshop", name: "작업장" },
          { id: "market", name: "장터" },
          { id: "minimal", name: "단정하게" },
        ], (value) => patchRoad({ yardStyle: value as typeof road.yardStyle }, rerender)),
        segmentedControl("마을 테두리 나무", "db-worldgen-edge-trees", road.edgeTrees, [
          { id: "auto", name: "알아서" },
          { id: "conifer", name: "뾰족한 나무" },
          { id: "dense", name: "빽빽하게" },
          { id: "none", name: "없이" },
        ], (value) => patchRoad({ edgeTrees: value as typeof road.edgeTrees }, rerender)),
      ],
    }),
  ];
}

function keywordsSection(rules: ResolvedWorldGenRules, rerender: () => void): readonly HTMLElement[] {
  const useBuiltin = store.getCurrent().system.worldGen?.useBuiltinKeywords !== false;
  return [
    noticeBar({
      text: "여기 적은 낱말이 프롬프트에 나오면 그 지형을 깝니다. 정규식이나 코드는 필요 없습니다.",
      tone: "info",
      testid: "db-worldgen-keyword-notice",
    }),
    sectionCard({
      title: "내장 규칙",
      hint: "끄면 그 낱말을 더 이상 읽지 않습니다.",
      testid: "db-worldgen-keywords-builtin",
      children: [
        toggleSwitch("내장 규칙 쓰기", "db-worldgen-use-builtin", useBuiltin, (checked) => {
          recordProjectSnapshot(checked ? "내장 낱말 규칙 켜기" : "내장 낱말 규칙 끄기");
          store.update((draft) => {
            const next = { ...(draft.system.worldGen ?? {}) };
            if (checked) delete next.useBuiltinKeywords;
            else next.useBuiltinKeywords = false;
            draft.system.worldGen = next;
          });
          rerender();
        }),
        ...(useBuiltin
          ? BUILTIN_WORLD_GEN_KEYWORD_RULES.map((builtin) =>
              keywordRow(effectiveRule(rules, builtin.id) ?? builtin, rerender, true))
          : []),
      ],
    }),
    sectionCard({
      title: "내가 만든 규칙",
      testid: "db-worldgen-keywords-authored",
      children: [
        ...authoredRules().map((rule) => keywordRow(rule, rerender, false)),
        el("button", {
          class: "db-ws-btn db-ws-btn-primary",
          attrs: { type: "button" },
          text: "＋ 낱말 규칙 추가",
          dataset: { testid: "db-worldgen-keyword-add" },
          on: {
            click: () => {
              recordProjectSnapshot("낱말 규칙 추가");
              store.update((draft) => {
                const next = { ...(draft.system.worldGen ?? {}) };
                const keywords = [...(next.keywords ?? [])];
                keywords.push({
                  id: `rule-${Date.now().toString(36)}`,
                  label: "새 규칙",
                  words: [],
                  landmarks: [],
                });
                next.keywords = keywords;
                draft.system.worldGen = next;
              });
              rerender();
            },
          },
        }),
      ],
    }),
  ];
}

function keywordRow(rule: WorldGenKeywordRule, rerender: () => void, builtin: boolean): HTMLElement {
  const enabled = rule.enabled !== false;
  return el("div", {
    class: `wg-keyword-row${enabled ? "" : " is-off"}`,
    dataset: { testid: `db-worldgen-keyword-${rule.id}`, enabled: enabled ? "1" : "0" },
    children: [
      el("div", {
        class: "wg-keyword-head",
        children: [
          toggleSwitch("", `db-worldgen-keyword-toggle-${rule.id}`, enabled, (checked) => {
            upsertRule(rule.id, (current) => ({ ...current, enabled: checked }), rerender, builtin, rule);
          }),
          builtin
            ? el("strong", { class: "wg-keyword-label", text: rule.label })
            : textControl(
                "규칙 이름",
                rule.label,
                (value) => upsertRule(rule.id, (current) => ({ ...current, label: value }), rerender, builtin, rule),
                `db-worldgen-keyword-label-${rule.id}`,
              ),
          ...(builtin ? [] : [
            el("button", {
              class: "db-ws-btn db-ws-btn-ghost",
              attrs: { type: "button" },
              text: "삭제",
              dataset: { testid: `db-worldgen-keyword-delete-${rule.id}` },
              on: {
                click: () => {
                  recordProjectSnapshot(`낱말 규칙 삭제: ${rule.label}`);
                  store.update((draft) => {
                    const next = { ...(draft.system.worldGen ?? {}) };
                    next.keywords = (next.keywords ?? []).filter((entry) => entry.id !== rule.id);
                    draft.system.worldGen = next;
                  });
                  rerender();
                },
              },
            }),
          ]),
        ],
      }),
      textControl(
        "이런 말이 나오면",
        rule.words.join(", "),
        (value) => {
          recordCoalescedSnapshot(`db-worldgen-words:${rule.id}`, "낱말 규칙 수정");
          upsertRule(rule.id, (current) => ({ ...current, words: splitWords(value) }), rerender, builtin, rule);
        },
        `db-worldgen-keyword-words-${rule.id}`,
      ),
      textControl(
        "단, 이런 말이면 무시",
        (rule.exceptWords ?? []).join(", "),
        (value) => {
          recordCoalescedSnapshot(`db-worldgen-except:${rule.id}`, "낱말 규칙 수정");
          upsertRule(rule.id, (current) => ({ ...current, exceptWords: splitWords(value) }), rerender, builtin, rule);
        },
        `db-worldgen-keyword-except-${rule.id}`,
      ),
      el("div", {
        class: "wg-keyword-landmarks",
        dataset: { testid: `db-worldgen-keyword-landmarks-${rule.id}` },
        children: WORLD_GEN_LANDMARK_KINDS.map((kind) => {
          const on = rule.landmarks.includes(kind);
          return el("button", {
            class: `wg-landmark-chip${on ? " is-on" : ""}`,
            attrs: { type: "button", "aria-pressed": on ? "true" : "false" },
            text: LANDMARK_LABEL[kind],
            dataset: { testid: `db-worldgen-keyword-${rule.id}-${kind}` },
            on: {
              click: () => {
                upsertRule(
                  rule.id,
                  (current) => ({
                    ...current,
                    landmarks: on
                      ? current.landmarks.filter((entry) => entry !== kind)
                      : [...current.landmarks, kind],
                  }),
                  rerender,
                  builtin,
                  rule,
                );
              },
            },
          });
        }),
      }),
    ],
  });
}

function patchWater(patch: Partial<NonNullable<WorldGenRules["water"]>>, rerender: () => void): void {
  recordCoalescedSnapshot("db-worldgen-water", "물 규칙 수정");
  store.update((draft) => {
    const next = { ...(draft.system.worldGen ?? {}) };
    next.water = { ...(next.water ?? {}), ...patch };
    draft.system.worldGen = next;
  });
  rerender();
}

function patchForest(patch: Partial<NonNullable<WorldGenRules["forest"]>>, rerender: () => void): void {
  recordCoalescedSnapshot("db-worldgen-forest", "숲 규칙 수정");
  store.update((draft) => {
    const next = { ...(draft.system.worldGen ?? {}) };
    next.forest = { ...(next.forest ?? {}), ...patch };
    draft.system.worldGen = next;
  });
  rerender();
}

function patchRoad(patch: Partial<NonNullable<WorldGenRules["road"]>>, rerender: () => void): void {
  recordCoalescedSnapshot("db-worldgen-road", "길 규칙 수정");
  store.update((draft) => {
    const next = { ...(draft.system.worldGen ?? {}) };
    next.road = { ...(next.road ?? {}), ...patch };
    draft.system.worldGen = next;
  });
  rerender();
}

/**
 * 내장 규칙을 손대면 **같은 id 로 저자 규칙을 만들어** 그 자리를 덮는다
 * (`resolveWorldGenKeywordRules` 의 id 덮어쓰기 계약). 내장 배열 자체는 건드리지 않으므로
 * 「기본값으로 되돌리기」 한 번이면 원래 판정으로 돌아온다.
 */
function upsertRule(
  id: string,
  mutate: (current: WorldGenKeywordRule) => WorldGenKeywordRule,
  rerender: () => void,
  builtin: boolean,
  fallback: WorldGenKeywordRule,
): void {
  store.update((draft) => {
    const next = { ...(draft.system.worldGen ?? {}) };
    const keywords = [...(next.keywords ?? [])];
    const index = keywords.findIndex((entry) => entry.id === id);
    const current = index >= 0 ? keywords[index]! : { ...fallback, builtin };
    const updated = mutate(current);
    if (index >= 0) keywords[index] = updated;
    else keywords.push(updated);
    next.keywords = keywords;
    draft.system.worldGen = next;
  });
  rerender();
}

function authoredRules(): readonly WorldGenKeywordRule[] {
  const builtinIds = new Set(BUILTIN_WORLD_GEN_KEYWORD_RULES.map((rule) => rule.id));
  return (store.getCurrent().system.worldGen?.keywords ?? []).filter((rule) => !builtinIds.has(rule.id));
}

function effectiveRule(rules: ResolvedWorldGenRules, id: string): WorldGenKeywordRule | undefined {
  return rules.keywords.find((rule) => rule.id === id);
}

function ratioField(
  label: string,
  testid: string,
  value: number,
  bound: keyof typeof WORLD_GEN_BOUNDS,
  onInput: (value: number) => void,
): HTMLElement {
  const bounds = WORLD_GEN_BOUNDS[bound];
  return sliderStepperField(
    `${label} — 맵 짧은 변의 %`,
    testid,
    Math.round(value * 100),
    (percent) => onInput(percent / 100),
    { min: Math.round(bounds.min * 100), max: Math.round(bounds.max * 100), step: 1, unit: "%" },
  );
}

function percentField(
  label: string,
  testid: string,
  value: number,
  bound: keyof typeof WORLD_GEN_BOUNDS,
  onInput: (value: number) => void,
): HTMLElement {
  const bounds = WORLD_GEN_BOUNDS[bound];
  return sliderStepperField(
    label,
    testid,
    Math.round(value * 100),
    (percent) => onInput(percent / 100),
    { min: Math.round(bounds.min * 100), max: Math.round(bounds.max * 100), step: 5, unit: "%" },
  );
}

function splitWords(raw: string): string[] {
  return raw
    .split(/[,\n·]/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0);
}

function sideOptions(): readonly { readonly id: string; readonly name: string }[] {
  return [
    { id: "auto", name: "알아서" },
    { id: "west", name: "서" },
    { id: "east", name: "동" },
    { id: "north", name: "북" },
    { id: "south", name: "남" },
  ];
}

function sideLabel(side: string): string {
  return { west: "서쪽", east: "동쪽", north: "북쪽", south: "남쪽" }[side] ?? side;
}

function pathLabel(style: string): string {
  return { auto: "알아서", sand: "모래", dirt: "흙", stone: "돌" }[style] ?? style;
}
