import { segmentedControl } from "@/editor/panels/databaseControls";
import {
  absenceEditor,
  bodyField,
  boundedCanonText,
  lawRow,
  toneRow,
  WORLD_CANON_TONE_LABELS,
  writeCanon,
} from "@/editor/panels/databaseWorldCanonFields";
import { detailHero, detailPane, sectionCard, workspaceShell } from "@/editor/panels/databaseWorkspace";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import {
  isWorldCanonStatus,
  resolveWorldCanon,
  WORLD_CANON_LAW_KINDS,
  WORLD_CANON_BOUNDS,
  type ResolvedWorldCanon,
} from "@/project/world/canon";
import { el } from "@/util/dom";

export function renderWorldCanonTab(host: HTMLElement, rerender: () => void): void {
  const canon = resolveWorldCanon(store.getCurrent().worldCanon);
  const bodyCard = sectionCard({
    title: "본문",
    hint: "역사·지형·문화·비밀",
    testid: "db-world-canon-body-card",
    children: [bodyField(canon.body, hintLine)],
  });
  // 본문 타이핑마다 힌트 줄의 발췌 카운터를 갱신한다 — 다시 렌더하지 않고 숫자만 바꾼다.
  function hintLine(): void {
    const filled = (bodyCard.querySelector("[data-testid='db-world-canon-body']") as HTMLTextAreaElement | null)
      ?.value.trim().length ?? canon.body.trim().length;
    const hint = bodyCard.querySelector(".db-ws-card-hint");
    if (hint) hint.textContent = excerptHint(filled);
  }
  hintLine();
  host.append(
    workspaceShell({
      testid: "db-world-canon-workspace",
      header: detailHero({
        eyebrow: "이 세계 · AI가 항상 읽는 한 장",
        title: canon.name || "이름 없는 세계",
        subtitle: "이 세계에 적는 것이 조수·개요·장르 시드가 읽는 정본이다. 낱장 카드는 「설정집」 탭에 둔다.",
        tags: [
          ...canon.tones.map((tone) => WORLD_CANON_TONE_LABELS[tone]),
          ...(canon.absences.length > 0 ? [`없는 것 ${canon.absences.length}`] : []),
        ],
        testid: "db-world-canon-hero",
      }),
      detail: detailPane({
        body: [
          identityCard(canon),
          sectionCard({
            title: "뼈대",
            hint: "톤·시대·이 세계에 없는 것",
            testid: "db-world-canon-frame",
            children: [
              toneRow(canon.tones, rerender),
              boundedCanonText("시대", canon.era, (value) => writeCanon({ era: value }, "db-world-canon-era"), "db-world-canon-era", WORLD_CANON_BOUNDS.era),
              boundedCanonText("기술 천장", canon.techCeiling, (value) => writeCanon({ techCeiling: value }, "db-world-canon-tech"), "db-world-canon-tech", WORLD_CANON_BOUNDS.techCeiling),
              absenceEditor(canon.absences, rerender),
            ],
          }),
          sectionCard({
            title: "법칙",
            hint: "힘 · 신 · 죽음 · 돈",
            testid: "db-world-canon-laws",
            children: WORLD_CANON_LAW_KINDS.map((kind) => lawRow(kind, canon.laws[kind], rerender)),
          }),
          bodyCard,
        ],
      }),
    }),
  );
}

export function excerptHint(filled: number): string {
  const excerptLen = Math.min(600, filled);
  return filled > 600
    ? `역사·지형·문화·비밀 — 조수는 앞 600자를 본다 (뒤 ${filled - 600}자는 발췌 밖)`
    : `역사·지형·문화·비밀 — 조수는 앞 600자 중 ${excerptLen}자를 본다`;
}

function identityCard(canon: ResolvedWorldCanon): HTMLElement {
  const name = el("input", {
    class: "db-world-canon-name",
    attrs: {
      type: "text",
      placeholder: "이 세계의 이름",
      "aria-label": "세계 이름",
      maxlength: String(WORLD_CANON_BOUNDS.name),
      title: `세계 이름: ${WORLD_CANON_BOUNDS.name}자까지`,
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
      maxlength: String(WORLD_CANON_BOUNDS.premise),
      title: `한 줄 전제: ${WORLD_CANON_BOUNDS.premise}자까지`,
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
          // 톤·없는 것·법칙과 같은 이산 편집 — 되돌리기 한 장을 먼저 남긴다.
          recordProjectSnapshot("세계관 상태");
          writeCanon({ status: value });
        },
      ),
    ],
  });
}
