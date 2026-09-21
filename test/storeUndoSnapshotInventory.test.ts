import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `openwiki/editor-observability.md` 의 「알려진 남은 공백」 표는 **store 를 바꾸면서 되돌리기
 * 스냅샷을 남기지 않는 파일** 명단을 손으로 적어 두고, 그 자리에 이렇게 적어 두었다 —
 * "명단을 손으로 관리하면 썩는다 — 구조 테스트로 고정하는 것이 후속 과제다."
 *
 * 실제로 썩었다. 2026-08-29 에 21개로 적힌 명단을 2026-09-14 에 다시 재면 24개이고,
 * 그 사이 다섯 개(`eventPages.ts`, `pageProps.ts`, `structureKitEditorDialog.ts`,
 * `structureKitInspector.ts`, `tilesetMetadataEditor.ts`)는 고쳐졌는데 명단에 남아 있었고,
 * 여덟 개는 새로 생겼는데 명단에 없었다. 문서를 읽은 사람은 두 방향 모두에서 틀린 지도를 받는다.
 *
 * 그래서 명단을 여기로 옮긴다. 이 테스트는 **양방향 래칫**이다.
 * - 새 파일이 스냅샷 없이 store 를 바꾸면 실패한다 → 구멍이 조용히 늘지 않는다.
 * - 명단의 파일이 고쳐졌는데 명단에서 빠지지 않으면 실패한다 → 명단이 조용히 썩지 않는다.
 *
 * **이 판정은 증명이 아니라 파일 단위 어림이다.** `openwiki` 에 적힌 재측정 명령과 같은 잣대를
 * 쓴다(파일 어딘가에 `recordProjectSnapshot`/`recordMapSnapshot` 이 있으면 통과). 한 파일 안에서
 * 어떤 함수는 스냅샷을 찍고 어떤 함수는 안 찍으면 이 테스트는 초록이다. 통과를 "되돌리기가 된다"로
 * 읽지 마라 — 읽어야 할 것은 "명단이 실측과 일치한다" 뿐이다. 호출부 단위 판정은 별도 과제다.
 */

const ROOT = process.cwd();
const SCAN_ROOT = "src";

/** openwiki 재측정 명령과 같은 잣대 — 잣대가 갈라지면 문서와 테스트가 서로 다른 명단을 만든다. */
const STORE_MUTATION = /store\.(update|updateMap|replace|replaceProject|clearAll)\(/u;
const SNAPSHOT = /recordProjectSnapshot|recordMapSnapshot/u;

/**
 * 되돌리기 스냅샷 없이 store 를 바꾸는 것이 **알려진** 파일들. 2026-09-14 실측.
 * 여기 있다고 괜찮다는 뜻이 아니다 — 그 경로로 바뀐 것은 Ctrl+Z 로 되돌아가지 않는다(감사 로그에는 남는다).
 * 고쳤으면 줄을 지워라. 지우지 않으면 이 테스트가 실패해서 알려 준다.
 */
const KNOWN_WITHOUT_SNAPSHOT: readonly string[] = [
  "src/editor/eventActions.ts",
  "src/editor/harnessSuggestion/structureKitActions.ts",
  "src/editor/mapParentLink.ts",
  "src/editor/mapPlanningActions.ts",
  "src/editor/mapShiftActions.ts",
  "src/editor/panels/aiAssistantPanel.ts",
  "src/editor/panels/aiImageGenerateField.ts",
  "src/editor/panels/databaseModalDirtySession.ts",
  "src/editor/panels/eventEditor/fieldMonsterTemplateDialog.ts",
  "src/editor/panels/eventEditor/npcGraphicPicker.ts",
  "src/editor/panels/eventEditor/pageNpcLiving.ts",
  "src/editor/panels/mapProps.ts",
  "src/editor/panels/menu.ts",
  "src/editor/panels/regionTaskModal.ts",
  "src/editor/panels/resourceManager.ts",
  "src/editor/panels/scratchConceptTab.ts",
  "src/editor/panels/structureKitDbTab.ts",
  "src/editor/panels/tilesetSpacesTab.ts",
  "src/editor/panels/tilesetTileContextMenu.ts",
  "src/editor/panels/villageInfoModal.ts",
  "src/editor/tileActions.ts",
  "src/player/runtimeDebugPanel.ts",
  "src/project/characterIdIndex.ts",
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!entry.isFile()) return [];
    if (entry.name.endsWith(".d.ts")) return [];
    return /\.(ts|tsx|mts)$/u.test(entry.name) ? [path] : [];
  });
}

/** 실측: store 를 바꾸면서 스냅샷을 남기지 않는 파일. 경로 구분자는 OS 와 무관하게 `/`. */
function measureWithoutSnapshot(): string[] {
  const found: string[] = [];
  for (const path of sourceFiles(join(ROOT, SCAN_ROOT))) {
    const source = readFileSync(path, "utf8");
    if (!STORE_MUTATION.test(source)) continue;
    if (SNAPSHOT.test(source)) continue;
    found.push(relative(ROOT, path).split(sep).join("/"));
  }
  return found.sort();
}

describe("되돌리기 스냅샷 없이 store 를 바꾸는 파일 명단", () => {
  const measured = measureWithoutSnapshot();
  const known = new Set(KNOWN_WITHOUT_SNAPSHOT);

  it("새로 생기지 않는다 — 스냅샷 없는 store 변경 경로를 더 늘리지 않는다", () => {
    const added = measured.filter(path => !known.has(path));
    expect(
      added,
      added.length === 0
        ? ""
        : `이 파일들이 store 를 바꾸면서 되돌리기 스냅샷을 남기지 않는다:\n` +
          `${added.map(path => `  - ${path}`).join("\n")}\n` +
          `바꾸기 직전에 recordProjectSnapshot()(맵 타일이면 recordMapSnapshot())을 부르거나,\n` +
          `되돌릴 수 없는 것이 의도라면 사유와 함께 이 파일의 KNOWN_WITHOUT_SNAPSHOT 에 추가하라.`,
    ).toEqual([]);
  });

  it("고친 것은 명단에서 빠진다 — 명단이 썩지 않는다", () => {
    const measuredSet = new Set(measured);
    const stale = KNOWN_WITHOUT_SNAPSHOT.filter(path => !measuredSet.has(path));
    expect(
      stale,
      stale.length === 0
        ? ""
        : `이 파일들은 더 이상 명단에 해당하지 않는다(고쳐졌거나 옮겨졌거나 지워졌다):\n` +
          `${stale.map(path => `  - ${path}`).join("\n")}\n` +
          `이 파일의 KNOWN_WITHOUT_SNAPSHOT 에서 지워라.`,
    ).toEqual([]);
  });

  it("명단은 정렬돼 있고 중복이 없다 — 두 사람이 같은 줄을 두 번 넣지 않는다", () => {
    expect(KNOWN_WITHOUT_SNAPSHOT).toEqual([...new Set(KNOWN_WITHOUT_SNAPSHOT)].sort());
  });

  it("잣대가 실제로 무언가를 잡는다 — 정규식이 빗나가 공허하게 통과하지 않는다", () => {
    // 명단이 언젠가 0이 되는 날은 와도 좋지만, 그건 store 를 바꾸는 파일 자체가
    // 사라져서가 아니어야 한다. 잣대가 고장 나면 두 단언 모두 빈 배열로 통과한다.
    const mutating = sourceFiles(join(ROOT, SCAN_ROOT)).filter(path =>
      STORE_MUTATION.test(readFileSync(path, "utf8")),
    );
    expect(mutating.length).toBeGreaterThan(30);
  });
});
