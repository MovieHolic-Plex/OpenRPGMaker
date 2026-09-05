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
  // 방향을 정해진 시간 동안 **밀고 있는다.** 금지된 고정 `wait` 와 다른 것이다: 여기서는
  // 경과 시간이 곧 자극이고, 기다릴 조건이 존재하지 않는다("막혀서 아무 일도 안 일어난다"를
  // 조건으로 표현할 수 없다). 이동이 성공하는 쪽은 waitForPosition 으로 조건 대기해야 한다.
  "hold",
  "face",
  "action",
  "attack",
  "skill",
  "key",
  "teleport",
  "waitForRuntime",
  "waitForEmote",
  "waitForPosition",
  // 조건 대기. 고정 sleep 만으로 UI 전이를 기다리면 느린 호스트에서 flaky 해지고,
  // 키를 정해진 횟수만큼 눌러 대사를 소진하려 하면 **NPC 를 재발동시켜 초과 입력**이 된다
  // (실측: 선택지 NPC 옆에서 Enter 8회 → 선택지가 다시 열림).
  "waitFor",
  // 마운트가 아니라 "실제로 보인다"를 기다린다. 페이드로 들어오는 창(상점 180ms)은
  // present 직후 조상 opacity 가 0 이라 visibleText 축이 alpha 0 으로 실패한다.
  "waitForVisible",
  // 속성값 대기. 전투 씬은 인트로·연출 중 `data-battle-sequence-busy="true"` 로 입력을 버린다 —
  // 그 사이에 누른 방향키는 조용히 사라져 다음 결정키가 엉뚱한 명령을 확정한다(실측: ↓ 가
  // 버려지고 z 가 공격을 확정). testid 존재만으로는 이 상태를 표현할 수 없어 속성 축을 둔다.
  "waitForAttr",
  "pressUntil",
  // 체공(jump/dropIn). 이동 경로를 주인공에게 직접 물리고 리프트를 조건으로 기다린다 —
  // Phaser 의 displayOrigin 계약은 jsdom 으로 재현되지 않아 브라우저에서만 증명된다.
  "playerRoute",
  "waitForLift",
  "waitForGrounded",
  "captureShadowSample",
];

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// 그림자 깊이 띠. characterDepth.ts 의 MAP_LOWER_LAYER_DEPTH(0) 와
// PRIORITY_DEPTH_BASE.below(100_000) 사이가 비어 있어 그림자가 그 안에 산다.
const SHADOW_DEPTH_FLOOR = 0;
const SHADOW_DEPTH_CEILING = 100_000;

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
      // 고정 sleep 은 금지다. 이동 성공은 waitForPosition, UI 전이는 waitFor 로 조건 대기하고,
      // 시간 자체가 자극인 경우(막힘 검증)는 이름이 붙은 `hold` 를 쓴다.
      if (op.kind === "wait") throw new Error(`고정 wait op 은 런타임 게이트에서 금지됨: ${beat.id}`);
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
    "- 시각 검토: 별도 판정 필요 — 실행 비트 통과는 공간 구성·물체 식별·게임 경험의 합격을 뜻하지 않습니다.",
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
 * 적 배치 기하 판정.
 *
 * 근거는 관측값이 아니라 **저작 의도**다:
 *  - `.battle-backdrop` 의 그라디언트가 필드 높이 33% 에 지평선을 둔다
 *    (`01-scene-base.css`: `#a7d6f3 32%` → `--oprn-battle-backdrop-mid 33%`).
 *    따라서 적의 발(이미지 bottom)은 지평선 **아래**, 즉 필드 상단에서 33% 넘는 곳에
 *    닿아야 땅에 서 있는 것으로 보인다.
 *  - 스프라이트는 필드 박스를 벗어나면 잘린다(`.battle-field { overflow: hidden }`).
 *    상단 잘림은 "몬스터가 너무 위에 달려 있다"의 직접 증상이다.
 * 임계값을 관측값에서 역산하지 않기 위해 두 축(필드 포함 · 지평선 아래) 모두
 * CSS 상수에서 끌어온다.
 */
export const BATTLE_HORIZON_RATIO = 0.33;

/** 접지 띠: 발(이미지 bottom)이 필드 **하위 40%** 안에 닿아야 땅에 선 것으로 본다.
 *  지평선(33%) 축만으로는 "발이 지평선 바로 아래"인 상태가 통과하는데, 그건 여전히
 *  필드 하단 절반이 텅 빈 채 몬스터가 중상단에 달려 있는 그림이다(실측: chrono 발 37%,
 *  mv 46%, vxace 57% — 전부 지평선 축 통과). 그래서 띠 축을 따로 둔다. */
