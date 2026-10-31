// 조수에게 TypeScript 이벤트 스크립트(openwiki/script-sandbox.md)를 보일지 — 기본은 켬.
// OPRN_V2_SCRIPTS=0 이면 조수가 보는 스크립트 도구 10개·스킬 event-scripts·지시 줄을 모두 뺀다(스크립트 이전의 조수와 같은 글).
// 시험 묶음의 A/B(스크립트 켬/끔)에서만 끈다 — 제품 설정 칸이 아니다. 게임 런타임·편집기의 script 명령은 그대로 돈다.
// 조수 루프(Bun 워커)는 호스트 프로세스의 env 를 읽는다(OPRN_V2_MAKE_GAME 과 같은 꼴). 브라우저에는 env 가 없어 늘 켬이다.

/** 스크립트 도구 이름(src/editor/tools/scriptTools.ts SCRIPT_TOOLS + scriptUnwrapTool.ts). */
export const SCRIPT_TOOL_NAMES: ReadonlySet<string> = new Set([
  "get_script_api", "check_script", "author_script", "edit_script", "dry_run_script",
  "read_event_as_script", "write_event_as_script", "write_script_as_commands", "upsert_script_module", "list_script_modules",
]);
export const SCRIPT_SKILL_ID = "event-scripts";

export function assistantScriptsOn(): boolean {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.OPRN_V2_SCRIPTS !== "0";
}
