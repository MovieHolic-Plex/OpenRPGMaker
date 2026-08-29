// 전투 글자 가시성 계측 — 순수 판정 로직 + 페이지 안에서 돌 계측 함수.
//
// 왜 별도 모듈인가: 부수효과(브라우저 구동·디스크 쓰기)는 scripts/qa/battle-text-audit.mjs 가
// 맡고, 여기서는 (1) 페이지에 그대로 주입되는 계측 함수 소스와 (2) 계측 결과를 판정하는
// 순수 함수만 둔다. 판정을 순수하게 떼어 두면 유닛 테스트가 브라우저 없이 돈다.
//
// 계측 원리 (왜 Range 기하인가 — 실측 근거):
// 전투 씬은 `transform: scale(var(--battle-stage-scale))` 로 축소돼 마운트된다(실플레이
// 경로에서는 조상 `--play-scale` 이 한 번 더 곱해진다). 그래서 `font-size` 나
// `clientHeight` 같은 **논리 px** 값만 봐서는 화면에서 실제로 몇 px 로 보이는지 알 수 없다.
// `Range.getBoundingClientRect()` 는 모든 조상 transform 이 적용된 **뷰포트 좌표 잉크 박스**를
// 돌려주므로, 잘림 판정과 "너무 작아 안 읽힘" 판정을 같은 좌표계에서 할 수 있다.
//
// 클리핑 조상 판정 — 세 갈래를 구분한다(초판은 이걸 섞어서 오판했다. 실측:
// rm2003 skill-submenu 의 "검격/뒤로" 를 `clipped` 로 4건 올렸는데 그 행들은
// `overflow-y:auto` 인 메뉴의 스크롤 범위 안이라 커서가 scrollIntoView 로 데려온다 —
// 즉 결함이 아니었다. 반대로 스크린샷에 **실제로** 반쯤 잘려 보이던 행(스크롤포트
// 아래 경계에 걸친 행)은 한 건도 올리지 못했다. 위양성 4 + 위음성 1 이었다):
//
//   · `clipped`  — `overflow: hidden|clip` 상자 밖. 스크롤로도 못 데려온다. 영구 결함.
//   · `sliced`   — `auto|scroll` 스크롤포트의 **경계에 걸친** 잉크. 글리프가 세로로
//                  반 잘려 그려진다. 스크롤해도 항상 경계에 걸친 행이 하나 남으므로
//                  포트 높이를 행 피치의 정수배로 맞춰야 없어진다. 시각 결함.
//   · 스크롤포트 **완전히 밖** — 스크롤로 도달 가능. 결함이 아니다(보고하지 않는다).
//
// 그래서 어떤 축에서 스크롤포트를 만나면 그 축의 hidden 누적을 **멈춘다**. 스크롤포트 안
// 노드의 좌표를 바깥 hidden 상자와 비교하는 건 의미가 없다 — 스크롤이 그 좌표를 바꾼다.
// 스크롤포트 자신이 부모에게 잘리는지는 노드가 아니라 포트의 문제이므로 따로 센다.

/** 화면에서 이 높이(css px) 미만이면 픽셀 글꼴이 뭉개져 읽을 수 없다. */
export const MIN_INK_HEIGHT_PX = 6;
/** 잉크 박스가 클립 박스 밖으로 이 비율 이상 나가면 잘린 것으로 센다. */
export const MAX_CLIPPED_AREA_RATIO = 0.02;
/** 누적 불투명도가 이 값 미만이면 사실상 안 보인다. */
export const MIN_EFFECTIVE_ALPHA = 0.1;

/**
 * 페이지 안에서 실행할 계측 함수. `page.evaluate(pageAuditSource, options)` 로 넘긴다.
 * 문자열이 아니라 실제 함수로 두어 타이포가 조용히 통과하지 않게 한다.
 */
