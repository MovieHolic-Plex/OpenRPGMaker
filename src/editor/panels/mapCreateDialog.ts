import { t } from "@/i18n";
import { addMapFolder, createMapFromSpec } from "@/editor/actions";
import { selectEditorMap } from "@/editor/mapSelection";
import { openEventSubdialog } from "@/editor/panels/eventEditor/subdialog";
import { appendGroupedTilesetOptions } from "@/editor/tilesetSelectOptions";
import {
  inspectMapCreateInput,
  mapCreateInputOk,
  resolveMapCreateDefaults,
  type MapCreatePreset,
  type MapCreateRequest,
  type MapDimensionIssue,
} from "@/project/mapCreateSpec";
import { MAX_TOOL_MAP_DIMENSION, mapSizeLimitMessage } from "@/project/mapSizeLimits";
import { findParentMapId, isMapTreeFolder, mapTreeNodeLabel } from "@/project/mapTree";
import { store } from "@/project/store";
import type { MapId, MapTreeNode, Project } from "@/project/types";
import { el } from "@/util/dom";
import { openWorldAtlasCreateDialog } from './worldAtlasCreateDialog';
import { WORLDMAP_AUTHORING_ID } from '@/project/defaults/worldmapAuthoring';

export function openMapCreateDialog(request: MapCreateRequest = {}): void {
  const project = store.getCurrent();
  let spec = resolveMapCreateDefaults(project, request);
  openEventSubdialog({
    title: spec.parentId ? "하위 맵 만들기" : "맵 만들기",
    subtitle: "시작 모양과 크기를 고르고 「만들기」를 누르세요.",
    testId: "map-create-dialog",
    width: "narrow",
    render: (body, close) => {
      const name = el("input", {
        attrs: { type: "text", "aria-label": "맵 이름" },
        // 저장되는 데이터 기본값이라 입력칸 value 는 DOM 번역이 건드리지 않는다 — 기본 이름만 현재 언어로 채운다.
        value: localizedDefaultName(spec.name),
        dataset: { testid: "map-create-name" },
      }) as HTMLInputElement;
      const width = el("input", {
        attrs: { type: "number", min: "4", max: String(MAX_TOOL_MAP_DIMENSION), "aria-label": "가로" },
        value: spec.width,
        dataset: { testid: "map-create-width" },
      }) as HTMLInputElement;
      const height = el("input", {
        attrs: { type: "number", min: "4", max: String(MAX_TOOL_MAP_DIMENSION), "aria-label": "높이" },
        value: spec.height,
        dataset: { testid: "map-create-height" },
      }) as HTMLInputElement;
      const tileset = el("select", {
        attrs: { "aria-label": "타일 그림판" },
        dataset: { testid: "map-create-tileset" },
      }) as HTMLSelectElement;
      appendGroupedTilesetOptions(tileset, Object.values(project.tilesets));
      tileset.value = spec.tilesetId;
      const parent = el("select", {
        attrs: { "aria-label": "상위 맵" },
        dataset: { testid: "map-create-parent" },
      }) as HTMLSelectElement;
      // 빈 상위는 프로젝트 루트가 아니라 **트리 최상위 노드의 자식**으로 들어간다
      // (mapTree.insertTreeNode: parentId "" → root). 이 저장소의 최상위는 언제나 실제 맵
      // 하나라서 예전 「(루트)」는 없는 계층(형제 최상위 맵)을 약속했다 — 실제로 부모가 되는
      // 맵을 이름으로 밝힌다(OPRN-OUT-027). 저장 구조는 그대로다.
      parent.append(el("option", { text: t("{0}의 하위").replace("{0}", rootParentPrefix(project)), attrs: { value: "" } }));
      appendTreeParentOptions(parent, project.mapTree, project.maps, 0);
      parent.value = spec.parentId;

      const error = el("div", {
        class: "map-create-error",
        attrs: { role: "alert", id: "map-create-error" },
        dataset: { testid: "map-create-error" },
      });
      error.hidden = true;
      const described = (input: HTMLInputElement): void => {
        input.setAttribute("aria-describedby", "map-create-error");
      };
      described(name);
      described(width);
      described(height);

      const showIssues = (): boolean => {
        const issues = inspectMapCreateInput({ name: name.value, width: width.value, height: height.value });
        const lines = mapCreateIssueLines(issues);
        error.replaceChildren(...lines.map((line) => el("p", { text: line })));
        error.hidden = lines.length === 0;
        name.setAttribute("aria-invalid", issues.nameBlank ? "true" : "false");
        width.setAttribute("aria-invalid", issues.width ? "true" : "false");
        height.setAttribute("aria-invalid", issues.height ? "true" : "false");
        return mapCreateInputOk(issues);
      };

      const applyPreset = (preset: MapCreatePreset): void => {
        spec = resolveMapCreateDefaults(store.getCurrent(), {
          parentId: parent.value as MapId | "",
          preset,
          name: name.value,
        });
        width.value = String(spec.width);
        height.value = String(spec.height);
        tileset.value = spec.tilesetId;
        showIssues();
      };

      // 시작 모양은 하나만 고른다 — 고른 것이 눌린 상태(aria-pressed)로 보여야 무엇이 적용됐는지 안다.
      const presets = el("div", { class: "map-create-presets", attrs: { role: "group", "aria-label": "시작 모양" } });
      const presetButtons: HTMLButtonElement[] = [];
      const press = (pressed: HTMLButtonElement): void => {
        for (const button of presetButtons) button.setAttribute("aria-pressed", String(button === pressed));
      };
      const presetButton = (testid: string, label: string, title: string, onPick: () => void, pressed: boolean): HTMLButtonElement => {
        const button = el("button", {
          class: "btn map-create-preset",
          text: label,
          attrs: { type: "button", title, "aria-pressed": String(pressed) },
          dataset: { testid },
          on: { click: () => { onPick(); press(button); } },
        }) as HTMLButtonElement;
        presetButtons.push(button);
        return button;
      };
      // 「빈 맵」은 실제로 기본 바닥(풀)을 깔아 만든다 — 이름을 만들어지는 것과 맞춘다.
      for (const [value, label, title] of [
        ["blank", "풀밭 맵", "기본 바닥 타일을 깐 야외 맵"],
        ["inherit-parent", "부모와 같게", "상위 맵과 같은 크기·타일 그림판"],
        ["interior", "실내", "실내 타일 그림판의 작은 방"],
      ] as const) {
        presets.append(presetButton(`map-create-preset-${value}`, label, title, () => applyPreset(value), spec.preset === value));
      }
      presets.append(presetButton("map-create-worldmap-blank", "빈 월드맵", "월드맵 그림판의 48×36 맵",
        () => { applyPreset("blank"); tileset.value = WORLDMAP_AUTHORING_ID; width.value = "48"; height.value = "36"; showIssues(); }, false));

      const submit = (): void => {
        // 상한·하한·빈 이름은 조용히 바꾸지 않는다. min/max 속성은 붙여넣기와 음수를 막지 못하고,
        // 값만 클램프하면 -5×2 가 4×4 「새 맵」으로 말없이 생겼다.
        if (!showIssues()) {
          const issues = inspectMapCreateInput({ name: name.value, width: width.value, height: height.value });
          if (issues.nameBlank) name.focus();
          else if (issues.width) width.focus();
          else height.focus();
          return;
        }
        const id = createMapFromSpec({
          name: name.value.trim(),
          width: Number(width.value),
          height: Number(height.value),
          tilesetId: tileset.value,
          parentId: parent.value as MapId | "",
          preset: spec.preset,
        });
        if (!id) return;
        selectEditorMap(id);
        close();
      };

      body.append(
        el("div", { class: "map-create-form", children: [
          presets,
          field("이름", name),
          el("div", { class: "map-create-size", children: [field("가로", width), el("span", { class: "map-create-times", text: "×", attrs: { "aria-hidden": "true" } }), field("높이", height)] }),
          error,
          field("타일 그림판", tileset),
          field("상위 맵", parent),
          el("p", {
            class: "map-create-hint",
            text: "상위 맵에 넣어도 문은 생기지 않아요. 만든 뒤 맵 메뉴의 「부모와 왕복 이동 넣기」로 이을 수 있어요.",
          }),
          el("div", { class: "map-create-actions", children: [
            el("div", { class: "map-create-secondary", children: [
              el("button", { class: "btn map-create-link", text: "세계 지도 만들기…", attrs: { type: "button" }, dataset: { testid: "map-create-world-atlas" }, on: { click: () => { close(); openWorldAtlasCreateDialog(); } } }),
              el("button", {
                class: "btn map-create-link",
                text: "분류만 만들기",
                attrs: { type: "button", title: "맵이 아닌 정리용 폴더를 만듭니다" },
                dataset: { testid: "map-create-folder" },
                on: {
                  click: () => {
                    addMapFolder(parent.value as MapId | "", name.value.trim() || "새 분류");
                    close();
                  },
                },
              }),
            ] }),
            el("button", { class: "btn map-create-cancel", text: "취소", attrs: { type: "button" }, dataset: { testid: "map-create-cancel" }, on: { click: () => close() } }),
            el("button", {
              class: "btn primary map-create-submit",
              text: "만들기",
              attrs: { type: "button" },
              dataset: { testid: "map-create-confirm" },
              on: { click: submit },
            }),
          ] }),
        ] }),
      );
      for (const input of [name, width, height]) input.addEventListener("input", () => { showIssues(); });
      name.focus();
      name.select();
    },
  });
}