export const BATTLE_GROUND_BAND_RATIO = 0.6;

export function evaluateBattlerGeometry(spec, battlers) {
  const failures = [];
  if (!battlers) {
    failures.push("battlerGeometry: 전투 화면(battle-scene/battle-field)이 없다 — 기하를 읽을 수 없다");
    return failures;
  }
  const { field, enemies } = battlers;
  const minEnemies = spec.minEnemies ?? 1;
  if (enemies.length < minEnemies) {
    failures.push(`battlerGeometry: 적 노드 ${enemies.length}개 — 최소 ${minEnemies}개 기대`);
  }
  const horizon = field.top + field.height * (spec.horizonRatio ?? BATTLE_HORIZON_RATIO);
  const groundBand = field.top + field.height * (spec.groundBandRatio ?? BATTLE_GROUND_BAND_RATIO);
  for (const enemy of enemies) {
    const label = enemy.id ?? "(id 없음)";
    const rect = enemy.image;
    if (!rect) {
      failures.push(`battlerGeometry[${label}]: .battle-enemy-image 노드가 없다`);
      continue;
    }
    if (rect.height <= 0 || rect.width <= 0) {
      failures.push(`battlerGeometry[${label}]: 스프라이트 크기가 0 (${rect.width}×${rect.height})`);
      continue;
    }
    if (rect.top < field.top) {
      failures.push(
        `battlerGeometry[${label}]: 필드 상단 밖으로 ${Math.round(field.top - rect.top)}px 잘렸다`
          + ` (image.top=${rect.top} < field.top=${field.top})`,
      );
    }
    if (rect.bottom > field.bottom) {
      failures.push(
        `battlerGeometry[${label}]: 필드 하단 밖으로 ${Math.round(rect.bottom - field.bottom)}px 잘렸다`
          + ` (image.bottom=${rect.bottom} > field.bottom=${field.bottom})`,
      );
    }
    // 라벨 축(하단): 노드는 스프라이트 **아래**에 이름표+HP/MP/ATB 를 쌓는다. 발을 접지 띠까지
    // 내리면 이 라벨 스택이 필드 밖으로 밀려 이름·수치가 잘린다(실측: rm2000 앞줄 node.bottom=464
    // vs field.bottom=444 → 20px 잘림). 이미지 축만으로는 통과하므로 노드 상자를 따로 본다.
    if (enemy.node && enemy.node.bottom > field.bottom) {
      failures.push(
        `battlerGeometry[${label}]: 이름표/게이지가 필드 하단 밖으로 ${Math.round(enemy.node.bottom - field.bottom)}px 잘렸다`
          + ` (node.bottom=${enemy.node.bottom} > field.bottom=${field.bottom})`,
      );
    }
    if (rect.bottom < horizon) {
      failures.push(
        `battlerGeometry[${label}]: 발이 지평선 위에 떠 있다`
          + ` (image.bottom=${rect.bottom} < 지평선=${Math.round(horizon)}`
          + `, field=${field.top}..${field.bottom})`,
      );
    } else if (rect.bottom < groundBand) {
      failures.push(
        `battlerGeometry[${label}]: 발이 접지 띠 위에 떠 있다`
          + ` (image.bottom=${rect.bottom} < 하위 40% 시작=${Math.round(groundBand)}`
          + `, field=${field.top}..${field.bottom})`,
      );
    }
  }
  // 겹침 축: 여러 마리가 **같은 점**에 쌓이면 화면에는 한 마리로 보인다. 담기·지평선 축만으로는
  // 통과하므로(실측: rm2000/dragonquest/mv 가 3마리 트룹을 완전히 같은 rect 에 겹쳐 그리면서
  // 게이트를 통과했다) 중심 간 거리를 따로 본다. 기준은 더 작은 스프라이트 상자의 25%.
  const minCenterGap = spec.minCenterGap ?? 0.25;
  const centerX = (rect) => (rect.left + rect.right) / 2;
  const centerY = (rect) => (rect.top + rect.bottom) / 2;
  for (let a = 0; a < enemies.length; a += 1) {
    for (let b = a + 1; b < enemies.length; b += 1) {
      const first = enemies[a]?.image;
      const second = enemies[b]?.image;
      if (!first || !second) continue;
      const gapX = Math.abs(centerX(first) - centerX(second));
      const gapY = Math.abs(centerY(first) - centerY(second));
      const needX = Math.min(first.width, second.width) * minCenterGap;
      const needY = Math.min(first.height, second.height) * minCenterGap;
      if (gapX >= needX || gapY >= needY) continue;
      failures.push(
        `battlerGeometry[${enemies[a].id ?? a}/${enemies[b].id ?? b}]: 두 적이 같은 자리에 겹쳐 있다`
          + ` (중심 거리 ${Math.round(gapX)}×${Math.round(gapY)}px, 최소 ${Math.round(needX)}×${Math.round(needY)}px)`,
      );
    }
  }
  // 아군 겹침 축: 적을 접지 띠까지 내리면 **아군 진형의 세로 띠**로 내려온다. 그러면 사이드뷰
  // 스킨에서 적 스프라이트·이름표가 아군 스프라이트와 포개져 양쪽 다 안 읽힌다(실측: chrono 를
  // y 86→48 로 내렸을 때 적 3마리 이름줄이 아군 3명 위로 지나갔다). 적끼리의 겹침 축으로는
  // 안 잡히므로 따로 본다. 판정은 스프라이트 상자 교차 — 접촉(0px)은 통과.
  for (const enemy of enemies) {
    const rect = enemy.image;
    if (!rect) continue;
    for (const ally of battlers.allies ?? []) {
      // 노드가 아니라 **스프라이트 잉크**끼리 본다. pokemon 처럼 아군이 화면 위에 뜬 HUD 카드로
      // 표현되는 스킨에서는 노드 상자가 필드를 넓게 덮어서, 노드 기준으로 보면 의도된 HUD
      // 오버레이(실측 3건)를 결함으로 잡는다.
      const box = ally.image;
      if (!box) continue;
      const overlapX = Math.min(rect.right, box.right) - Math.max(rect.left, box.left);
      const overlapY = Math.min(rect.bottom, box.bottom) - Math.max(rect.top, box.top);
      if (overlapX <= 0 || overlapY <= 0) continue;
      failures.push(
        `battlerGeometry[${enemy.id ?? "(id 없음)"}/${ally.id ?? "(아군)"}]: 적이 아군 스프라이트와 겹쳐 있다`
          + ` (교차 ${Math.round(overlapX)}×${Math.round(overlapY)}px)`,
      );
    }
  }
  // 이름표 축: 스프라이트가 안 겹쳐도 **이름/게이지가 겹치면 글자가 뭉개진다**(실측: chrono·mv 는
  // 적 간격이 38~44px 인데 공용 이름표가 훨씬 넓어 "슬라임동굴 박쥐슬라임" 으로 뭉개졌다).
  // 잉크 박스(Range 실측)끼리 교차하면 실패. 스프라이트 축과 독립이라 따로 본다.
  for (let a = 0; a < enemies.length; a += 1) {
    for (let b = a + 1; b < enemies.length; b += 1) {
      const first = enemies[a]?.name;
      const second = enemies[b]?.name;
      if (!first || !second) continue;
      const overlapX = Math.min(first.right, second.right) - Math.max(first.left, second.left);
      const overlapY = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
      if (overlapX <= 0 || overlapY <= 0) continue;
      failures.push(
        `battlerGeometry[${enemies[a].id ?? a}/${enemies[b].id ?? b}]: 적 이름표가 겹쳐 글자가 뭉개진다`
          + ` (교차 ${Math.round(overlapX)}×${Math.round(overlapY)}px)`,
      );
    }
  }
  return failures;
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

  // 보이는 글자 단정 — testidPresent 는 DOM 존재만 본다. 숨은 패널(display:none) 속 숫자도
  // 통과하므로 "HP 가 18/18 → 0/18 로 줄었다" 를 그 축으로 적으면 화면에 없는 값을 증거로
  // 삼게 된다(실측: 클래식 스킨은 .battle-enemy-list-panel 을 display:none 으로 숨긴다).
  for (const [testid, wanted] of Object.entries(expected.visibleText ?? {})) {
    const seen = observed.visibleText?.[testid];
    if (!seen) {
      failures.push(`visibleText: ${testid} 노드가 DOM 에 없다(기대 "${wanted}")`);
      continue;
    }
    if (!seen.visible) {
      failures.push(
        `visibleText: ${testid} 가 화면에 없다(${seen.width}×${seen.height}, alpha ${seen.alpha})`
          + ` — 텍스트는 "${seen.text}"`,
      );
      continue;
    }
    if (!seen.text.includes(wanted)) {
      failures.push(`visibleText: ${testid} 기대 "${wanted}" 포함, 실제 "${seen.text}"`);
    }
  }

  // 오디오는 스크린샷에 안 잡힌다. 엔진이 재생 지시를 받은 리소스 id 를 기록하는 훅
  // (src/player/audio/audioEngine.ts 의 window.__oprnAudioObserved)이 유일한 관측 지점이다.
  // 배열이 없으므로 실패 — 훅이 설치되기 전을 「통과」 로 읽으면 게이트가 거짓말을 한다.
  if (expected.audioObservedIncludes) {
    const seen = Array.isArray(observed.audioObserved) ? observed.audioObserved : null;
    for (const resourceId of expected.audioObservedIncludes) {
      if (seen?.includes(resourceId)) continue;
      failures.push(`audio 미재생: ${resourceId} (관측: ${seen && seen.length > 0 ? seen.join(", ") : "없음"})`);
    }
  }

  // 이모트는 Phaser 스프라이트라 testid 로 볼 수 없다 — __oprnEmotes 훅 관측치로 판정한다.
  if (expected.emoteCountAtLeast !== undefined) {
    const emotes = observed.emotes;
    if (emotes === null || emotes === undefined) failures.push("이모트 훅 없음 — 정수리 이모트를 확인할 수 없다");
    else if (emotes.length < expected.emoteCountAtLeast) {
      failures.push(`emoteCountAtLeast: 기대 ${expected.emoteCountAtLeast} 이상, 실제 ${emotes.length}`);
    }
  }
  if (expected.emoteFrames !== undefined) {
    const frames = (observed.emotes ?? []).map((emote) => emote.frame);
    for (const frame of expected.emoteFrames) {
      if (!frames.includes(String(frame))) failures.push(`이모트 프레임 누락: ${frame} (실제 ${frames.join(",") || "없음"})`);
    }
  }
  if (expected.emoteTargets !== undefined) {
    const emotes = observed.emotes;
    if (emotes === null || emotes === undefined) failures.push("이모트 훅 없음 — 대상별 정수리 이모트를 확인할 수 없다");
    else {
      for (const expectedEmote of expected.emoteTargets) {
        const found = emotes.some(
          (emote) => emote.target === expectedEmote.target && emote.frame === String(expectedEmote.frame) && emote.alpha > 0.05,
        );
        if (!found) {
          const actual = emotes.map((emote) => `${emote.target}:${emote.frame}`).join(",") || "없음";
          failures.push(
            `대상별 이모트 누락: ${expectedEmote.target}:${expectedEmote.frame} (실제 ${actual})`,
          );
        }
      }
    }
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
  // 체공 판정. liftPx 는 원점 채널을 되읽은 값이고, playerSpriteY 는 접지선이다.
  // 체공 중에도 접지선이 타일 경계에 남아야 깊이·카메라·조명이 깨지지 않는다.
  const lift = observed.playerLiftPx;
  const liftUnavailable = (key) => {
    failures.push(`캐릭터 스프라이트 훅 없음 — 체공을 읽을 수 없다(${key} 확인 불가)`);
  };
  if (expected.playerLiftPxAtLeast !== undefined) {
    if (lift === null || lift === undefined) liftUnavailable("playerLiftPxAtLeast");
    else if (lift < expected.playerLiftPxAtLeast) {
      failures.push(`playerLiftPx: ${expected.playerLiftPxAtLeast}px 이상 기대, 실제 ${lift}px`);
    }
  }
  if (expected.playerLiftPx !== undefined) {
    if (lift === null || lift === undefined) liftUnavailable("playerLiftPx");
    else if (lift !== expected.playerLiftPx) {
      failures.push(`playerLiftPx: 기대 ${expected.playerLiftPx}, 실제 ${lift}`);
    }
  }
  if (expected.playerSpriteY !== undefined) {
    const groundY = observed.playerSpriteY;
    if (groundY === null || groundY === undefined) liftUnavailable("playerSpriteY");
    else if (groundY !== expected.playerSpriteY) {
      failures.push(`playerSpriteY: 기대 ${expected.playerSpriteY}, 실제 ${groundY}(접지선이 움직였다)`);
    }
  }

  // 발밑 그림자. 깊이 띠(하부 타일 0 < 그림자 < below 캐릭터 100k)는 브라우저에서만
  // 확인된다 — 그림자가 타일 밑으로 깔리면 조용히 안 보이는 채로 게이트를 통과한다.
  if (expected.playerShadowVisible !== undefined) {
    const shadow = observed.playerShadow;
    if (shadow === undefined) liftUnavailable("playerShadowVisible");
    else if (expected.playerShadowVisible) {
      if (!shadow || !shadow.visible) failures.push("playerShadow: 체공 중인데 그림자가 없다");
      else {
        if (!(shadow.depth > SHADOW_DEPTH_FLOOR && shadow.depth < SHADOW_DEPTH_CEILING)) {
          failures.push(
            `playerShadow: 깊이 ${shadow.depth} 가 띠(${SHADOW_DEPTH_FLOOR}~${SHADOW_DEPTH_CEILING}) 밖이다`,
          );
        }
        if (shadow.alpha <= 0) failures.push(`playerShadow: alpha ${shadow.alpha} — 투명하다`);
      }
    } else if (shadow && shadow.visible) {
      failures.push("playerShadow: 접지했는데 그림자가 남아 있다");
    }
  }
  // 그림자 원점은 (0.5,0.5) 라 y 는 접지선보다 반 높이 위다. 타원 **아래 끝**이 접지선에
  // 닿아야 발밑에 붙은 것으로 보인다.
  //
  // 허용 오차가 왜 2px 인가 (실측): 접지 뒤에 남는 값은 **숨기기 직전 마지막 프레임**의 위치다.
  // 점프는 groundY 를 프레임마다 선형 보간하고(`playSceneMovement`), 리프트가 0 이 되는 마지막
  // 프레임은 완료 분기로 빠져 그림자를 갱신하지 않는다. 그래서 남는 값은 항상 목적지보다
  // `한 칸(16px) × 마지막 프레임 간격 비율` 만큼 짧다 — 1200ms 점프에서 1px 이내이려면 마지막
  // 프레임 간격이 37.5ms 아래여야 한다. 60fps(16.7ms) 면 남지만 프레임 한 장만 흘려도 넘는다.
  // 실측 1.07px 로 3 회 중 1 회 실패했다. 주장의 뜻은 "그림자가 착지 타일까지 따라왔다" 이므로
  // 타일(16px) 보다 훨씬 작은 2px 로 두어 뜻은 지키고 드롭 프레임 한 장은 견딘다.
  if (expected.playerShadowGroundY !== undefined) {
    const shadow = observed.playerShadow;
    if (!shadow) liftUnavailable("playerShadowGroundY");
    else if (Math.abs(shadow.bottomY - expected.playerShadowGroundY) > 2) {
      failures.push(
        `playerShadowGroundY: 기대 ${expected.playerShadowGroundY}, 실제 ${shadow.bottomY}(타원 아래 끝)`,
      );
    }
  }
  if (expected.playerAirborne !== undefined) {
    const airborne = observed.playerAirborne;
    if (airborne === null || airborne === undefined) liftUnavailable("playerAirborne");
    else if (airborne !== expected.playerAirborne) {
      failures.push(`playerAirborne: 기대 ${expected.playerAirborne}, 실제 ${airborne}`);
    }
  }

  // 전투 글자 가시성: 계측은 runtimeQaRun 이 페이지에서 돌리고, 여기서는 판정만 한다.
  // `battleTextClean` 은 "이 국면의 battle-scene 안 모든 텍스트 노드가 상자 안에 온전히
  // 보인다" 는 뜻이다. 씬이 안 떠 있으면 조용히 통과시키지 않고 실패로 만든다 —
  // 마운트 실패를 '위반 0건' 으로 읽으면 게이트가 거짓말을 한다.
  if (expected.battleTextClean) {
    const audit = observed.battleText;
    if (!audit) failures.push("battleText: 계측이 실행되지 않았다");
    else if (!audit.mounted) failures.push("battleText: battle-scene 이 마운트되지 않았다");
    else {
      for (const node of audit.nodes) {
        failures.push(
          `battleText ${node.reasons.join(",")}: "${node.text}" (${node.selector}`
            + `${node.clipper ? ` ⊂ ${node.clipper}` : ""}`
            + `, 잘림 ${node.clippedRatio}, 걸침 ${node.slicedRatio})`,
        );
      }
    }
  }

  if (expected.battlerGeometry) {
    failures.push(...evaluateBattlerGeometry(expected.battlerGeometry, observed.battlers ?? null));
  }
  return failures;
}