/**
 * 잉크 박스 · 영구 절단 박스 · 가장 가까운 스크롤포트 기하만으로 가시성을 판정하는
 * **순수 함수**. 부수효과가 없으므로 버전 없이 단위 테스트로 박는다. 초판이 이
 * 판정을 섞어 오판했으므로 로직을 떼어 고정해 둔다. `auditBattleText` 는 페이지로
 * 직렬화되어 모듈 스코프를 보지 못하므로 같은 산식을 그 안에 다시 적었다 — 이
 * 함수가 사실상의 사양이다.
 */
export function classifyInkGeometry(ink, hardClip, port, tolerance = MAX_CLIPPED_AREA_RATIO) {
  const BIG = 1e7;
  const area = (r) => Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);
  const intersect = (a, b) => ({
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  });
  const inkArea = area(ink);
  if (inkArea <= 0) return { clippedRatio: 1, slicedRatio: 0, scrollReachable: false };
  const unbounded = { left: -BIG, top: -BIG, right: BIG, bottom: BIG };
  const clippedRatio = 1 - area(intersect(ink, hardClip ?? unbounded)) / inkArea;
  let slicedRatio = 0;
  let scrollReachable = false;
  if (port) {
    const inside = area(
      intersect(ink, {
        left: port.axisX ? port.left : -BIG,
        right: port.axisX ? port.right : BIG,
        top: port.axisY ? port.top : -BIG,
        bottom: port.axisY ? port.bottom : BIG,
      }),
    );
    const outside = 1 - inside / inkArea;
    if (outside >= 0.98) scrollReachable = true;
    else if (outside > tolerance) slicedRatio = outside;
  }
  return { clippedRatio: Math.max(0, clippedRatio), slicedRatio: Math.max(0, slicedRatio), scrollReachable };
}

