// Deterministic checks over player traces. These need no model and decide most cases outright:
// errors, failed requests, missing resources, stuck/soft-locked runs, prolonged black screens, DOM-measured
// text clipping and off-screen UI. Only frames these checks cannot decide go to the vision observer.

const IGNORE_NET = /favicon|items\/shared|pixel-enemy/;
const IGNORE_CONSOLE = /AudioContext|play\(\) failed|autoplay|NotAllowedError|webgl|GL_|GPU stall/i;

function frameRef(job, row) {
  return { job: job.id, seq: row.seq, file: row.file, label: row.label };
}

/** @returns {{ findings: object[], frames: object[] }} findings with evidence + every frame row annotated for observation */
export function detectRun(runs) {
  const findings = [];
  const frames = [];
  const add = (f) => findings.push({ source: "deterministic", ...f });

  for (const { job, summary, rows } of runs) {
    const base = { game: job.slug, version: job.version, jobId: job.id, jobKind: job.kind, input: job.input, viewport: job.viewportName, target: job.target ?? null };
    if (summary?.fatal) add({ ...base, check: "session-fatal", severity: "function", claim: `세션이 오류로 끝났다: ${summary.fatal}`, evidence: rows.slice(-1).map((r) => frameRef(job, r)) });
    if ((summary?.blockedCount ?? 0) > 0) add({ ...base, check: "external-request", severity: "function", claim: `게임이 외부 주소를 요청했다(차단됨) ${summary.blocked.slice(0, 3).join(" ")}`, evidence: [] });
    let darkRun = [];
    for (const row of rows) {
      const ev = [frameRef(job, row)];
      for (const e of row.errors ?? []) {
        if (e.kind === "console" && IGNORE_CONSOLE.test(e.text)) continue;
        add({ ...base, check: e.kind === "pageerror" ? "page-error" : "console-error", severity: e.kind === "pageerror" ? "function" : "visual", claim: e.text, key: `${e.kind}|${e.text.replace(/\d+/g, "#").slice(0, 120)}`, evidence: ev, state: row.state, inputs: row.inputs });
      }
      for (const n of row.net ?? []) {
        if (IGNORE_NET.test(n.url)) continue;
        // The browser aborts media and blob requests when music switches or a scene unmounts; only HTTP errors and
        // failures of non-media assets are defects.
        if (n.kind === "failed" && /ERR_ABORTED/.test(n.why ?? "") && (/^blob:/.test(n.url) || /\.(mp3|ogg|wav|m4a)(\?|$)/.test(n.url))) continue;
        const asset = n.url.replace(/^https?:\/\/[^/]+\/[^/]+\/[^/]+/, "");
        add({ ...base, check: "asset-request", severity: "visual", claim: `${n.status ?? n.why} ${asset}`, key: `net|${asset}`, evidence: ev, state: row.state });
      }
      for (const t of textFindings(row)) add({ ...base, check: t.check, severity: "text", claim: `${t.why}: "${t.text}"`, key: `${t.check}|${t.text.slice(0, 40)}`, evidence: ev, state: row.state, inputs: row.inputs });
      if (row.state?.missingResource) add({ ...base, check: "missing-resource", severity: "visual", claim: row.state.missingResource, key: `missing|${row.state.missingResource}`, evidence: ev, state: row.state });
      if ((row.state?.missingTextures ?? 0) > 0) add({ ...base, check: "missing-texture", severity: "visual", claim: `화면에 그림 없는(__MISSING) 객체 ${row.state.missingTextures}개`, key: `mtex|${row.state.mapId}`, evidence: ev, state: row.state });
      if (/input-ignored$/.test(row.label ?? "")) add({ ...base, check: "input-mode-ignored", severity: "function", claim: `${job.input} 입력 6번에는 그대로였는데 Enter 한 번에 진행됨 (screen=${row.state?.screen} 대사/선택지=${(row.state?.choices ?? row.state?.dialogue ?? "").slice(0, 40)}) — 이 입력 방식이 여기서 무시되거나 QA 입력이 빗나감`, key: `ignored|${job.input}|${row.state?.mapId}|${(row.state?.choices ?? "").slice(0, 20)}`, evidence: ev, state: row.state, inputs: row.inputs });
      if (/stuck$/.test(row.label ?? "")) add({ ...base, check: "stuck", severity: "blocker", claim: `입력 6번에도 화면 상태가 바뀌지 않음 (screen=${row.state?.screen} map=${row.state?.mapId} dialogue=${(row.state?.dialogue ?? "").slice(0, 40)})`, key: `stuck|${row.state?.mapId}|${(row.state?.dialogue ?? "").slice(0, 30)}`, evidence: ev, state: row.state, inputs: row.inputs });
      // A dark frame is only a defect when nothing is being presented on it: game over / ending screens, narration over
      // black, and title cards are designed dark screens.
      const presented = ["gameover", "ending", "title"].includes(row.state?.screen) || !!row.state?.dialogue || !!row.state?.choices
        || (row.dom?.text ?? "").replace(/\b(ev|map)_[\w-]+/g, "").replace(/[⛶AB]|메뉴/g, "").trim().length > 12;
      if (row.darkMs >= 3500 && !presented) darkRun.push(row); else darkRun = [];
      if (darkRun.length === 1) add({ ...base, check: "black-screen", severity: "blocker", claim: `화면이 ${row.darkMs / 1000}초 넘게 검은색 (전환 프레임이 아니라 지속)`, key: `black|${row.state?.screen}|${row.state?.mapId}`, evidence: ev, state: row.state, inputs: row.inputs });
      for (const o of row.dom?.overflow ?? []) {
        if (!o.text || o.text.length < 2) continue;
        // An ellipsis is still a name the player cannot read; it is reported (as text severity) and the reviewer
        // decides whether that row is meant to truncate.
        const kind = o.offscreen ? "offscreen-ui" : o.ellipsis ? "text-ellipsized" : "text-clipped";
        add({ ...base, check: kind, severity: kind === "text-ellipsized" ? "text" : "visual", claim: `${o.el} 글자 "${o.text}" ${o.offscreen ? "화면 밖으로 나감" : "자기 상자에서 잘림"} rect=${o.rect.join(",")} (${job.viewportName})`, key: `${kind}|${o.el}|${o.text.slice(0, 24)}|${job.viewportName}`, evidence: ev, state: row.state, dom: o });
      }
      frames.push({ ...base, seq: row.seq, file: row.file, label: row.label, settled: row.settled, darkMs: row.darkMs, lum: row.lum, hash: row.hash, state: row.state, domText: row.dom?.text ?? "", inputs: row.inputs });
    }
    if (job.kind === "event" && summary?.result && summary.result.free && (summary.result.steps ?? 0) === 0 && (job.target?.kinds ?? []).some((k) => k === "text" || k === "choices" || k === "shop")) {
      add({ ...base, check: "event-no-response", severity: "function", claim: `이벤트 ${job.target.eventId} 를 실행했는데 대사·선택지·상점이 나오지 않았다 (페이지 ${job.target.page})`, key: `noresp|${job.target.eventId}`, evidence: rows.slice(0, 2).map((r) => frameRef(job, r)) });
    }
    if (job.kind === "battle" && summary?.result?.noBattle) {
      add({ ...base, check: "battle-not-started", severity: "function", claim: `체크포인트로 부대 ${job.target?.troopId} 전투를 시작했는데 전투 화면이 나오지 않았다(이벤트 페이지 조건이나 출발 연출 확인)`, key: `nobattle|${job.target?.troopId}`, evidence: rows.slice(-2).map((r) => frameRef(job, r)) });
    }
    if (job.script === "walk") {
      const walks = rows.filter((r) => /^walk-(up|right|down|left)$/.test(r.label ?? ""));
      if (walks.length === 4 && walks.every((r) => r.state?.screen === "field" && !r.state?.dialogue) && new Set(walks.map((r) => `${r.state?.x},${r.state?.y}`)).size === 1) {
        add({ ...base, check: "cannot-move", severity: "function", claim: `${job.target?.mapId} 입장 지점에서 네 방향 모두 한 칸도 못 움직임 (${walks[0].state?.x},${walks[0].state?.y})`, key: `nomove|${job.target?.mapId}`, evidence: walks.map((r) => frameRef(job, r)) });
      }
    }
  }
  return { findings, frames };
}

