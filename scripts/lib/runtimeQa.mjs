// 런타임(내보내기 플레이어) 전용 QA 하네스 — 순수 로직.
// 브라우저·서버 구동은 이 모듈을 소비하는 프런트(scripts/runtime-qa.mts,
// test/e2e/runtime-smoke.spec.ts)가 담당한다. 여기에는 부수효과가 없다.
// 설계: docs/superpowers/specs/2026-08-28-runtime-vision-qa-design.md

// 기본 픽스처는 **캐릭셋 텍스처가 실제로 로드되는** 프로젝트여야 한다.
// oprn-sample-v3 는 같은 resourceId(easyrpg-charset-actor1)로도 Phaser 가 __MISSING 을
// 그린다(실측: scripts/_export-charset-fixtures.mjs — 4개 중 이 픽스처만 실패).
// 깨진 스프라이트가 기본값이면 모든 시각 검증이 오염된다.
export const DEFAULT_PROJECT_FIXTURE = "test/fixtures/projects/editor-authored-demo-v3.json";
export const DEFAULT_VIEWPORT = { width: 1024, height: 768 };
export const DEFAULT_SEED = 1;

/** 시나리오가 쓸 수 있는 op 종류. 목록 밖은 정규화 단계에서 거부한다. */
export const OP_KINDS = [
  "seed",
  "setVitals",
  "dir",
  "face",
  "action",
  "attack",
  "skill",
  "key",
  "teleport",
  "wait",
  // 조건 대기. 고정 sleep 만으로 UI 전이를 기다리면 느린 호스트에서 flaky 해지고,
  // 키를 정해진 횟수만큼 눌러 대사를 소진하려 하면 **NPC 를 재발동시켜 초과 입력**이 된다
  // (실측: 선택지 NPC 옆에서 Enter 8회 → 선택지가 다시 열림).
  "waitFor",
  "pressUntil",
];

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * 시나리오에 기본값을 채우고 구조를 검증한다.
 * 잘못된 시나리오는 조용히 통과시키지 않는다 — 게이트가 거짓말하는 것보다 즉시 죽는 게 낫다.
 */
export function normalizeScenario(scenario) {
  const beats = scenario.beats ?? [];
  if (beats.length === 0) throw new Error(`시나리오 ${scenario.id}: 비트가 하나도 없다`);

  const seen = new Set();
  const normalizedBeats = beats.map((beat) => {
    if (!KEBAB.test(beat.id)) throw new Error(`비트 ID 는 kebab-case: ${beat.id}`);
    if (seen.has(beat.id)) throw new Error(`중복된 비트 ID: ${beat.id}`);
    seen.add(beat.id);
    for (const op of beat.ops ?? []) {
      if (!OP_KINDS.includes(op.kind)) throw new Error(`알 수 없는 op: ${op.kind}`);
    }
    return { ...beat, ops: beat.ops ?? [], shot: beat.shot ?? false };
  });

  return {
    ...scenario,
    seed: scenario.seed ?? DEFAULT_SEED,
    viewport: scenario.viewport ?? DEFAULT_VIEWPORT,
    projectFixture: scenario.projectFixture ?? DEFAULT_PROJECT_FIXTURE,
    beats: normalizedBeats,
  };
}

/**
 * 이 비트의 스크린샷을 남길지.
 * 옵트인(`shot: true`)이거나 **실패했으면** 남긴다. 실패 비트에 샷이 없으면
 * 정작 비전이 필요한 순간에 볼 것이 없다(초기 구현의 실제 결함).
 */
export function shouldCaptureShot(beat, failures) {
  return Boolean(beat.shot) || failures.length > 0;
}

/** 샷 파일명. 1-based 2자리 접두사로 비트 순서를 보존한다. */
export function shotFileName(index, beatId) {
  return `${String(index + 1).padStart(2, "0")}-${beatId}.png`;
}

