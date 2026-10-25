/* 첫 로드 스플래시(#oprn-boot-loader) 제어 — 번들(main.ts)보다 먼저, 번들과 무관하게 돈다.
 *
 * 왜 외부 파일인가: Electron app:// CSP(script-src 'self')가 인라인 스크립트를 막는다. 외부 클래식 스크립트는
 * 어느 CSP 에서도 돌고, 번들 로드가 실패해도 이 파일은 이미 돌고 있어 실패를 화면에 말할 수 있다.
 * 크기 약 6KB. ES5 — 번들러를 거치지 않는다. 마크업·CSS 는 index.html 에 인라인으로 있다(첫 프레임이 이 스크립트를 안 기다린다).
 *
 * 하는 일
 *  1. 언어 결정(src/i18n/locale.ts resolveLocale 과 같은 규칙) → 문구 교체. 편집기 i18n 계층에 의존하지 않는다.
 *  2. 단계 표시: 4개 이산 단계(앱 → 공용 자료 → 프로젝트 → 도구). 번들이 window.__oprnBootSplash.stage() 로 알린다. 가짜 퍼센트 없음.
 *  3. 실패 화면: 번들 스크립트 로드 실패·번들 평가 중 예외 → 메시지 + 다시 시도(실패 후에 영원히 도는 스플래시는 없다).
 *  4. 계측: performance.mark("oprn:boot:*") + window.__oprnBoot() 요약. 번들이 같은 마크 이름 규칙으로 더한다(src/util/bootMarks.ts).
 *
 * 계약(바꾸면 src/app/bootLoader.ts·src/util/bootMarks.ts 를 함께): window.__oprnBootSplash = { stage(id), fail(kind, detail), leave() }
 * stage id: prepare | shared | project | editor.  data-* 만 쓰고 화면 글자를 다시 읽지 않는다(openwiki/i18n.md 역참조 금지).
 */