/** Collapse repeats of the same deterministic finding into one candidate with a count. */
export function groupDeterministic(findings) {
  const groups = new Map();
  for (const f of findings) {
    const key = `${f.game}|${f.check}|${f.key ?? f.claim.slice(0, 80)}`;
    const g = groups.get(key);
    if (g) { g.count += 1; g.jobs.add(f.jobId); if (g.evidence.length < 4) g.evidence.push(...(f.evidence ?? []).slice(0, 1)); }
    else groups.set(key, { ...f, count: 1, jobs: new Set([f.jobId]), evidence: [...(f.evidence ?? [])].slice(0, 3) });
  }
  return [...groups.values()].map((g) => ({ ...g, sessions: g.jobs.size, jobs: [...g.jobs].slice(0, 12) }));
}

/**
 * Text the player reads, checked without a model: mojibake (UTF-8 read as Latin-1), replacement characters,
 * authoring placeholders, raw ids leaking into dialogue. The DOM text is exactly what was printed.
 */
const TEXT_RULES = [
  { check: "garbled-text", re: /[\u00c2-\u00ef][\u0080-\u00bf\u0152-\u0192\u02c6\u02dc\u2013-\u203a\u20ac\u2122]{1,2}(?:[\u00c2-\u00ef][\u0080-\u00bf\u0152-\u0192\u02c6\u02dc\u2013-\u203a\u20ac\u2122]{1,2})+|\ufffd/u, why: "깨진 글자(모지바케·대체 문자)" },
  { check: "placeholder-text", re: /\b(?:TODO|TBD|FIXME|placeholder|lorem ipsum)\b|\{\{[^}]*\}\}|\$\{[^}]*\}/iu, why: "작성 중 자리표시 문구" },
  { check: "raw-id-text", re: /\b(?:ev|sw|item|actor|troop|map|var)_[a-z0-9_]{3,}\b/u, why: "내부 id 가 화면 글자로 노출" },
];
export function textFindings(row) {
  const visible = [row.state?.dialogue, row.state?.choices].filter(Boolean).join(" ");
  return TEXT_RULES.filter((rule) => rule.re.test(visible)).map((rule) => ({ check: rule.check, why: rule.why, text: visible.slice(0, 160) }));
}

