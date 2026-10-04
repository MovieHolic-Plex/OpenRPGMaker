/** `src/harnesses/INDEX.md` 생성 — 손으로 쓰지 않는다. `npm run harness -- list` 가 다시 쓴다. */
import type { HarnessManifest } from "./manifest";

function yesNo(value: boolean): string {
  return value ? "있음" : "아직 없음";
}

export function renderHarnessIndex(harnesses: readonly HarnessManifest[]): string {
  const lines: string[] = [
    "# 하네스 목록",
    "",
    "> 생성 파일. 손으로 고치지 말고 `npm run harness -- list` 로 다시 만든다.",
    "> 각 하네스의 정의는 `src/harnesses/<id>/harness.ts`, 구조 규칙은 `openwiki/harnesses/README.md`.",
    "",
    "| id | 무엇 | 범위 | 시드 | 문서 |",
    "|---|---|---|---|---|",
  ];
  for (const harness of harnesses) {
    const scope = harness.scope.genre ? `장르 \`${harness.scope.genre}\` 전용` : "장르 무관";
    lines.push(`| \`${harness.id}\` | ${harness.title} | ${scope} | \`${harness.seed}\` | \`${harness.doc}\` |`);
  }
  for (const harness of harnesses) {
    lines.push("", `## ${harness.id} — ${harness.title}`, "", harness.summary, "", "**이럴 때 쓴다:**");
    for (const trigger of harness.triggers) lines.push(`- ${trigger}`);
    lines.push("", "**단계** (`npm run harness -- " + harness.id + " <단계>`):");
    for (const stage of harness.stages) lines.push(`- \`${stage.id}\` — ${stage.title}: ${stage.summary}`);
    lines.push(
      "",
      `**들어오는 길:** CLI ${yesNo(harness.entrypoints.cli)} · 에디터 화면 ${yesNo(harness.entrypoints.editorUi)} · 조수 도구 ${yesNo(harness.entrypoints.assistantTool)}`,
    );
  }
  return lines.join("\n") + "\n";
}