export function auditBattleText(options) {
  const { minInkHeight, maxClippedAreaRatio, minAlpha } = options;
  const scene = document.querySelector("[data-testid='battle-scene']");
  if (!(scene instanceof HTMLElement)) return { mounted: false, nodes: [] };

  const BIG = 1e7;
  // page.evaluate 는 이 함수를 직렬화해 부친다 — 모듈 스코프의 상수는 페이지에 없다.
  // 그래서 분류 기준을 여기 직접 적는다(산식 사양은 classifyInkGeometry).
  const isHard = (value) => value === "hidden" || value === "clip";
  const isScroll = (value) => value === "auto" || value === "scroll";
  const intersect = (a, b) => ({
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  });
  const area = (r) => Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);

  const describe = (el) => {
    const testid = el.dataset ? el.dataset.testid : undefined;
    if (testid) return `[${testid}]`;
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/)[0] : "";
    return cls ? `.${cls}` : el.tagName.toLowerCase();
  };

  const nodes = [];
  let intentionallyHidden = 0;
  const walker = document.createTreeWalker(scene, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const value = (text.nodeValue ?? "").replace(/\s+/g, " ").trim();
    if (!value) continue;
    const el = text.parentElement;
    if (!(el instanceof HTMLElement)) continue;

    // 의도적으로 숨긴 노드는 "안 보이는 글자"가 아니다 — 스킨이 DOM 을 남기고
    // display:none 으로 끄는 경로가 있다(예: 포켓몬 스킨의 MP/ATB, 21-gen1-hud-type-badge.css).
    let hidden = false;
    let alpha = 1;
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.contentVisibility === "hidden") {
        hidden = true;
        break;
      }
      // 쓰러진 전투원은 사라지는 것이 연출이다 — `.battle-enemy.defeated` 은
      // battle-death-fade 를 `forwards` 로 돌려 opacity 0 에서 멈춘다
      // (battle/15-juice-capture-fx.css). 그 이름표가 안 보이는 건 사양이지 결함이 아니다.
      if (a.classList && a.classList.contains("defeated")) {
        hidden = true;
        break;
      }
      alpha *= Number.parseFloat(cs.opacity || "1");
    }
    if (hidden) continue;

    // `font-size: 0` 은 사고로 나오는 값이 아니다 — 글자를 화면에서만 지우고 textContent·
    // 접긌성 트리는 남기는 새록이다. vxace 는 참조 HUD 가 이름 대심 얼굴로 인물을
    // 알려준다고 보고 이름을 이 방식으로 숨긴다(_vxace.css:423 의 주석). 그 상자 안에
    // 중첩된 레뱨은 자기 font-size 로 그려지므로 부모를 토리는 sr-only 로는 바꿀 수 없다.
    // 의도를 재판하지 않고 건너맜다. 단, 조용히 버리지 않고 숫자로 남긴다.
    if (Number.parseFloat(getComputedStyle(el).fontSize || "0") === 0) {
      intentionallyHidden += 1;
      continue;
    }

    // 에니모이션 진행 중인 노드는 **보이기 함**을 부정하는 프레임을 지나간다. 전투 도입부는
    // 파티 HUD 를 opacity 0→1 로 드러내므로(battle/02-intro-reveal.css), 그 사이를 재면
    // alpha=0 · 잉크 0×0 이 나온다 — 이건 결함이 아니라 에니모이션 한 함이다(실측:
    // intro 국면에서 transparent 440건 · zero-area 48건이 전부 이 사례여서 전수가 헛거백이었다).
    // 기하 절단은 에니모이션과 무관하게 진짜 결함이므로 그대로 센다.
    let animating = false;
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      if (a.getAnimations().some((animation) => animation.playState === "running")) {
        animating = true;
        break;
      }
    }

    const range = document.createRange();
    range.selectNodeContents(text);
    const ink = range.getBoundingClientRect();

    // 영구 절단 박스 = hidden|clip 조상들의 교집합, 단 축마다 스크롤포트를 만나면 멈춘다.
    // 동시에 가장 가까운 스크롤포트를 기억해 "경계에 걸침"(sliced) 을 따로 판정한다.
    let clip = { left: -BIG, top: -BIG, right: BIG, bottom: BIG };
    let clipper = null;
    let sealedX = false;
    let sealedY = false;
    let port = null;
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      const scrollX = isScroll(cs.overflowX);
      const scrollY = isScroll(cs.overflowY);
      if ((scrollX && !sealedX) || (scrollY && !sealedY)) {
        // 가장 가까운 스크롤포트만 경계 판정에 쓴다. 바깥 포트는 이 포트를 움직인다.
        if (port === null) {
          const box = a.getBoundingClientRect();
          port = {
            node: describe(a),
            axisX: scrollX && !sealedX,
            axisY: scrollY && !sealedY,
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
          };
        }
        if (scrollX) sealedX = true;
        if (scrollY) sealedY = true;
      }
      const hardX = isHard(cs.overflowX) && !sealedX;
      const hardY = isHard(cs.overflowY) && !sealedY;
      if (!hardX && !hardY) continue;
      const box = a.getBoundingClientRect();
      const next = intersect(clip, {
        left: hardX ? box.left : -BIG,
        right: hardX ? box.right : BIG,
        top: hardY ? box.top : -BIG,
        bottom: hardY ? box.bottom : BIG,
      });
      if (area(next) < area(clip)) clipper = describe(a);
      clip = next;
    }

    const inkArea = area(ink);
    const visibleArea = area(intersect(ink, clip));
    const clippedRatio = inkArea > 0 ? 1 - visibleArea / inkArea : 1;

    // 스크롤포트 경계 걸침: 스크롤 축에서 잉크가 일부만 포트 안에 있으면 반 잘려 보인다.
    // 완전히 밖이면 스크롤로 데려올 수 있으므로 결함이 아니다.
    let slicedRatio = 0;
    if (port !== null && inkArea > 0) {
      const portBox = {
        left: port.axisX ? port.left : -BIG,
        right: port.axisX ? port.right : BIG,
        top: port.axisY ? port.top : -BIG,
        bottom: port.axisY ? port.bottom : BIG,
      };
      const inside = area(intersect(ink, portBox));
      const outside = 1 - inside / inkArea;
      // 0 < outside < 1 → 경계 걸침. outside ≈ 1 → 완전히 밖(스크롤 도달 가능).
      if (outside > maxClippedAreaRatio && outside < 0.98) slicedRatio = outside;
    }

    const own = getComputedStyle(el);
    const colorAlpha = (() => {
      const match = /rgba?\(([^)]+)\)/.exec(own.color);
      if (!match) return 1;
      const parts = match[1].split(",").map((piece) => Number.parseFloat(piece));
      return parts.length >= 4 ? parts[3] : 1;
    })();
    const ellipsized =
      own.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1;

    // 가리기(occlusion): 상자 안에 오온전하게 들어 있어도 **다른 불통명 요소가 위에
    // 그려지면** 사용자는 그 글자를 읽지 못한다. 사용자에게는 자림과 같은 증상이다
    // — 실측: rm2003 대상 선택 국면에서 선택된 적의 HUD 카드 제목이 상단 메시지
    // 창 밑에 들어가 이름이 안 보인다. 기하 계산은 이걸 잡지 못하므로 잉크 상자의
    // 여러 지점에서 elementFromPoint 를 찍어 확인한다.
    let occludedRatio = 0;
    if (inkArea > 0 && clippedRatio <= maxClippedAreaRatio && slicedRatio === 0 && !animating) {
      const visible = intersect(ink, clip);
      let blocked = 0;
      let tested = 0;
      for (const fx of [0.15, 0.5, 0.85]) {
        for (const fy of [0.3, 0.7]) {
          const px = visible.left + (visible.right - visible.left) * fx;
          const py = visible.top + (visible.bottom - visible.top) * fy;
          if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
          const hit = document.elementFromPoint(px, py);
          if (!hit) continue;
          tested += 1;
          // 자기·자식·조상은 가리는 게 아니다 — 글자는 원래 그 상자 속에 그려진다.
          if (hit === el || el.contains(hit) || hit.contains(el)) continue;
          // 반통목이면 글자가 읽힐 수 있다 — 사실상 불통명한 상자만 가림으로 센다.
          const hs = getComputedStyle(hit);
          const match = /rgba?\(([^)]+)\)/.exec(hs.backgroundColor || "");
          const bgAlpha = match
            ? (() => {
                const parts = match[1].split(",").map((piece) => Number.parseFloat(piece));
                return parts.length >= 4 ? parts[3] : 1;
              })()
            : 0;
          const hasImage = hs.backgroundImage && hs.backgroundImage !== "none";
          if (bgAlpha >= 0.85 || hasImage) blocked += 1;
        }
      }
      if (tested > 0) occludedRatio = blocked / tested;
    }

    const reasons = [];
    if (inkArea === 0) {
      if (!animating) reasons.push("zero-area");
    } else if (clippedRatio > maxClippedAreaRatio) reasons.push("clipped");
    if (slicedRatio > 0) reasons.push("sliced");
    if (ink.height > 0 && ink.height < minInkHeight) reasons.push("too-small");
    if (!animating && alpha * colorAlpha < minAlpha) reasons.push("transparent");
    // 잉크 허용 표본의 절반 이상이 불통명 상자에 만혀 있으면 사실상 안 보이는 것이다.
    // 단, 이 지표는 **게이트로 쓰지 않고 기록만 한다**. 이유(실측):
    // `elementFromPoint` 는 `pointer-events: none` 인 요소를 건너눠다. rm2003 의
    // 메시지 창은 `pointer-events: none`(_rm2003.css:312) 이므로 그 안의 글자를
    // 찍으면 창이 아니라 **뒷배경이** 맞으며, 그걸 "위에 낯은 가림막" 으로 오판한다
    // (실제로 화면에 안 보이는 것은 적 HUD 카드 한 건인데 8건이 올라왔다).
    // 가림을 제대로 잡려면 힙테스트가 아니라 픽셀 버팜 별로 해야 한다.
    // 실뢰러진 검지기로 증거를 부새게 만드는 것보다 숫자만 남기는 게 정직하다.
    if (ellipsized) reasons.push("ellipsized");

    if (reasons.length === 0) continue;
    // 위반 노드마다 조상 상자 사슬을 함께 남긴다. "어느 상자가 왜 잘랐는지" 는
    // 사유 이름만으로는 못 고친다 — 스크롤포트 높이가 행 높이의 정수배가 아닌 경우와
    // 상자 자체가 부모를 넘친 경우는 사유가 같아도 처방이 다르다.
    const boxes = [];
    for (let a = el; a && a !== document.documentElement && boxes.length < 6; a = a.parentElement) {
      const cs = getComputedStyle(a);
      const box = a.getBoundingClientRect();
      boxes.push({
        node: describe(a),
        overflow: `${cs.overflowX}/${cs.overflowY}`,
        rect: [Math.round(box.left), Math.round(box.top), Math.round(box.width), Math.round(box.height)],
        client: [a.clientWidth, a.clientHeight],
        scroll: [a.scrollWidth, a.scrollHeight],
      });
    }
    nodes.push({
      boxes,
      text: value.length > 40 ? `${value.slice(0, 40)}…` : value,
      selector: describe(el),
      reasons,
      inkWidth: Math.round(ink.width * 100) / 100,
      inkHeight: Math.round(ink.height * 100) / 100,
      clippedRatio: Math.round(clippedRatio * 1000) / 1000,
      slicedRatio: Math.round(slicedRatio * 1000) / 1000,
      occludedRatio: Math.round(occludedRatio * 1000) / 1000,
      clipper: clipper ?? (slicedRatio > 0 ? port?.node ?? null : null),
      fontSize: own.fontSize,
      alpha: Math.round(alpha * colorAlpha * 100) / 100,
    });
  }
  return { mounted: true, nodes, intentionallyHidden };
}

