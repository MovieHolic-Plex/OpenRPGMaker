import { segmentedControl, textControl } from "@/editor/panels/databaseControls";
import {
  absenceEditor,
  bodyField,
  lawRow,
  toneRow,
  writeCanon,
} from "@/editor/panels/databaseWorldCanonFields";
import { detailPane, sectionCard, workspaceShell } from "@/editor/panels/databaseWorkspace";
import { store } from "@/project/store";
import {
  isWorldCanonStatus,
  resolveWorldCanon,
  WORLD_CANON_LAW_KINDS,
  type ResolvedWorldCanon,
} from "@/project/world/canon";
import { el } from "@/util/dom";

export function renderWorldCanonTab(host: HTMLElement, rerender: () => void): void {
  const canon = resolveWorldCanon(store.getCurrent().worldCanon);
  host.append(
    workspaceShell({
      testid: "db-world-canon-workspace",
      detail: detailPane({
        body: [
          identityCard(canon),
          sectionCard({
            title: "뼈대",
            hint: "톤·시대·이 세계에 없는 것",
            testid: "db-world-canon-frame",
            children: [
              toneRow(canon.tones, rerender),
              textControl("시대", canon.era, (value) => writeCanon({ era: value }, "db-world-canon-era"), "db-world-canon-era"),
              textControl("기술 천장", canon.techCeiling, (value) => writeCanon({ techCeiling: value }, "db-world-canon-tech"), "db-world-canon-tech"),
              absenceEditor(canon.absences, rerender),
            ],
          }),
          sectionCard({
            title: "법칙",
            hint: "힘 · 신 · 죽음 · 돈",
            testid: "db-world-canon-laws",
            children: WORLD_CANON_LAW_KINDS.map((kind) => lawRow(kind, canon.laws[kind], canon.laws, rerender)),
          }),
          sectionCard({
            title: "설정집",
            hint: "역사·지형·문화·비밀 — 형식 없음",
            testid: "db-world-canon-codex",
            children: [bodyField(canon.body)],
          }),
        ],
      }),
    }),
  );
}

function identityCard(canon: ResolvedWorldCanon): HTMLElement {
  const name = el("input", {
    class: "db-world-canon-name",
    attrs: {
      type: "text",
      placeholder: "이 세계의 이름",
      "aria-label": "세계 이름",
    },
    value: canon.name,
    dataset: { testid: "db-world-canon-name" },
  });
  name.addEventListener("input", () => writeCanon({ name: name.value }, "db-world-canon-name"));
  const premise = el("textarea", {
    class: "db-world-canon-premise",
    attrs: {
      rows: "2",
      placeholder: "한 줄로, 이 세계는 어떤 곳인가",
      "aria-label": "한 줄 전제",
    },
    value: canon.premise,
    dataset: { testid: "db-world-canon-premise" },
  });
  premise.addEventListener("input", () => writeCanon({ premise: premise.value }, "db-world-canon-premise"));
  return sectionCard({
    testid: "db-world-canon-identity",
    children: [
      name,
      premise,
      segmentedControl(
        "상태",
        "db-world-canon-status",
        canon.status,
        [
          { id: "draft", name: "초안" },
          { id: "canon", name: "확정" },
          { id: "secret", name: "비밀" },
        ],
        (value) => {
          if (!isWorldCanonStatus(value)) return;
          writeCanon({ status: value });
        },
      ),
    ],
  });
}
