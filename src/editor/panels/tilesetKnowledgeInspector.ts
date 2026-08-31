import {
  chooseKnowledgeTemplate,
  clearKnowledgeSelection,
  compileKnowledgeDraft,
  knowledgeDraft,
  knowledgeGeometry,
  knowledgeSelection,
  loadKnowledgeGroup,
  saveKnowledgeDraft,
  toggleKnowledgeCellLayer,
  updateKnowledgeDraft,
  type KnowledgeDraft,
} from "@/editor/panels/tilesetKnowledgeWorkspaceState";
import {
  renderKnowledgeTextArea,
  renderKnowledgeTextField,
} from "@/editor/panels/tilesetKnowledgeInspectorFields";
import {
  asPlacementFacing,
  asPlacementZone,
  describePlacementSurface,
  facingLabel,
  PLACEMENT_FACINGS,
  PLACEMENT_ZONES,
  placementZoneLabel,
} from "@/project/placementSurface";
import { directionalPassageFromPreset, togglePassageDirection, type DirectionalPassagePreset } from "@/project/tilesetPassage";
import type { PassFlag, TilesetDef } from "@/project/types";
import type { TilesetKnowledgeTemplate } from "@/project/tilesetKnowledge";
import { el } from "@/util/dom";

type TemplateOption = {
  readonly description: string;
  readonly label: string;
  readonly template: TilesetKnowledgeTemplate;
};

const TEMPLATES: readonly TemplateOption[] = [
  { template: "water-autotile-3x3", label: "물 지형 3×3", description: "8방향 연결 오토타일" },
  { template: "water-atlas-9x9", label: "물 아틀라스 9×9", description: "3×3 조각 9개 묶음" },
  { template: "desk", label: "책상·가구", description: "선택 모양 · 상위 레이어" },
  { template: "tree", label: "나무", description: "상단 상위 · 하단 하위" },
  { template: "one-way-path", label: "방향 통행 길", description: "3×3 연결 · 방향별 통행" },
  { template: "repeatable-cliff-2x3", label: "절벽 2×3", description: "2×3 가로·세로 반복" },
];

const DIRECTIONS: readonly { readonly key: keyof PassFlag; readonly label: string }[] = [
  { key: "up", label: "↑ 위" },
  { key: "left", label: "← 왼쪽" },
  { key: "right", label: "→ 오른쪽" },
  { key: "down", label: "↓ 아래" },
];

export function renderKnowledgeInspector(tileset: TilesetDef, rerender: () => void): HTMLElement {
  return el("div", {
    class: "tileset-knowledge-inspector",
    dataset: { testid: "tileset-knowledge-inspector" },
    children: [renderManualKnowledgeInspector(tileset, rerender)],
  });
}

function renderManualKnowledgeInspector(tileset: TilesetDef, rerender: () => void): HTMLElement {
  const geometry = knowledgeGeometry(tileset);
  const draft = knowledgeDraft();
  const compiled = compileKnowledgeDraft(tileset);
  return el("div", {
    class: "tileset-knowledge-manual-body",
    children: [
      renderSelectionSummary(geometry),
      renderTemplatePicker(draft.template, rerender),
      renderKnowledgeTextField("이름", draft.name, "tileset-knowledge-name", (value) => updateKnowledgeDraft({ name: value })),
      renderPassageControls(draft.passage, rerender),
      renderLayerMatrix(tileset, rerender),
      renderSurfaceControls(draft, rerender),
      renderProseFields(draft),
      renderCompileStatus(compiled),
      el("div", {
        class: "tileset-knowledge-actions",
        children: [
          el("button", {
            class: "database-footer-button primary",
            text: draft.activeGroupId ? "지식 업데이트" : "새 지식 저장",
            attrs: { type: "button", ...(compiled.kind === "invalid" ? { disabled: "true" } : {}) },
            dataset: { testid: "tileset-group-save" },
            on: { click: () => { if (saveKnowledgeDraft(tileset)) rerender(); } },
          }),
          el("button", {
            class: "database-footer-button",
            text: "선택 비우기",
            attrs: { type: "button" },
            on: { click: () => { clearKnowledgeSelection(); rerender(); } },
          }),
        ],
      }),
      renderGroupList(tileset, rerender),
    ],
  });
}

function renderSelectionSummary(geometry: ReturnType<typeof knowledgeGeometry>): HTMLElement {
  const summary = geometry.tileIds.length === 0
    ? "타일을 클릭하거나 드래그하세요"
    : `${geometry.tileIds.length}칸 · ${geometry.width}×${geometry.height} · (${geometry.x}, ${geometry.y})`;
  return el("section", {
    class: "tileset-knowledge-selection",
    attrs: { title: "드래그: 사각형 · Ctrl/Cmd: 추가 · Shift: 기준점부터 확장" },
    children: [
      el("strong", { text: "선택 영역" }),
      el("span", { text: summary, dataset: { testid: "tileset-knowledge-selection-summary" } }),
    ],
  });
}