/** 국면별 계측 결과를 하나의 판정으로 접는다. 순수 함수 — 브라우저 없이 테스트한다. */
export function summarizeAudit(runs) {
  const failures = [];
  for (const run of runs) {
    if (!run.mounted) {
      failures.push({ skin: run.skin, phase: run.phase, text: "(battle-scene 미마운트)", reasons: ["not-mounted"] });
      continue;
    }
    for (const node of run.nodes) failures.push({ skin: run.skin, phase: run.phase, ...node });
  }
  const byReason = {};
  for (const failure of failures) {
    for (const reason of failure.reasons) byReason[reason] = (byReason[reason] ?? 0) + 1;
  }
  return { total: failures.length, byReason, failures, pass: failures.length === 0 };
}

/** SUMMARY.md 본문. 에이전트가 PNG 를 전량 열지 않게 여기서 먼저 읽는다. */
export function renderAuditSummary(report) {
  const lines = [
    `# 전투 글자 가시성 계측 — ${report.pass ? "PASS" : "FAIL"}`,
    "",
    `- 트리: \`${report.tree ?? "?"}\``,
    `- 뷰포트: ${report.viewport.width}×${report.viewport.height}`,
    `- 스킨: ${report.skins.join(", ")}`,
    `- 국면: ${report.phases.join(", ")}`,
    `- 위반 노드: **${report.total}건**`,
    "",
  ];
  if (Object.keys(report.byReason).length > 0) {
    lines.push("## 사유별", "");
    for (const [reason, count] of Object.entries(report.byReason).sort((a, b) => b[1] - a[1])) {
      lines.push(`- \`${reason}\`: ${count}`);
    }
    lines.push("");
  }
  if (report.failures.length > 0) {
    lines.push("## 위반 목록", "", "| 스킨 | 국면 | 노드 | 글자 | 사유 | 잉크 | 잘림비 | 걸침비 | 절단자 |", "|---|---|---|---|---|---|---|---|---|");
    for (const f of report.failures.slice(0, 400)) {
      lines.push(
        `| ${f.skin} | ${f.phase} | \`${f.selector}\` | ${f.text} | ${f.reasons.join(",")} | ${f.inkWidth}×${f.inkHeight} | ${f.clippedRatio ?? "-"} | ${f.slicedRatio ?? "-"} | ${f.clipper ?? "-"} |`,
      );
    }
    if (report.failures.length > 400) lines.push(`| … | | | ${report.failures.length - 400}건 생략 | | | | | |`);
    lines.push("");
  }
  lines.push("## 즉시 확인", "");
  for (const shot of report.shots) lines.push(`- \`${shot}\``);
  lines.push("");
  return lines.join("\n");
}
