#!/usr/bin/env node
// scripts/audit-gate-mutations.mjs
//
// 표면 게이트의 **실효성 감사**. 프로덕션 소스에 실제 결함을 심고, 게이트가 그것을
// 끝에서 끝까지(렌더 → 수확 → diff → 실패) 잡는지, 그리고 **잃은 것을 이름으로 지목하는지**
// 확인한다.
//
// ── 왜 exit code 만으로는 부족한가 ─────────────────────────────────────────────
// 변이를 심으면 게이트가 빨개지는 건 쉽다. 렌더가 그냥 크래시해도 빨개진다. 그런 "빨강"은
// 리팩터 중에 아무 도움이 안 된다 — 무엇을 잃었는지 모르면 사람은 기준선을 갱신해서 넘긴다.
// 그래서 변이마다 `signal` 정규식을 요구한다: 게이트 출력에 그 패턴이 있어야 `caught` 다.
// exit≠0 이지만 signal 이 없으면 `crashedButSilent` 로 따로 보고한다 — 그건 게이트의 결함이다.
//
// ── 절대 CI 에서 돌리지 않는다 ────────────────────────────────────────────────
// 이 스크립트는 `src/` 를 **쓴다**. finally 에서 원복하지만, 프로세스가 SIGKILL 되면 더러운
// 트리가 남는다. 그래서:
//   1) CI 에서는 즉시 거부한다.
//   2) 시작 시 `src/` 가 깨끗하지 않으면 거부한다 — 남의 편집을 내 원복이 덮어쓰면 안 되고,
//      변이의 효과와 남의 편집을 구분할 수도 없다.
//   3) 병렬 워크트리에서 다른 세션이 vitest 를 돌리는 중이면 그쪽이 변이된 src 를 읽는다.
//      혼자일 때만 돌려라(워크트리는 세션 간 공유다).
//
// 사용:
//   node scripts/audit-gate-mutations.mjs                 # 전부
//   node scripts/audit-gate-mutations.mjs --list           # 목록만
//   node scripts/audit-gate-mutations.mjs commit-배선-삭제  # 이름으로 골라서
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const VITEST = (file) => [
  "node",
  ["scripts/run-vitest.mjs", "run", "--configLoader", "bundle", `test/${file}`],
];

/** 게이트 정의. 이름 → spawnSync 인자. */
const GATES = {
  form: VITEST("eventEditorFormSurface.baseline.test.ts"),
  m2: VITEST("eventEditorM2Surface.baseline.test.ts"),
  shell: VITEST("eventEditorShellSurface.baseline.test.ts"),
  commit: VITEST("eventEditorCommitProbe.baseline.test.ts"),
  condition: VITEST("eventEditorConditionSurface.baseline.test.ts"),
  portal: VITEST("eventEditorPortalSurface.baseline.test.ts"),
  interaction: VITEST("eventEditorInteractionSurface.baseline.test.ts"),
  staged: VITEST("eventEditorStagedState.test.ts"),
  cssLive: ["node", ["scripts/check-css-live-classes.mjs"]],
};

/**
 * 변이 목록.
 *  - `expect`: 반드시 실패해야 하는 게이트들.
 *  - `signal`: 그 게이트 출력에서 찾아야 하는 패턴(잃은 것을 이름으로 지목했는가).
 *  - `hole`: 이 변이가 대변하는 실측된 구멍.
 */