/**
 * 에이전트가 **먼저 읽는** 텍스트 리포트.
 * 컨텍스트 정책: 실패한 비트의 샷만 즉시 확인 대상으로 표시한다.
 */
export function renderSummary(report) {
  const failedBeats = report.beats.filter((beat) => beat.failures.length > 0);
  const mustOpen = failedBeats.filter((beat) => beat.shot);
  const totalShots = report.beats.filter((beat) => beat.shot).length;
  const passed = failedBeats.length === 0 && report.errors.length === 0;

  const lines = [
    `# 런타임 QA — ${report.scenarioId}`,
    "",
    '**이 파일을 먼저 읽어라.** PNG 는 아래 표에서 "즉시 확인" 으로 표시된 것만 열어라.',
    "전량 열람은 컨텍스트 낭비다.",
    "",
    `- 게이트: ${passed ? "통과" : "실패"} (비트 ${report.beats.length}개 중 ${failedBeats.length}개 실패)`,
    `- 열어야 할 샷: ${mustOpen.length}개 / 전체 샷 ${totalShots}개`,
    report.errors.length > 0 ? `- 런타임 에러 ${report.errors.length}건` : "- 런타임 에러: 없음",
    `- 프로젝트: ${report.projectPath}`,
    `- 시드: ${report.seed} / 뷰포트: ${report.viewport.width}×${report.viewport.height}`,
    "",
    "| 비트 | 의도 | 상태 | 샷 | 볼 이유 |",
    "|---|---|---|---|---|",
  ];

  for (const beat of report.beats) {
    const failed = beat.failures.length > 0;
    const reason = !beat.shot ? "—" : failed ? "게이트 실패 — 즉시 확인" : "시각 확인 대기";
    lines.push(
      `| ${beat.id} | ${beat.note ?? "—"} | ${failed ? "실패" : "통과"} | ${beat.shot ?? "—"} | ${reason} |`,
    );
  }

  if (failedBeats.length > 0) {
    lines.push("", "## 실패 상세", "");
    for (const beat of failedBeats) {
      lines.push(`### ${beat.id}`, ...beat.failures.map((failure) => `- ${failure}`), "");
    }
  }

  if (report.errors.length > 0) {
    lines.push("## 런타임 에러", "", ...report.errors.map((error) => `- \`${error}\``), "");
  }

  return `${lines.join("\n")}\n`;
}

/**
 * 스칼라는 동등, 객체는 **키 집합까지** 동등. JSON.stringify 비교를 안 쓰는 이유는 키 순서에
 * 의존해서다 — 사각을 `{top,left,...}` 순으로 적었을 때 조용히 실패하면 진짜 결함처럼 보인다.
 */
function sameShape(actual, wanted) {
  if (wanted === null || typeof wanted !== "object") return actual === wanted;
  if (actual === null || typeof actual !== "object") return false;
  const wantedKeys = Object.keys(wanted);
  if (wantedKeys.length !== Object.keys(actual).length) return false;
  return wantedKeys.every((key) => sameShape(actual[key], wanted[key]));
}

/**
 * 비트의 기대치를 관측값과 대조해 실패 사유를 모은다.
 * 빈 배열 = 통과. 게이트는 이 결과만 보고 판정한다.
 */