export function openMapCreateUnder(parentId: MapId): void {
  const project = store.getCurrent();
  const parentOfParent = findParentMapId(project.mapTree, parentId);
  openMapCreateDialog({
    parentId,
    preset: parentOfParent === null ? "inherit-parent" : "interior",
  });
}

/**
 * 트리 최상위 노드를 사람 말로 — 「(루트)」가 감췄던 실제 부모다.
 * 최상위는 보통 실제 맵이지만 합성 분류가 앉을 수도 있어(mapInspection 의 같은 방어) 낱말을 가른다.
 */
function rootParentPrefix(project: Pick<Project, "mapTree" | "maps">): string {
  const label = mapTreeNodeLabel(project.mapTree, project.maps);
  // 낱말을 가르지 않고 완성 문장 키로 둔다 — 조각 이어 붙임은 번역기가 잘못 잡는다.
  return t(isMapTreeFolder(project.mapTree) ? "최상위 분류 「{0}」" : "최상위 맵 「{0}」").replace("{0}", t(label));
}

function localizedDefaultName(name: string): string {
  return name === "새 맵" || name === "새 방" ? t(name) : name;
}

function appendTreeParentOptions(
  select: HTMLSelectElement,
  node: MapTreeNode,
  maps: ReturnType<typeof store.getCurrent>["maps"],
  depth: number,
): void {
  const prefix = depth > 0 ? `${"— ".repeat(depth)}` : "";
  const label = isMapTreeFolder(node) ? `[분류] ${mapTreeNodeLabel(node, maps)}` : mapTreeNodeLabel(node, maps);
  select.append(el("option", { text: `${prefix}${label}`, attrs: { value: node.mapId } }));
  for (const child of node.children) appendTreeParentOptions(select, child, maps, depth + 1);
}