function renderProseFields(draft: KnowledgeDraft): HTMLElement {
  return el("details", {
    class: "tileset-advanced-details",
    dataset: { testid: "tileset-knowledge-prose" },
    children: [
      el("summary", { text: "설명" }),
      renderKnowledgeTextArea("설명", draft.description, (value) => updateKnowledgeDraft({ description: value })),
      renderKnowledgeTextArea("배치 규칙", draft.placementRules, (value) => updateKnowledgeDraft({ placementRules: value })),
    ],
  });
}

function renderTemplatePicker(selected: TilesetKnowledgeTemplate, rerender: () => void): HTMLElement {
  return el("section", {
    class: "tileset-knowledge-section",
    children: [
      el("strong", { text: "이 영역은 무엇인가요?" }),
      el("div", {
        class: "tileset-knowledge-template-grid",
        children: TEMPLATES.map((option) => el("button", {
          class: option.template === selected ? "active" : "",
          attrs: { type: "button", "aria-pressed": String(option.template === selected) },
          dataset: { testid: `tileset-knowledge-template-${option.template}` },
          on: { click: () => { chooseKnowledgeTemplate(option.template); rerender(); } },
          children: [el("span", { text: option.label }), el("small", { text: option.description })],
        })),
      }),
    ],
  });
}

/**
 * 배치 면 — 「화덕은 북쪽 벽에 붙는다」를 여기서 고른다.
 *
 * 왜 위의 «배치 규칙» 문장과 따로 두는가: 그 문장은 AI 프롬프트에 잘려 들어가는 산문이고
 * 아무도 검사하지 않는다. 이쪽은 저장하면 그룹에 `surface` 클러스터 규칙이 생기고,
 * projectLint 가 맵을 훑어 위반을 규칙 감사 패널(왼쪽 팔레트 아래)에 올린다.
 * 강도 hard 는 error, medium 은 warning, soft 는 info 로 보고된다.
 */
function renderSurfaceControls(draft: KnowledgeDraft, rerender: () => void): HTMLElement {
  const zoneSelect = el("select", {
    dataset: { testid: "tileset-knowledge-surface-zone" },
    attrs: { "aria-label": "배치 면" },
    children: [
      el("option", {
        attrs: draft.surfaceZone === "none" ? { value: "none", selected: "" } : { value: "none" },
        text: "조건 없음",
      }),
      ...PLACEMENT_ZONES.map((zone) => el("option", {
        attrs: draft.surfaceZone === zone ? { value: zone, selected: "" } : { value: zone },
        text: placementZoneLabel(zone),
      })),
    ],
    on: {
      change: (event: Event) => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLSelectElement)) return;
        updateKnowledgeDraft({ surfaceZone: asPlacementZone(target.value) ?? "none" });
        rerender();
      },
    },
  });

  const facingSelect = el("select", {
    dataset: { testid: "tileset-knowledge-surface-facing" },
    attrs: { "aria-label": "어느 쪽이 벽" },
    children: PLACEMENT_FACINGS.map((facing) => el("option", {
      attrs: draft.surfaceFacing === facing ? { value: facing, selected: "" } : { value: facing },
      text: facingLabel(facing),
    })),
    on: {
      change: (event: Event) => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLSelectElement)) return;
        updateKnowledgeDraft({ surfaceFacing: asPlacementFacing(target.value) ?? "any" });
        rerender();
      },
    },
  });

  const strengthSelect = el("select", {
    dataset: { testid: "tileset-knowledge-surface-strength" },
    attrs: { "aria-label": "강도" },
    children: ([
      // 세 칸이 한 줄에 들어가는 폭이라 설명은 두 글자로 줄인다 — 실측에서 "강함 — 위반은 오류" 가
      // "강함 — 위반은" 으로 잘려, 가장 중요한 낱말(오류)만 사라졌다.
      ["hard", "강함 · 막음"],
      ["medium", "중간 · 경고"],
      ["soft", "느슨함 · 참고"],
    ] as const).map(([value, label]) => el("option", {
      attrs: draft.surfaceStrength === value ? { value, selected: "" } : { value },
      text: label,
    })),
    on: {
      change: (event: Event) => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLSelectElement)) return;
        const value = target.value;
        updateKnowledgeDraft({
          surfaceStrength: value === "medium" || value === "soft" ? value : "hard",
        });
        rerender();
      },
    },
  });

  const preview = draft.surfaceZone === "none"
    ? "어디에나 놓을 수 있습니다"
    : `${describePlacementSurface({
      zone: draft.surfaceZone,
      ...(draft.surfaceFacing === "any" ? {} : { facing: draft.surfaceFacing }),
    })}에만 놓입니다`;

  return el("section", {
    class: "tileset-knowledge-section",
    dataset: { testid: "tileset-knowledge-surface" },
    children: [
      el("strong", { text: "배치 면" }),
      el("div", {
        class: "tileset-knowledge-preset-row",
        children: draft.surfaceZone === "againstWall"
          ? [zoneSelect, facingSelect, strengthSelect]
          : [zoneSelect, strengthSelect],
      }),
      el("small", { text: preview, dataset: { testid: "tileset-knowledge-surface-preview" } }),
    ],
  });
}