(function () {
  "use strict";
  var w = window;
  var d = document;
  var perf = w.performance;
  var root = d.getElementById("oprn-boot-loader");

  function mark(name) {
    try { perf.mark("oprn:boot:" + name); } catch (e) { /* performance 없음 */ }
  }
  mark("html");

  /* window.__oprnBoot(): 부팅 마크 요약. 개발자 콘솔에서 `__oprnBoot()` 또는 `__oprnBoot(true)`(표). */
  w.__oprnBoot = function (table) {
    var rows = [];
    try {
      var marks = perf.getEntriesByType("mark");
      var prev = 0;
      for (var i = 0; i < marks.length; i += 1) {
        if (marks[i].name.indexOf("oprn:boot:") !== 0) continue;
        var at = Math.round(marks[i].startTime);
        rows.push({ stage: marks[i].name.slice(10), atMs: at, sincePrevMs: at - prev });
        prev = at;
      }
      var paints = perf.getEntriesByType("paint");
      for (var p = 0; p < paints.length; p += 1) rows.push({ stage: paints[p].name, atMs: Math.round(paints[p].startTime), sincePrevMs: null });
      rows.sort(function (a, b) { return a.atMs - b.atMs; });
    } catch (e) { /* 요약 실패는 무시 */ }
    if (table === true && w.console && w.console.table) w.console.table(rows);
    return rows;
  };

  if (!root) return;

  var COPY = {
    ko: {
      steps: ["앱 불러오는 중…", "공용 자료 받는 중…", "프로젝트 여는 중…", "도구 준비 중…"],
      note: "큰 프로젝트라 시간이 걸려요. 새 버전을 처음 여는 때가 가장 오래 걸리고, 다음부터는 빨라져요.",
      stall: "아직 열리지 않았어요. 계속 기다리거나 다시 시도할 수 있어요.",
      retry: "다시 시도", title: "OPRN Studio를 열지 못했어요", details: "자세히",
      bundle: "앱 파일을 받지 못했어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
      script: "앱을 시작하는 중 오류가 났어요. 다시 시도해도 같으면 아래 자세히 내용을 함께 알려 주세요.",
      project: "프로젝트를 여는 중 오류가 났어요. 프로젝트 파일은 건드리지 않았어요.",
      unknown: "열리는 중 문제가 생겼어요.",
      lang: "ko"
    },
    en: {
      steps: ["Loading the app…", "Fetching shared content…", "Opening your project…", "Getting tools ready…"],
      note: "This is a big project, so it takes a while. The first launch of a new version is the slowest; later launches are faster.",
      stall: "It has not opened yet. You can keep waiting or try again.",
      retry: "Try again", title: "OPRN Studio could not open", details: "Details",
      bundle: "The app files could not be downloaded. Check your connection and try again.",
      script: "Something went wrong while starting the app. If it happens again, please share the details below.",
      project: "Something went wrong while opening the project. Your project files were not touched.",
      unknown: "Something went wrong while opening.",
      lang: "en"
    },
    ja: {
      steps: ["アプリを読み込み中…", "共有データを取得中…", "プロジェクトを開いています…", "ツールを準備中…"],
      note: "大きなプロジェクトのため時間がかかります。新しいバージョンの初回起動が最も長く、次回からは速くなります。",
      stall: "まだ開いていません。このまま待つか、再試行できます。",
      retry: "再試行", title: "OPRN Studioを開けませんでした", details: "詳細",
      bundle: "アプリのファイルを取得できませんでした。接続を確認して再試行してください。",
      script: "アプリの起動中にエラーが発生しました。繰り返す場合は下の詳細を共有してください。",
      project: "プロジェクトを開く途中でエラーが発生しました。プロジェクトのファイルには触れていません。",
      unknown: "起動中に問題が発生しました。",
      lang: "ja"
    },
    zh: {
      steps: ["正在加载应用…", "正在获取共享内容…", "正在打开项目…", "正在准备工具…"],
      note: "项目较大，需要一些时间。新版本首次打开最慢，之后会更快。",
      stall: "尚未打开。可以继续等待，也可以重试。",
      retry: "重试", title: "无法打开 OPRN Studio", details: "详情",
      bundle: "无法下载应用文件。请检查网络连接后重试。",
      script: "启动应用时出错。如果再次出现，请分享下方的详情。",
      project: "打开项目时出错。项目文件未被改动。",
      unknown: "打开时出现问题。",
      lang: "zh-CN"
    }
  };
  var TIPS = {
    en: ["Map & event editing", "AI assistant", "Autosave"],
    ja: ["マップ・イベント編集", "AIアシスタント", "自動保存"],
    zh: ["地图·事件编辑", "AI 助手", "自动保存"]
  };

  /* 언어 결정 — src/i18n/locale.ts resolveLocale 과 같은 순서: ?lang → 저장값 → 자동화 브라우저는 ko → 브라우저 언어 → en. */
  function pick(tag) {
    var base = String(tag || "").toLowerCase().replace(/_/g, "-").split("-")[0];
    return COPY[base] ? base : null;
  }
  var locale = "ko";
  try {
    var params = new URLSearchParams(w.location.search);
    var saved = null;
    try { saved = w.localStorage.getItem("oprn:locale"); } catch (e) { saved = null; }
    locale = pick(params.get("lang")) || pick(saved);
    if (!locale && w.navigator.webdriver && params.get("localeDetect") !== "1") locale = "ko";
    if (!locale) {
      var langs = w.navigator.languages && w.navigator.languages.length ? w.navigator.languages : [w.navigator.language];
      for (var k = 0; k < langs.length && !locale; k += 1) locale = pick(langs[k]);
    }
    locale = locale || "en";
  } catch (e) { locale = "ko"; }
  var copy = COPY[locale];

  function q(selector) { return root.querySelector(selector); }
  function setText(selector, text) { var node = q(selector); if (node) node.textContent = text; }

  d.documentElement.lang = copy.lang;
  setText(".oprn-boot-note", copy.note);
  setText(".oprn-boot-stall-text", copy.stall);
  setText(".oprn-boot-fail-title", copy.title);
  var retries = root.querySelectorAll(".oprn-boot-retry");
  for (var r = 0; r < retries.length; r += 1) retries[r].textContent = copy.retry;
  var summary = q(".oprn-boot-fail summary");
  if (summary) summary.textContent = copy.details;

  /* 팁 세 줄: 한국어는 지난 부팅이 남긴 프로젝트 요약(oprn:boot-brief)이 있으면 그것을, 다른 언어는 고정 번역을 쓴다. */
  var tipNodes = root.querySelectorAll(".oprn-boot-track p");
  try {
    var lines = TIPS[locale] || null;
    if (!lines) {
      var raw = w.localStorage.getItem("oprn:boot-brief");
      var parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length === 3) {
        var ok = true;
        for (var t = 0; t < 3; t += 1) if (typeof parsed[t] !== "string" || parsed[t].length === 0) ok = false;
        if (ok) lines = parsed;
      }
    }
    if (lines && tipNodes.length === 3) for (var n = 0; n < 3; n += 1) tipNodes[n].textContent = lines[n];
  } catch (e) { /* 캐시가 깨져 있으면 기본 줄을 둔다 */ }

  var STAGE_INDEX = { prepare: 0, shared: 1, project: 2, editor: 3 };
  var current = 0;
  var finished = false;
  var booted = false;
  var stepNodes = root.querySelectorAll(".oprn-boot-steps li");

  function render(index) {
    current = index;
    for (var i = 0; i < stepNodes.length; i += 1) {
      stepNodes[i].setAttribute("data-state", i < index ? "done" : i === index ? "active" : "pending");
    }
    root.setAttribute("data-stage", ["app", "shared", "project", "editor"][index] || "app");
    setText(".oprn-boot-text", copy.steps[index] + " (" + (index + 1) + "/" + stepNodes.length + ")");
  }
  render(0);

  function fail(kind, detail) {
    if (finished || root.hasAttribute("data-failed")) return;
    mark("failed-" + kind);
    setText(".oprn-boot-fail-msg", copy[kind] || copy.unknown);
    var text = String(detail == null ? "" : detail);
    setText(".oprn-boot-fail-detail", text.length > 600 ? text.slice(0, 600) + "…" : text);
    var details = q(".oprn-boot-fail details");
    if (details) details.style.display = text ? "" : "none";
    root.setAttribute("data-failed", kind);
    root.setAttribute("data-stage", "failed");
  }

  w.__oprnBootSplash = {
    stage: function (id) {
      var index = STAGE_INDEX[id];
      if (index === undefined || finished) return;
      booted = true; // 번들이 평가를 마치고 부팅을 시작했다 — 이 뒤의 스크립트 오류는 «번들 평가 실패»가 아니다.
      var failedKind = root.getAttribute("data-failed");
      // 평가 실패로 오인했던 «script» 는 번들이 살아 있다는 신호(단계 보고)가 오면 거둔다. 번들 로드 실패·프로젝트 실패는 되살리지 않는다.
      if (failedKind === "script") { root.removeAttribute("data-failed"); render(Math.max(current, index)); return; }
      if (failedKind !== null) return;
      if (index > current || (index === 0 && current === 0)) render(index);
    },
    fail: fail,
    leave: function () { finished = true; }
  };

  /* 마지막 편집 화면(데스크톱만 — 프리로드가 window.oprn.resume 을 준다, electron/main/lastView.ts).
   * 지난번 닫을 때의 편집기 그림을 읽기 전용 자리표시로 깔고 단계 글자를 작은 칩으로 바꾼다. 편집기가 준비되면 로더째 걷힌다.
   * 묻는 동안(최대 400ms) 로고·줄을 숨긴다(data-resume-pending) — 그림이 있으면 흰 로더가 한 프레임도 비치지 않게. 없으면 평소 로더. */
  var resume = null;
  try { resume = w.oprn && w.oprn.resume && typeof w.oprn.resume.lastView === "function" ? w.oprn.resume : null; } catch (e) { resume = null; }
  // 편집기 문서만 — 플레이·데모 보기는 같은 index.html 을 쓰지만 편집기 그림을 깔면 안 된다.
  if (resume && /[?&](play|demo)=/.test(w.location.search)) resume = null;
  if (resume) {
    root.setAttribute("data-resume-pending", "");
    var clearPending = function () { root.removeAttribute("data-resume-pending"); };
    var pendingTimer = w.setTimeout(clearPending, 400);
    try {
      resume.lastView().then(function (view) {
        w.clearTimeout(pendingTimer);
        if (view && typeof view.dataUrl === "string" && view.dataUrl.indexOf("data:image/") === 0 && !finished && !root.hasAttribute("data-failed")) {
          var img = d.createElement("img");
          img.className = "oprn-boot-resume";
          img.alt = "";
          img.setAttribute("aria-hidden", "true");
          img.draggable = false;
          img.src = view.dataUrl;
          root.insertBefore(img, root.firstChild);
          root.setAttribute("data-resume", "");
          mark("resume-shown");
        }
        clearPending();
      }, function () { w.clearTimeout(pendingTimer); clearPending(); });
    } catch (e) { w.clearTimeout(pendingTimer); clearPending(); }
  }

  /* 번들 로드 실패(주 모듈 <script> 의 error 이벤트는 버블하지 않는다 → capture)와 번들 평가 중 예외.
   * 평가 중 예외는 같은 출처 스크립트의 것만 센다 — 브라우저 확장이 던지는 «Script error.» 로 실패 화면을 띄우지 않는다. */
  w.addEventListener("error", function (event) {
    if (finished) return;
    var target = event && event.target;
    if (target && target !== w && target.tagName === "SCRIPT") {
      var src = target.getAttribute("src") || "";
      if (src.indexOf("boot-splash") === -1) fail("bundle", src);
      return;
    }
    if (!booted && event && event.message && event.filename && event.filename.indexOf(w.location.origin) === 0) {
      fail("script", event.message + "\n" + event.filename + ":" + event.lineno);
    }
  }, true);
})();