export function evaluateExpect(expected, observed) {
  const failures = [];
  const { state, testids, playerSpriteResourceId } = observed;

  // state 는 런타임 훅(__oprnDebug)이 설치되기 전(타이틀 화면 등)에는 null 이다.
  // 그때 상태 기대치를 조용히 통과시키면 게이트가 거짓말을 한다 — 명시적 실패로 만든다.
  const scalar = (key, read) => {
    if (expected[key] === undefined) return;
    if (state === null) {
      failures.push(`런타임 훅 없음 — 상태를 읽을 수 없다(${key} 확인 불가)`);
      return;
    }
    const actual = read(state);
    if (actual !== expected[key]) failures.push(`${key}: 기대 ${expected[key]}, 실제 ${actual}`);
  };
  scalar("mapId", (s) => s.currentMapId);
  scalar("x", (s) => s.x);
  scalar("y", (s) => s.y);
  scalar("gold", (s) => s.gold);
  scalar("battleResult", (s) => s.battleResult);

  // 부등 기대치 — "값이 **아니어야** 한다". 동등만으로는 대조군을 표현할 수 없다:
  // "골렘이 있으면 안 움직인다"(x 동등)는 입력이 아예 죽어도 통과하므로, 골렘 없는 대조군에서
  // "움직였다"를 단정해야 비로소 증거가 된다. 그것이 `xNot`/`yNot` 이다.
  // 기존 키(x/y/…)의 의미는 건드리지 않는다 — 다른 시나리오가 이 파일을 공유한다.
  const scalarNot = (key, read) => {
    if (expected[key] === undefined) return;
    if (state === null) {
      failures.push(`런타임 훅 없음 — 상태를 읽을 수 없다(${key} 확인 불가)`);
      return;
    }
    const actual = read(state);
    if (actual === expected[key]) failures.push(`${key}: 기대 ≠ ${expected[key]}, 실제 ${actual}`);
  };
  scalarNot("xNot", (s) => s.x);
  scalarNot("yNot", (s) => s.y);

  // 이벤트 사각 기대치 — 런타임이 **스스로 계산한** 몸/통행 사각을 그대로 단정한다.
  // 좌표 이동으로 "막혔다 / 지나갔다" 를 보는 것과는 다른 축이다: 저건 판정의 결과고, 이건
  // 판정의 입력이다. 결과만 보면 우연히 맞을 수 있다(다른 이유로 막혔거나, 사각이 틀렸는데도
  // 그 칸만 우연히 통행 가능이거나). 사각을 직접 읽으면 그 우연이 배제된다.
  //
  // 사각 하나는 네 변을 **전부** 적어야 한다. 일부만 적으면 나머지가 조용히 통과해서,
  // "top 만 단정했는데 통과했다" 가 사각 전체를 검증한 것처럼 읽힌다.
  for (const [eventId, wanted] of Object.entries(expected.eventRects ?? {})) {
    const actual = observed.events?.[eventId];
    if (!actual) {
      failures.push(`이벤트 스냅샷 없음: ${eventId} — 활성 페이지가 없거나 다른 맵이다`);
      continue;
    }
    for (const [field, want] of Object.entries(wanted)) {
      const got = actual[field];
      if (!sameShape(got, want)) {
        failures.push(`${eventId}.${field}: 기대 ${JSON.stringify(want)}, 실제 ${JSON.stringify(got)}`);
      }
    }
  }

  for (const testid of expected.testidPresent ?? []) {
    if (!testids.includes(testid)) failures.push(`testid 누락: ${testid}`);
  }
  for (const testid of expected.testidAbsent ?? []) {
    if (testids.includes(testid)) failures.push(`testid 잔존: ${testid}`);
  }

  if (expected.playerSpriteResourceNonEmpty && !playerSpriteResourceId) {
    failures.push("playerSprite: 리소스 ID 가 비어 있다(스프라이트 누락)");
  }

  // resourceId 가 채워져 있어도 Phaser 가 텍스처를 못 찾으면 __MISSING 플레이스홀더
  // (초록 와이어프레임)를 그린다. resourceId 축만으로는 이 상태가 통과해버린다 — 실측 오탐.
  if (expected.playerSpriteTextureLoaded) {
    const key = observed.playerSpriteTextureKey;
    if (!key || key === "__MISSING") {
      failures.push(
        `playerSprite: 텍스처가 로드되지 않았다(${key === "__MISSING" ? "__MISSING" : "없음"})`
          + ` — resourceId=${playerSpriteResourceId ?? "없음"}`,
      );
    }
  }
  return failures;
}