function field(label: string, control: HTMLElement): HTMLElement {
  return el("label", { class: "map-create-field", children: [el("span", { text: label }), control] });
}

const NAME_REQUIRED = "이름을 비웠습니다. 빈 이름 대신 「새 맵」으로 만들지 않습니다. 맵 이름을 입력하세요.";
const NO_SILENT_SIZE = "다른 크기로 바꿔 넣지 않습니다.";

/** 대화창에 그대로 보여줄 문장. 비어 있으면 지금 입력으로 맵을 만들어도 된다. */
export function mapCreateIssueLines(issues: ReturnType<typeof inspectMapCreateInput>): readonly string[] {
  const lines: string[] = [];
  if (issues.nameBlank) lines.push(NAME_REQUIRED);
  if (issues.width) lines.push(dimensionLine("가로", issues.width));
  if (issues.height) lines.push(dimensionLine("높이", issues.height));
  if (issues.width || issues.height) lines.push(NO_SILENT_SIZE);
  if (issues.width?.kind === "too-big" || issues.height?.kind === "too-big") lines.push(mapSizeLimitMessage());
  return lines;
}

function dimensionLine(axis: "가로" | "높이", issue: MapDimensionIssue): string {
  if (axis === "가로") {
    if (issue.kind === "empty") return "가로가 비어 있습니다.";
    if (issue.kind === "not-integer") return `가로 「${issue.raw}」는 정수가 아닙니다.`;
    if (issue.kind === "too-small") return `가로 ${issue.value}칸은 4칸보다 작습니다.`;
    return `가로 ${issue.value}칸은 최대 ${MAX_TOOL_MAP_DIMENSION}칸을 넘습니다.`;
  }
  if (issue.kind === "empty") return "높이가 비어 있습니다.";
  if (issue.kind === "not-integer") return `높이 「${issue.raw}」는 정수가 아닙니다.`;
  if (issue.kind === "too-small") return `높이 ${issue.value}칸은 4칸보다 작습니다.`;
  return `높이 ${issue.value}칸은 최대 ${MAX_TOOL_MAP_DIMENSION}칸을 넘습니다.`;
}
