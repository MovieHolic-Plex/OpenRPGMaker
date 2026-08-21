import { field } from "@/editor/panels/databaseControls";
import {
  AUTOTILE_TEMPLATE_KIND_GUIDES,
  previewTemplateTiles,
  type AutotileTemplateKind,
} from "@/editor/panels/tilesetAutotileTemplates";
import { addAutotileGroupFromTemplate } from "@/editor/tilesetActions";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

// 오토타일 템플릿 위저드 패널 — DB→타일셋→구성 탭의 "템플릿에서 만들기".
// 템플릿 종류(RM2K 3×4 / 3×3 / 3×2 / 애니메이션 물) + 앵커 타일 번호를 받아
// 역할별 타일 id 미리보기를 보여주고, 확정 시 addAutotileGroupFromTemplate 로 커밋한다.
// 순수 계산은 tilesetAutotileTemplates.ts, 커밋은 tilesetActions.ts 에 위임한다.

// 위저드 초안 상태(리렌더에도 유지되는 모듈 상태 — tilesetAutotileEditor.ts 의 groupDraftName 선례).
let draftKind: AutotileTemplateKind = "oprn-3x4";
let draftAnchorText = "";
let resultLines: string[] = [];
let resultIsError = false;

export function renderAutotileTemplateWizard(tileset: TilesetDef, rerender: () => void): HTMLElement {
  const kindSelect = el("select", {
    children: AUTOTILE_TEMPLATE_KIND_GUIDES.map((guide) =>
      el("option", {
        text: guide.label,
        attrs: guide.id === draftKind ? { value: guide.id, selected: "true" } : { value: guide.id },
      })
    ),
  });
  kindSelect.dataset.testid = "autotile-template-kind";
  kindSelect.addEventListener("change", () => {
    draftKind = (AUTOTILE_TEMPLATE_KIND_GUIDES.find((guide) => guide.id === kindSelect.value)?.id ?? "oprn-3x4");
  });

  // TODO(후속): 그림판 미리보기 시트 클릭으로 앵커를 고르는 연동(renderChipsetPreviewPanel
  // onApplyModeTile + editMode "autotile") — 현재는 숫자 입력만 지원한다.
  const anchorInput = el("input", {
    attrs: { type: "number", min: "0", placeholder: `0 ~ ${tileset.count - 1}` },
    value: draftAnchorText,
  });
  anchorInput.dataset.testid = "autotile-template-anchor";
  anchorInput.addEventListener("input", () => {
    draftAnchorText = anchorInput.value;
  });

  return el("div", {
    class: "tileset-autotile-template-wizard",
    dataset: { testid: "autotile-template-wizard" },
    children: [
      el("div", {
        class: "tileset-autotile-fill-title",
        text: "템플릿에서 만들기 — 앵커(블록 좌상단) 타일 번호 하나로 그룹을 생성합니다.",
      }),
      field("템플릿 종류", kindSelect),
      field("앵커 타일 번호", anchorInput),
      el("div", {
        class: "tileset-autotile-add-row",
        children: [
          el("button", {
            class: "tileset-db-small-button",
            text: "미리보기",
            attrs: { type: "button" },
            dataset: { testid: "autotile-template-preview" },
            on: {
              click: () => {
                const anchor = parseAnchor();
                if (anchor === null) {
                  setResult(["앵커 타일 번호를 입력하세요."], true);
                } else {
                  const preview = previewTemplateTiles(draftKind, anchor, tileset.tilesPerRow, tileset.count);
                  if ("error" in preview) setResult([preview.error], true);
                  else setResult(preview.entries.map((entry) => `${entry.role}: ${entry.tileId}`), false);
                }
                rerender();
              },
            },
          }),
          el("button", {
            class: "tileset-db-small-button",
            text: "추가",
            attrs: { type: "button" },
            dataset: { testid: "autotile-template-add" },
            on: {
              click: () => {
                const anchor = parseAnchor();
                if (anchor === null) {
                  setResult(["앵커 타일 번호를 입력하세요."], true);
                } else {
                  const outcome = addAutotileGroupFromTemplate(tileset.id, draftKind, anchor);
                  if (!outcome.ok) setResult([outcome.error], true);
                  else if (outcome.groupId !== undefined) setResult([`오토타일 그룹이 추가되었습니다 (id: ${outcome.groupId}).`], false);
                  else setResult(["애니메이션 스트립이 추가되었습니다 (렌더 연동은 후속 작업)."], false);
                }
                rerender();
              },
            },
          }),
        ],
      }),
      ...(resultLines.length > 0
        ? [el("div", {
            class: `tileset-autotile-template-result${resultIsError ? " danger" : ""}`,
            dataset: { testid: "autotile-template-result" },
            children: resultLines.map((line) => el("div", { text: line })),
          })]
        : []),
    ],
  });
}

function parseAnchor(): number | null {
  const parsed = Number.parseInt(draftAnchorText, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function setResult(lines: string[], isError: boolean): void {
  resultLines = lines;
  resultIsError = isError;
}