const MUTATIONS = [
  {
    name: "commit-배선-삭제",
    hole: "구멍 1 — 컨트롤은 남고 배선만 죽는다 (표면 스냅샷으로는 안 보인다)",
    file: "src/editor/panels/eventEditor/commandBodyCore.ts",
    from: `  autoAdvance.addEventListener("change", apply);`,
    to: `  // MUTATION: 배선 제거`,
    expect: ["commit"],
    signal: /event-command-text-auto-advance/,
  },
  {
    name: "choices-분기-소실",
    hole: "구멍 2 — 선택지 안의 명령이 통째로 날아간다 (사용자 데이터 파괴)",
    file: "src/editor/panels/eventEditor/commandBodyChoices.ts",
    // 처음에는 `normalizeOptions` 의 `branch: option.branch ?? []` 를 골랐는데 그건
    // **무해한 줄**이었다(실측: 게이트 exit 0). 그 결과는 렌더용 지역 변수로만 쓰이고,
    // 커밋 경로는 전부 `latest.options` / `readOptionsFromDom` 을 통한다. 즉 게이트가 아니라
    // 변이 명세가 틀렸다. 분기를 실제로 보존하는 유일한 줄은 아래 `readOptionsFromDom` 안이며,
    // 선택지 텍스트를 한 글자 고치는 순간 분기가 날아간다.
    from: `    branch: cmd.options[index]?.branch ?? [],`,
    to: `    branch: [], // MUTATION: 분기 소실`,
    expect: ["commit"],
    signal: /분기|branch/,
  },
  {
    name: "showPicture-xy-뒤바꿈",
    hole: "구멍 3 — 값이 엉뚱한 필드로 저장된다 (컨트롤 수·클래스는 그대로다)",
    file: "src/editor/panels/eventEditor/commandBodyPage3Native.ts",
    // 같은 x/y 쌍이 changeTile 에도 있으므로 kind 줄까지 포함해 유일하게 만든다.
    from: `      kind: "showPicture",\n      pictureId: pictureId.value.trim() || "pic1",\n      resourceId: resourceId.value.trim(),\n      x: parseInt(x.value, 10) || 0,\n      y: parseInt(y.value, 10) || 0,`,
    to: `      kind: "showPicture",\n      pictureId: pictureId.value.trim() || "pic1",\n      resourceId: resourceId.value.trim(),\n      x: parseInt(y.value, 10) || 0, // MUTATION: x↔y\n      y: parseInt(x.value, 10) || 0,`,
    expect: ["commit"],
    signal: /showPicture/,
  },
  {
    name: "syncVisibility-초기호출-누락",
    hole: "구멍 4 — hidden/disabled 상태를 아무도 안 본다",
    file: "src/editor/panels/eventEditor/commandBodyVariable.ts",
    // 같은 한 줄이 핸들러 안에도 있으므로 앞 줄까지 포함해 초기 호출만 지운다.
    from: `  const initialOperand: VariableOperand = typeof cmd.value === "number" ? cmd.value : { kind: "var", id: currentOperandVariableId };\n  syncVisibility();`,
    to: `  const initialOperand: VariableOperand = typeof cmd.value === "number" ? cmd.value : { kind: "var", id: currentOperandVariableId };\n  // MUTATION: 초기 표시 동기화 누락`,
    expect: ["form"],
    signal: /hidden|nodisplay|disabled/,
  },
  {
    name: "details-div-후처리-무력화",
    hole: "구멍 5 — ::details-content 회피 후처리가 조용히 죽는다 (셸 하한선이 비지 않았음을 증명)",
    file: "src/editor/panels/eventEditor/content.ts",
    from: `  settingsColumn.querySelectorAll("details").forEach((node) => {`,
    to: `  settingsColumn.querySelectorAll("details.mutation-no-match").forEach((node) => {`,
    expect: ["shell"],
    signal: /detailsConverted|details/,
  },
  {
    name: "포털-is-favorite-소실",
    hole: "구멍 6 — 특정 상태에서만 붙는 클래스가 사라진다 (기본 상태 렌더로는 안 보인다)",
    file: "src/editor/panels/eventEditor/commandPicker.ts",
    from: "    class: `event-command-picker-favorite${favorite ? \" is-favorite\" : \"\"}`,",
    to: "    class: `event-command-picker-favorite`, // MUTATION: is-favorite 소실",
    // 포털 축이 즐겨찾기 상태를 실제로 열기 때문에 잡는다.
    // css-live 는 기대에 넣지 않는다: 그 축은 **축 기준선 JSON** 을 정본으로 읽으므로
    // src 변이는 기준선을 갱신하기 전까지 보이지 않는다(하류 축). 처음 명세에 넣었다가
    // 실측으로 걷어냈다 — 검출 불가한 것을 기대에 넣으면 감사 자체가 거짓 빨강을 만든다.
    expect: ["portal"],
    signal: /is-favorite/,
  },
  {
    name: "미리보기-재렌더-누락",
    hole: "구멍 7 — 커밋은 되는데 화면이 안 따라온다 (커밋 프로브로는 안 보인다)",
    file: "src/editor/panels/eventEditor/commandBodyRoute.ts",
    // 앞의 여섯 변이가 전부 commit/form/shell/portal 축만 건드려서 **상호작용 축은 변이로
    // 증명된 적이 없었다.** 이 구멍은 실제 결함에서 왔다: `wait` 체크박스가 `apply` 만 걸려
    // 있어 커밋은 정상인데 미리보기 배지 «완료까지 대기» 가 다른 조작 전까지 안 나타났다.
    // 커밋 스냅샷은 그대로라 커밋 프로브는 초록이다 — 조작 후 재렌더를 보는 축만 잡는다.
    from: `      apply();\n      renderPreview();`,
    to: `      apply(); // MUTATION: renderPreview() 누락`,
    expect: ["interaction"],
    signal: /move-route-(wait|skippable)-checkbox|반응/,
  },
];