/** Frames worth showing the vision observer: settled, not dark, one per perceptual-hash bucket per screen. */
export function selectForObserver(frames, { maxPerScreen = 400, hamming = 6 } = {}) {
  const kept = [];
  const seen = [];
  const dist = (a, b) => { let x = BigInt("0x" + a) ^ BigInt("0x" + b); let n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; };
  const perScreen = {};
  for (const f of frames) {
    if (!f.file || !f.hash) continue;
    if (!f.settled || (f.lum ?? 0) < 10) continue;
    if (f.state?.screen === "loading" || f.state?.screen === "unreadable") continue;
    const sk = f.state?.screen ?? "?";
    if ((perScreen[sk] ?? 0) >= maxPerScreen) continue;
    // Dialogue frames look alike at 8x8 but carry different lines; a new line is a new thing to read.
    const words = `${f.state?.dialogue ?? ""}|${f.state?.choices ?? ""}`.slice(0, 80);
    if (seen.some((s) => s.screen === sk && s.viewport === f.viewport && s.words === words && dist(s.hash, f.hash) <= hamming)) continue;
    seen.push({ screen: sk, viewport: f.viewport, hash: f.hash, words });
    perScreen[sk] = (perScreen[sk] ?? 0) + 1;
    kept.push(f);
  }
  return kept;
}
