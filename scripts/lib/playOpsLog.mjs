// 세션 로그(actions.jsonl) 한 토막을 **같은 규칙**으로 자른다.
//
// 왜 공용인가: repro.mjs 는 "이 토막이 지금도 재현되는가"를 답하고 to-scenario.mjs 는 같은 토막을
// 회귀 시나리오로 굽는다. 두 도구가 서로 다른 줄을 고르면 재현한 증상과 시나리오가 검증하는 것이
// 달라진다(앵커가 하나 어긋나면 완전히 다른 판을 재생한다).
//
// 입력은 셋 다 받는다: JSON 배열 · `{ops:[…]}` · actions.jsonl(한 줄에 한 항목, op 필드 사용).
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/** `"A-B"` · `"A"` → {from, to} (1-based, to 포함). */
export function parseLineRange(spec) {
  if (spec === undefined || spec === null) return null;
  const [from, to] = String(spec).split("-").map(Number);
  if (!Number.isInteger(from) || from < 1) throw new Error(`--lines 는 A-B 형식: ${spec}`);
  return { from, to: Number.isInteger(to) ? to : from };
}

/** 페이지를 새로 띄우는 op — 이 경계를 넘어 세이브를 고르면 다른 실행이 된다. */
const RELOAD_KINDS = new Set(["reload"]);

/**
 * 로그를 읽어 `{ ops, anchor, rows }` 를 준다.
 * - ops: 잘라낸 op 배열(로그에서 온 것은 `line` 을 들고 있다 — 1-based 원본 줄 번호).
 * - anchor: `{ line, save, at, checkpoint }` 또는 null. `checkpoint` 는 그 순간의 실제 저장이다.
 * - rows: 로그 원본 행(JSON 파일 입력이면 null).
 */
export async function loadOpsSlice(file, { lines, anchor: useAnchor = true } = {}) {
  const text = await readFile(file, "utf8");
  const range = parseLineRange(lines);
  let ops;
  let rows = null;
  if (file.endsWith(".jsonl") || text.trimStart().startsWith("{")) {
    rows = text.split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line));
    ops = rows.map((row, index) => (row?.op && row.t
      ? { ...row.op, recordedAt: Date.parse(row.t), line: index + 1 }
      : { ...(row?.op ?? row), line: index + 1 }));
  } else {
    const parsed = JSON.parse(text);
    ops = Array.isArray(parsed) ? parsed : parsed.ops;
  }
  if (!Array.isArray(ops)) throw new Error(`${file}: op 배열을 찾지 못했다`);

  let anchor = null;
  if (range) {
    const start = range.from - 1;
    // 자유 플레이 로그 깊은 곳의 토막은 그 앞을 전부 재생해 도달할 수 없다 — 돌아다니는 NPC·실시간
    // 연출 때문에 위치가 어긋난다. qp 가 state·shot 마다 남긴 세이브(`save`)로 **바로 부팅**하고
    // 토막만 재생한다. repro 는 이 앵커를 __OPENRPG_BOOT__.qaCheckpoint 로 넣는다(체크포인트 세트와 같은 길).
    if (useAnchor && rows && start > 0) {
      for (let index = start - 1; index >= 0; index -= 1) {
        const row = rows[index];
        // 리로드 경계를 넘으면 앵커가 성립하지 않는다: 리로드 뒤의 op 들은 **타이틀에서 시작한 판**을
        // 전제한다(실측: 시타마치 F1 — 토막 첫 op 인 Enter 가 필드 위에서는 아무 일도 하지 않는다).
        // 그래서 경계를 만나면 더 뒤로 가지 않고 앵커 없이 토막을 처음부터 재생한다.
        if (RELOAD_KINDS.has(row?.op?.kind)) break;
        if (row?.save) {
          const snapshot = JSON.parse(await readFile(join(dirname(file), row.save), "utf8"));
          anchor = {
            line: index + 1,
            save: row.save,
            at: row.at ?? null,
            checkpoint: { id: `anchor-line-${index + 1}`, snapshot },
          };
          break;
        }
      }
    }
    ops = ops.slice(anchor ? start : 0, range.to);
  }
  return {
    ops: ops.filter((op) => op && typeof op === "object" && typeof op.kind === "string"),
    anchor,
    rows,
  };
}
