// panels/structureKitImportDialog.ts
// 구조물 가져오기 — 3단 게이트의 마지막 두 단을 사람에게 보여준다.
//   ① 파일 검증 실패 → 창을 열지 않고 토스트 (parseStructureKitFile 이 던진다)
//   ② 킷 검증 실패 → 그 킷만 회색으로 이유와 함께 남는다 (planImport.diagnostics)
//   ③ 칩셋 불일치 → 경고 배너 + [그래도 가져오기]
// 판정은 전부 planImport 가 끝냈다 — 여기는 계획을 그리기만 한다.

import { importStructureKits } from "@/editor/harnessSuggestion/structureKitActions";
import {
  parseStructureKitFile,
  planImport,
  StructureKitFileError,
  type ImportPlan,
} from "@/editor/harnessSuggestion/structureKitFile";
import { openDialog } from "@/editor/panels/databaseEnemyRecordSupport";
import { LEGACY_RPGZZU_EXTENSION, OPRN_EXTENSION } from "@/project/package";
import { store } from "@/project/store";
import type { TilesetId } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

/**
 * 프로젝트 파일(.oprn/.rpgzzu)은 ZIP 바이너리다 — 텍스트로 읽어 parseStructureKitFile 에 넘기면
 * JSON.parse 부터 깨져서 판별자 부재 안내("프로젝트 파일을 고르셨는지 확인해 주세요")가 뜰 기회도
 * 없이 일반 "JSON 으로 읽을 수 없는 파일입니다" 뒤에 가려진다. 읽기 전에 이름으로 먼저 걸러낸다.
 */
function isProjectFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(OPRN_EXTENSION) || lower.endsWith(LEGACY_RPGZZU_EXTENSION);
}

export function pickAndImportStructureKits(tilesetId: TilesetId, onDone: () => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    if (isProjectFileName(file.name)) {
      toast("이건 프로젝트 파일입니다. 구조물 파일(.rpgzzu-kit.json)을 골라 주세요.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const tileset = store.getCurrent().tilesets[tilesetId];
      if (!tileset) return;
      try {
        const { file: parsed, diagnostics } = parseStructureKitFile(String(reader.result));
        const plan = planImport(parsed, tileset, (tileset.structureKits ?? []).filter((kit) => kit.kind === "section"), diagnostics);
        openStructureKitImportDialog(tilesetId, plan, onDone);
      } catch (error) {
        const message = error instanceof StructureKitFileError ? error.message : "가져오기 실패";
        toast(message, "error");
      }
    };
    reader.onerror = () => toast("파일 읽기 실패", "error");
    reader.readAsText(file);
  });
  input.click();
}

export function openStructureKitImportDialog(tilesetId: TilesetId, plan: ImportPlan, onDone: () => void): void {
  const checked = new Set(
    plan.candidates.filter((candidate) => candidate.defaultChecked).map((candidate) => candidate.kit.id),
  );

  const content: HTMLElement[] = [];

  if (plan.tilesetMismatch) {
    const targetName = store.getCurrent().tilesets[tilesetId]?.name ?? tilesetId;
    content.push(
      el("div", {
        class: "structure-kit-import-warn",
        dataset: { testid: "structure-kit-import-mismatch" },
        children: [
          el("strong", { text: "다른 칩셋의 구조물입니다" }),
          el("p", {
            text: `파일: ${plan.fileTilesetName} · 지금 앨범: ${targetName}`
              + " — 구조물은 타일 번호 배열이라 칩셋이 다르면 그림이 깨집니다.",
          }),
        ],
      }),
    );
  }

  const list = el("div", { class: "structure-kit-import-list", dataset: { testid: "structure-kit-import-list" } });
  for (const candidate of plan.candidates) {
    const badges: HTMLElement[] = [];
    if (candidate.duplicate) badges.push(el("span", { class: "structure-kit-part-badge gray", text: "이미 있음" }));
    if (candidate.nameConflict) badges.push(el("span", { class: "structure-kit-part-badge teal", text: "이름 중복" }));

    list.append(
      el("label", {
        class: "structure-kit-import-row",
        children: [
          el("input", {
            attrs: checked.has(candidate.kit.id) ? { type: "checkbox", checked: "" } : { type: "checkbox" },
            dataset: { testid: `structure-kit-import-check-${candidate.kit.id}` },
            on: {
              click: () => {
                if (checked.has(candidate.kit.id)) checked.delete(candidate.kit.id);
                else checked.add(candidate.kit.id);
              },
            },
          }),
          el("span", { class: "structure-kit-import-name", text: candidate.resolvedName }),
          el("span", { class: "structure-kit-import-size", text: `${candidate.kit.width}×${candidate.kit.height}` }),
          ...badges,
        ],
      }),
    );
  }

  for (const diagnostic of plan.diagnostics) {
    list.append(
      el("div", {
        class: "structure-kit-import-row broken",
        dataset: { testid: `structure-kit-import-broken-${diagnostic.index}` },
        children: [
          el("span", { class: "structure-kit-import-name", text: diagnostic.name }),
          el("span", { class: "structure-kit-import-reason", text: diagnostic.reason }),
        ],
      }),
    );
  }

  if (plan.candidates.length === 0 && plan.diagnostics.length === 0) {
    list.append(el("p", { class: "structure-kit-quiet", text: "파일에 가져올 구조물이 없습니다." }));
  }

  content.push(
    el("div", {
      class: "structure-kit-import-head",
      text: `${plan.candidates.length}개의 구조물을 찾았습니다`
        + (plan.diagnostics.length > 0 ? ` · ${plan.diagnostics.length}개는 읽을 수 없습니다` : ""),
    }),
    list,
  );

  openDialog(
    "structure-kit-import",
    plan.tilesetMismatch ? "가져오기 — 칩셋 확인" : "구조물 가져오기",
    content,
    [
      {
        label: plan.tilesetMismatch ? "그래도 가져오기" : "가져오기",
        testid: "structure-kit-import-confirm",
        action: () => {
          const entries = plan.candidates
            .filter((candidate) => checked.has(candidate.kit.id))
            .map((candidate) => ({ kit: candidate.kit, name: candidate.resolvedName }));
          const added = importStructureKits(tilesetId, entries);
          toast(added > 0 ? `구조물 ${added}개를 가져왔습니다` : "가져온 구조물이 없습니다", added > 0 ? "ok" : "info");
          onDone();
        },
      },
      { label: "취소", testid: "structure-kit-import-cancel" },
    ],
  );
}