function renderPassageControls(passage: PassFlag, rerender: () => void): HTMLElement {
  return el("section", {
    class: "tileset-knowledge-section",
    children: [
      el("strong", { text: "통행과 표시 레이어" }),
      el("div", {
        class: "tileset-knowledge-preset-row",
        children: ([
          ["open", "O 통행"],
          ["blocked", "X 차단"],
          ["star", "★ 위에 표시"],
        ] as const).map(([preset, label]) => el("button", {
          text: label,
          attrs: { type: "button" },
          on: { click: () => { applyPassagePreset(preset); rerender(); } },
        })),
      }),
      el("div", {
        class: "tileset-knowledge-direction-grid",
        children: DIRECTIONS.map(({ key, label }) => el("button", {
          class: passage[key] ? "open" : "blocked",
          text: `${label} ${passage[key] ? "통과" : "차단"}`,
          attrs: { type: "button", "aria-pressed": String(passage[key]) },
          dataset: { testid: `tileset-knowledge-passage-${key}` },
          on: { click: () => { updateKnowledgeDraft({ passage: togglePassageDirection(passage, key) }); rerender(); } },
        })),
      }),
    ],
  });
}

function applyPassagePreset(preset: DirectionalPassagePreset): void {
  const rule = directionalPassageFromPreset(preset);
  if (preset === "star") {
    updateKnowledgeDraft({
      cellLayers: knowledgeSelection().selected.map(() => "upper"),
      passage: rule.passability,
    });
    return;
  }
  updateKnowledgeDraft({ passage: rule.passability });
}

function renderLayerMatrix(tileset: TilesetDef, rerender: () => void): HTMLElement {
  const geometry = knowledgeGeometry(tileset);
  const draft = knowledgeDraft();
  if (geometry.tileIds.length === 0 || geometry.tileIds.length > 81) return el("div");
  const compiled = compileKnowledgeDraft(tileset);
  const layers = compiled.kind === "valid" ? compiled.value.rules.map((rule) => rule.layer) : geometry.tileIds.map(() => "lower" as const);
  const grid = el("div", {
    class: "tileset-knowledge-layer-grid",
    dataset: { testid: "tileset-knowledge-layer-grid" },
    attrs: { role: "group", "aria-label": "선택 타일별 레이어" },
    children: geometry.tileIds.map((tile, index) => el("button", {
      class: layers[index] === "upper" ? "upper" : "lower",
      text: `${tile}\n${layers[index] === "upper" ? "상" : "하"}`,
      attrs: { type: "button", title: `${tile}번 타일 레이어 전환`, "aria-pressed": String(layers[index] === "upper") },
      dataset: { testid: `tileset-knowledge-layer-${tile}` },
      on: { click: () => { toggleKnowledgeCellLayer(tile); rerender(); } },
    })),
  });
  grid.style.setProperty("--knowledge-cols", String(Math.max(1, geometry.width)));
  return el("section", {
    class: "tileset-knowledge-section",
    children: [
      el("strong", { text: "타일별 레이어" }),
      el("small", { text: draft.template === "tree" ? "나무는 마지막 줄을 하위 레이어로 제안합니다." : "각 칸을 눌러 상·하위 레이어를 바꿉니다." }),
      grid,
    ],
  });
}

function renderCompileStatus(compiled: ReturnType<typeof compileKnowledgeDraft>): HTMLElement {
  if (compiled.kind === "invalid") {
    return el("div", {
      class: "tileset-knowledge-status error",
      attrs: { role: "status" },
      text: compiled.issues.map((issue) => issue.message).join(" "),
    });
  }
  const group = compiled.value.group;
  const shape = group.patternGrammar?.kind ?? "single";
  return el("div", {
    class: "tileset-knowledge-status ready",
    attrs: { role: "status" },
    text: `저장 준비 · ${group.role} · ${group.layerHome ?? group.defaultLayer} · ${shape}`,
  });
}

function renderGroupList(tileset: TilesetDef, rerender: () => void): HTMLElement {
  const activeId = knowledgeDraft().activeGroupId;
  return el("section", {
    class: "tileset-knowledge-section",
    children: [
      el("strong", { text: `저장된 지식 ${tileset.tileGroups?.length ?? 0}` }),
      el("div", {
        class: "tileset-db-group-list",
        children: (tileset.tileGroups ?? []).map((group) => el("button", {
          class: `tileset-db-group-row${group.id === activeId ? " active" : ""}`,
          text: `${group.name} · ${group.tileIds.length}칸`,
          attrs: { type: "button", title: group.description || group.placementRules },
          dataset: { testid: `tileset-knowledge-group-${group.id}` },
          on: { click: () => { loadKnowledgeGroup(group, tileset); rerender(); } },
        })),
      }),
    ],
  });
}