function run([cmd, args]) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, VITE_CACHE_DIR: ".vite-cache/mutation" },
  });
  return { code: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

/**
 * 게이트 출력에서 **실패 맥락 라인만** 남긴다.
 *
 * 왜 필요한가 (실측): `named` 를 출력 전체에 정규식으로 걸었더니 `choices-분기-소실` 변이가
 * 초록 테스트 이름 `✓ 분기 보존 하드 계약 > …` 때문에 "이름을 댔다"로 판정됐다. 그 변이의
 * 실제 실패 메시지에는 분기라는 말이 없었을 수도 있는데 감사는 성공이라고 보고한 것이다.
 * 이 감사 자체가 자기 확인을 하면 아래 게이트 전부의 신뢰도가 같이 무너진다.
 *
 * ANSI 를 지우고, 통과 표식(`✓`)으로 시작하는 라인과 건너뜀 표식(`·`)을 버린다.
 * 실패 라인(`×`), 메시지(`→`), `AssertionError`, diff 라인은 전부 남는다.
 *
 * 시각·소요시간도 여기서 지운다. 이 보고서는 **커밋되는 증거**인데 매 실행마다 `Start at` 과
 * `22ms → 17ms` 만 바뀌면 diff 가 통째로 잡음이 되고, 사람은 그걸 `git checkout` 으로 버리는
 * 습관을 들인다. 그렇게 증거가 낡은 채 리뷰를 통과한다. 판정이 실제로 바뀌지 않으면 파일도
 * 바뀌지 않아야 한다.
 * (마스킹을 진단 꼬리에만 걸었더니 `evidence` 쪽에 소요시간이 남아 두 실행의 보고서가
 *  여전히 달랐다 — 실측. 그래서 두 필드가 공유하는 이 단계로 올렸다.)
 */
function failureLines(out) {
  return out
    .split("\n")
    .map((line) => line.replace(/\[[0-9;]*m/g, "").trim())
    .map((line) => line.replace(/\s+\d+(\.\d+)?m?s\b/g, ""))
    .filter(
      (line) =>
        line &&
        !line.startsWith("✓") &&
        !line.startsWith("·") &&
        !/^(Start at|Duration)\b/.test(line)
    );
}

/**
 * 첫 실패 표식(`×` / `AssertionError` / `FAIL`)부터 실패 라인 12줄. 사람이 읽을 진단 꼬리.
 * 잡음 제거는 `failureLines` 가 이미 했다.
 */
function diagnosticTail(lines) {
  const start = lines.findIndex((line) => /^(×|AssertionError|FAIL\b)/.test(line));
  if (start < 0) return [];
  return lines.slice(start, start + 12).map((line) => line.slice(0, 200));
}

function fail(message) {
  console.error(message);
  process.exit(2);
}

// ── 안전 가드 ────────────────────────────────────────────────────────────────
if (process.env.CI) {
  fail("이 스크립트는 src/ 를 변형한다 — CI 에서 돌리지 않는다.");
}
const argv = process.argv.slice(2);
if (argv.includes("--list")) {
  for (const m of MUTATIONS) console.log(`${m.name}\n  ${m.hole}\n  기대 실패: ${m.expect.join(", ")}`);
  process.exit(0);
}
const dirty = spawnSync("git", ["status", "--porcelain", "src/"], { cwd: ROOT, encoding: "utf8" });
if ((dirty.stdout ?? "").trim()) {
  fail(
    `src/ 가 깨끗하지 않다 — 원복이 남의 편집을 덮어쓸 수 있고, 변이 효과와 구분도 안 된다:\n${dirty.stdout}`
  );
}

// ── 실행 ─────────────────────────────────────────────────────────────────────
const only = argv.filter((a) => !a.startsWith("--"));
const results = [];

for (const m of MUTATIONS) {
  if (only.length && !only.includes(m.name)) continue;
  const path = join(ROOT, m.file);
  const original = readFileSync(path, "utf8");
  const occurrences = original.split(m.from).length - 1;
  if (occurrences !== 1) {
    results.push({
      name: m.name,
      hole: m.hole,
      applied: false,
      note: `앵커가 ${occurrences}번 등장 — 변이를 적용하지 않았다(소스가 바뀌었다: 앵커를 고쳐라)`,
    });
    console.log(`· ${m.name}: 앵커 ${occurrences}회 — 건너뜀`);
    continue;
  }
  const verdicts = {};
  try {
    writeFileSync(path, original.replace(m.from, m.to));
    for (const gate of m.expect) {
      const r = run(GATES[gate]);
      const lines = failureLines(r.out);
      const named = lines.some((line) => m.signal.test(line));
      verdicts[gate] = {
        exitCode: r.code,
        red: r.code !== 0,
        named,
        caught: r.code !== 0 && named,
        crashedButSilent: r.code !== 0 && !named,
        // 통과 라인을 제외한 뒤 남은 증거만 싣는다. 여기에 초록 라인이 섞이면
        // "게이트가 이름을 댔다"는 판정 자체가 거짓이 된다.
        evidence: lines
          .filter((line) => m.signal.test(line))
          .slice(0, 4)
          .map((line) => line.slice(0, 200)),
        // 진단 꼬리: 첫 실패 표식부터 이어지는 실패 라인 몇 줄. `evidence` 는 정규식에 걸린
        // 한 줄뿐이라 "무엇이 어떻게 틀렸는지"는 사람이 다시 변이를 돌려야 볼 수 있었다.
        detail: diagnosticTail(lines),
      };
    }
  } finally {
    writeFileSync(path, original);
    if (readFileSync(path, "utf8") !== original) {
      console.error(`!!! 원복 실패: ${m.file} — 즉시 git checkout 하라`);
      process.exit(3);
    }
  }
  const allCaught = Object.values(verdicts).every((v) => v.caught);
  console.log(
    `${allCaught ? "✓" : "✗"} ${m.name} — ${Object.entries(verdicts)
      .map(([g, v]) => `${g}:${v.caught ? "잡음" : v.crashedButSilent ? "빨갛지만 무언" : "통과(구멍)"}`)
      .join(" ")}`
  );
  results.push({ name: m.name, hole: m.hole, applied: true, verdicts, caught: allCaught });
}

const applied = results.filter((r) => r.applied);
const caught = applied.filter((r) => r.caught);
const silent = applied.filter((r) =>
  Object.values(r.verdicts).some((v) => v.crashedButSilent)
);
const missed = applied.filter((r) => Object.values(r.verdicts).some((v) => !v.red));

console.log("");
console.log(`변이 ${results.length}건 중 적용 ${applied.length}건 — 지목까지 성공 ${caught.length}건`);
if (silent.length) console.log(`빨갛지만 무엇을 잃었는지 안 말한 변이 ${silent.length}건: ${silent.map((r) => r.name).join(", ")}`);
if (missed.length) console.log(`통과해버린 변이(진짜 구멍) ${missed.length}건: ${missed.map((r) => r.name).join(", ")}`);

const reportPath = join(ROOT, ".omo/evidence/event-editor-guard/gate-mutation-audit.json");
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(
  reportPath,
  `${JSON.stringify({ total: results.length, applied: applied.length, caught: caught.length, results }, null, 1)}\n`
);
console.log("보고서: .omo/evidence/event-editor-guard/gate-mutation-audit.json");

process.exit(missed.length || silent.length || applied.length !== results.length ? 1 : 0);
