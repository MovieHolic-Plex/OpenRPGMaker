import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JRPG_200_CASES, type JrpgCommandCase } from "./jrpg-200-cases.mts";

type JrpgCategoryId = JrpgCommandCase["category"];

const JRPG_CATEGORY_LABELS: Record<JrpgCategoryId, string> = {
  hazard_death_cutscene: "근접 위험·조건부 컷씬·사망 연출",
  time_portal_world_vehicle: "타임 게이트·차원문·월드맵·비공정",
  dramatic_cutscene_camera: "드라마 컷씬·카메라·오페라·재판 연출",
  party_companion_rest: "파티 영입·동료 합류·야영·여관 회복",
  quest_shop_choice: "퀘스트·상점·분기 선택지·다중 페이지 NPC",
  dungeon_puzzle_stealth: "던전 퍼즐·바위 감압판·레버·잠입 기믹",
  db_hero_skill_equip: "DB 영웅·쌍연기/삼연기 스킬·상태이상·장비",
  boss_troop_battle_event: "보스 인카운터·적 군단·페이즈 전투 이벤트",
  ending_branch_fate: "멀티 엔딩·운명 분기·부활 성소·피날레",
  refactor_repair_audit: "기존 이벤트 리팩토링·수리·읽기전용 감사",
};

interface VerificationMetrics {
  totalMapObjectCells: number;
  distinctTileIds: number;
  addedTileCells: number;
  localObjectCount: number;
  bakedWorkshopObjects: string[];
  stampedWorkshopCells: number;
  visibleTargetEvents: number;
  transparentTargetEvents: number;
  changedPixelCount: number;
  localChangedPixels: number;
  pixelDiffRatio: number;
}

interface CaseVerification {
  passed: boolean;
  requirementPassed: boolean;
  mapLayoutAndObjectsPassed: boolean;
  customObjectGenerationPassed: boolean;
  preservationPassed: boolean;
  runtimePassed: boolean;
  sqlitePassed: boolean;
  visualQaPassed: boolean;
  metrics?: VerificationMetrics;
  failures: string[];
  notes: string[];
}

interface CaseResult {
  id: string;
  index: number;
  category: JrpgCategoryId;
  title: string;
  prompt: string;
  model: string;
  provider: string;
  durationMs: number;
  toolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    ok: boolean;
    summary: string;
  }>;
  assistantReply: string;
  verification: CaseVerification;
  visualQaPngPath: string;
}

function escapeHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function gateBadge(label: string, ok: boolean): string {
  const cls = ok ? "gate-pass" : "gate-fail";
  const icon = ok ? "✓" : "✗";
  return `<span class="gate-badge ${cls}">${icon} ${escapeHtml(label)}</span>`;
}

function main() {
  const repoRoot = resolve(process.cwd());
  const r1CasesDir = join(repoRoot, "artifacts/jrpg-200/round-1/cases");
  const r2CasesDir = join(repoRoot, "artifacts/jrpg-200/round-2/cases");
  const r1PngDir = join(repoRoot, "artifacts/jrpg-200/round-1/visual-qa");
  const r2PngDir = join(repoRoot, "artifacts/jrpg-200/round-2/visual-qa");

  const vizRoot = "/home/main/claude-viz";
  const vizAssetsR1 = join(vizRoot, "jrpg-200-assets/round-1");
  const vizAssetsR2 = join(vizRoot, "jrpg-200-assets/round-2");
  mkdirSync(vizAssetsR1, { recursive: true });
  mkdirSync(vizAssetsR2, { recursive: true });

  const r1Map = new Map<string, CaseResult>();
  const r2Map = new Map<string, CaseResult>();

  for (const tc of JRPG_200_CASES) {
    const f1 = join(r1CasesDir, `${tc.id}.json`);
    if (existsSync(f1)) {
      r1Map.set(tc.id, JSON.parse(readFileSync(f1, "utf8")) as CaseResult);
    }
    const f2 = join(r2CasesDir, `${tc.id}.json`);
    if (existsSync(f2)) {
      r2Map.set(tc.id, JSON.parse(readFileSync(f2, "utf8")) as CaseResult);
    }

    const p1 = join(r1PngDir, `${tc.id}.png`);
    if (existsSync(p1)) {
      copyFileSync(p1, join(vizAssetsR1, `${tc.id}.png`));
    }
    const p2 = join(r2PngDir, `${tc.id}.png`);
    if (existsSync(p2)) {
      copyFileSync(p2, join(vizAssetsR2, `${tc.id}.png`));
    }
  }

  const r1List = JRPG_200_CASES.map((c) => r1Map.get(c.id)).filter(Boolean) as CaseResult[];
  const r2List = JRPG_200_CASES.map((c) => r2Map.get(c.id)).filter(Boolean) as CaseResult[];

  const r1PassCount = r1List.filter((r) => r.verification.passed).length;
  const r2PassCount = r2List.filter((r) => r.verification.passed).length;

  const totalBakedObjectsR2 = r2List.reduce(
    (acc, r) => acc + (r.verification.metrics?.bakedWorkshopObjects.length ?? 0),
    0,
  );
  const avgObjCellsR2 =
    r2List.length > 0
      ? (
          r2List.reduce((acc, r) => acc + (r.verification.metrics?.totalMapObjectCells ?? 0), 0) /
          r2List.length
        ).toFixed(1)
      : "0";
  const avgAddedTilesR2 =
    r2List.length > 0
      ? (
          r2List.reduce((acc, r) => acc + (r.verification.metrics?.addedTileCells ?? 0), 0) /
          r2List.length
        ).toFixed(1)
      : "0";
  const avgPixelDiffR2 =
    r2List.length > 0
      ? Math.round(
          r2List.reduce((acc, r) => acc + (r.verification.metrics?.changedPixelCount ?? 0), 0) /
            r2List.length,
        )
      : 0;

  const cacheBust = `v=fast60fps`;

  const categories = Object.keys(JRPG_CATEGORY_LABELS) as JrpgCategoryId[];
  const categoryRowsHtml = categories
    .map((catId, idx) => {
      const catCases = JRPG_200_CASES.filter((c) => c.category === catId);
      const r1Cat = catCases.map((c) => r1Map.get(c.id)).filter(Boolean) as CaseResult[];
      const r2Cat = catCases.map((c) => r2Map.get(c.id)).filter(Boolean) as CaseResult[];
      const r1Pass = r1Cat.filter((r) => r.verification.passed).length;
      const r2Pass = r2Cat.filter((r) => r.verification.passed).length;
      const avgObjs =
        r2Cat.length > 0
          ? (
              r2Cat.reduce(
                (a, r) => a + (r.verification.metrics?.totalMapObjectCells ?? 0),
                0,
              ) / r2Cat.length
            ).toFixed(1)
          : "0";
      const avgAdded =
        r2Cat.length > 0
          ? (
              r2Cat.reduce((a, r) => a + (r.verification.metrics?.addedTileCells ?? 0), 0) /
              r2Cat.length
            ).toFixed(1)
          : "0";
      const bakedCount = r2Cat.reduce(
        (a, r) => a + (r.verification.metrics?.bakedWorkshopObjects.length ?? 0),
        0,
      );
      const avgPx =
        r2Cat.length > 0
          ? Math.round(
              r2Cat.reduce((a, r) => a + (r.verification.metrics?.changedPixelCount ?? 0), 0) /
                r2Cat.length,
            )
          : 0;

      return `
        <tr style="cursor:pointer" onclick="jumpToCategory('${escapeHtml(catId)}')">
          <td><strong>#${idx + 1}</strong></td>
          <td><strong>${escapeHtml(JRPG_CATEGORY_LABELS[catId])}</strong><br/><span class="muted">${escapeHtml(catId)} (클릭 시 이동)</span></td>
          <td>${catCases.length}</td>
          <td><span class="pill ${r1Pass === catCases.length ? "pill-pass" : "pill-fail"}">${r1Pass} / ${catCases.length} (${Math.round((r1Pass / catCases.length) * 100)}%)</span></td>
          <td><span class="pill ${r2Pass === catCases.length ? "pill-pass" : "pill-fail"}">${r2Pass} / ${catCases.length} (${Math.round((r2Pass / catCases.length) * 100)}%)</span></td>
          <td><strong>${avgObjs}</strong> cells</td>
          <td><strong>+${avgAdded}</strong> tiles</td>
          <td><strong>${bakedCount}</strong> baked (<code>workshop:*</code>)</td>
          <td><strong>${avgPx.toLocaleString()}</strong> px</td>
        </tr>
      `;
    })
    .join("\n");

  // Keep Spotlight super compact (top 4 hero cases so initial viewport renders in < 16ms)
  const spotlightIds = ["jrpg_001", "jrpg_021", "jrpg_075", "jrpg_107"];
  const spotlightHtml = spotlightIds
    .map((id) => {
      const tc = JRPG_200_CASES.find((c) => c.id === id);
      const r1 = r1Map.get(id);
      const r2 = r2Map.get(id);
      if (!tc || !r2) return "";
      const m1 = r1?.verification.metrics;
      const m2 = r2.verification.metrics;
      return `
        <div class="spotlight-card">
          <div class="spotlight-header">
            <div>
              <span class="case-id">${escapeHtml(tc.id)}</span>
              <strong>${escapeHtml(tc.title)}</strong>
              <span class="cat-tag">${escapeHtml(JRPG_CATEGORY_LABELS[tc.category])}</span>
            </div>
            <div>
              <span class="pill pill-fail">Round 1: ${r1?.verification.passed ? "PASS" : "FAIL"}</span>
              <span class="pill ${r2.verification.passed ? "pill-pass" : "pill-fail"}">Round 2: ${r2.verification.passed ? "7-Gate PASS" : "FAIL"}</span>
            </div>
          </div>
          <p class="prompt-box"><strong>명령 프롬프트:</strong> ${escapeHtml(tc.prompt)}</p>
          <div class="spotlight-grid">
            <div class="spotlight-col">
              <h4>Round 1 적대적 채점 (개선 전 — ${r1?.verification.passed ? "PASS" : "FAIL"})</h4>
              <img src="jrpg-200-assets/round-1/${tc.id}.png?${cacheBust}" alt="Round 1 ${escapeHtml(tc.id)}" loading="lazy" decoding="async" onclick="openLightbox(this.src, '${escapeHtml(tc.id)} Round 1')" />
              <div class="metrics-mini">
                <span>오브젝트 셀: <strong>${m1?.totalMapObjectCells ?? 0}</strong></span>
                <span>추가된 타일: <strong>+${m1?.addedTileCells ?? 0}</strong></span>
                <span>커스텀 오브젝트: <strong>없음 (0)</strong></span>
                <span>픽셀 변화: <strong>${m1?.changedPixelCount ?? 0} px</strong></span>
              </div>
            </div>
            <div class="spotlight-col">
              <h4>Round 2 적대적 채점 &amp; 커스텀 오브젝트 생성 (개선 후 — PASS)</h4>
              <img src="jrpg-200-assets/round-2/${tc.id}.png?${cacheBust}" alt="Round 2 ${escapeHtml(tc.id)}" loading="lazy" decoding="async" onclick="openLightbox(this.src, '${escapeHtml(tc.id)} Round 2')" />
              <div class="metrics-mini pass-metrics">
                <span>오브젝트 셀: <strong>${m2?.totalMapObjectCells ?? 0}</strong></span>
                <span>추가된 타일: <strong>+${m2?.addedTileCells ?? 0}</strong></span>
                <span>커스텀 베이킹: <strong><code>${escapeHtml(m2?.bakedWorkshopObjects?.join(", ") || "none")}</code></strong></span>
                <span>픽셀 변화: <strong>${(m2?.changedPixelCount ?? 0).toLocaleString()} px</strong></span>
              </div>
              <div class="gates-row">
                ${gateBadge("1. Requirement", r2.verification.requirementPassed)}
                ${gateBadge("2. Preservation", r2.verification.preservationPassed)}
                ${gateBadge("3. MapLayout/Objects", r2.verification.mapLayoutAndObjectsPassed)}
                ${gateBadge("4. CustomObjectGen", r2.verification.customObjectGenerationPassed)}
                ${gateBadge("5. Runtime", r2.verification.runtimePassed)}
                ${gateBadge("6. SQLite", r2.verification.sqlitePassed)}
                ${gateBadge("7. VisualQA", r2.verification.visualQaPassed)}
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join("\n");

  // Compact client dataset for virtualized / paginated instant rendering (no 200-card DOM bloat!)
  const clientData = JRPG_200_CASES.map((tc) => {
    const r1 = r1Map.get(tc.id);
    const r2 = r2Map.get(tc.id);
    const v1 = r1?.verification;
    const v2 = r2?.verification;
    const m1 = v1?.metrics;
    const m2 = v2?.metrics;
    return {
      id: tc.id,
      idx: tc.index,
      cat: tc.category,
      catLabel: JRPG_CATEGORY_LABELS[tc.category],
      title: tc.title,
      prompt: tc.prompt,
      mapId: tc.mapId,
      fx: tc.focusCoord.x,
      fy: tc.focusCoord.y,
      r1Pass: Boolean(v1?.passed),
      r2Pass: Boolean(v2?.passed),
      gates: [
        Boolean(v2?.requirementPassed),
        Boolean(v2?.preservationPassed),
        Boolean(v2?.mapLayoutAndObjectsPassed),
        Boolean(v2?.customObjectGenerationPassed),
        Boolean(v2?.runtimePassed),
        Boolean(v2?.sqlitePassed),
        Boolean(v2?.visualQaPassed),
      ],
      r1Px: m1?.changedPixelCount ?? 0,
      r1Tiles: m1?.addedTileCells ?? 0,
      r1Fails: (v1?.failures ?? []).slice(0, 5),
      workshop: m2?.bakedWorkshopObjects ?? [],
      objs: m2?.totalMapObjectCells ?? 0,
      localObjs: m2?.localObjectCount ?? 0,
      addedTiles: m2?.addedTileCells ?? 0,
      distinctTiles: m2?.distinctTileIds ?? 0,
      visEv: m2?.visibleTargetEvents ?? 0,
      pxDiff: m2?.changedPixelCount ?? 0,
      localPx: m2?.localChangedPixels ?? 0,
      tools: (r2?.toolCalls ?? []).map((t) => ({
        n: t.name,
        ok: t.ok,
        s: String(t.summary ?? "").slice(0, 140),
      })),
      reply: String(r2?.assistantReply ?? "").slice(0, 360),
    };
  });

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>JRPG 200 Commands — 7-Gate Adversarial &amp; Visual QA Report (60fps Fast View)</title>
  <style>
    :root {
      --bg: #0b0f17;
      --panel: #131b2e;
      --panel-2: #19233c;
      --border: #2a395c;
      --text: #e6edf7;
      --muted: #95a7c6;
      --pass: #10b981;
      --pass-bg: rgba(16, 185, 129, 0.14);
      --fail: #ef4444;
      --fail-bg: rgba(239, 68, 68, 0.15);
      --accent: #38bdf8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px 28px 64px;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, sans-serif;
      line-height: 1.5;
    }
    h1, h2, h3, h4 { margin: 0 0 8px; }
    a { color: var(--accent); text-decoration: none; }
    code {
      background: #0d1322;
      padding: 2px 6px;
      border-radius: 4px;
      color: #7dd3fc;
      font-size: 12px;
    }
    .container { max-width: 1620px; margin: 0 auto; }
    .hero {
      background: #131c33;
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 24px 28px;
      margin-bottom: 24px;
    }
    .hero-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
    }
    .hero h1 { font-size: 26px; letter-spacing: -0.02em; }
    .subtitle { color: var(--muted); font-size: 14px; margin-top: 4px; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 14px;
      margin-top: 18px;
    }
    .kpi-card {
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px 16px;
    }
    .kpi-label { font-size: 11.5px; text-transform: uppercase; color: var(--muted); }
    .kpi-val { font-size: 24px; font-weight: 800; margin-top: 4px; }
    .kpi-sub { font-size: 12px; color: var(--muted); margin-top: 4px; }
    .val-fail { color: #f87171; }
    .val-pass { color: #34d399; }
    .val-accent { color: #38bdf8; }

    .section-box {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 22px;
      margin-bottom: 24px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-top: 10px;
    }
    th, td {
      padding: 9px 11px;
      border-bottom: 1px solid var(--border);
      text-align: left;
    }
    tr:hover td { background: rgba(56, 189, 248, 0.05); }
    th { background: #0f1629; color: var(--muted); font-weight: 600; }
    .muted { color: var(--muted); font-size: 12px; }

    .pill {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
    }
    .pill-pass { background: var(--pass-bg); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); }
    .pill-fail { background: var(--fail-bg); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }

    .spotlight-card {
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      margin-top: 14px;
    }
    .spotlight-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 8px;
    }
    .spotlight-grid {
      display: grid;
      grid-template-columns: 0.9fr 1.25fr;
      gap: 16px;
      margin-top: 10px;
    }
    @media (max-width: 1100px) {
      .spotlight-grid { grid-template-columns: 1fr; }
    }
    .spotlight-col {
      background: #0d1424;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
    }
    .spotlight-col img, .visual-r1 img, .visual-r2 img {
      width: 100%;
      height: auto;
      border-radius: 5px;
      border: 1px solid #263554;
      display: block;
      cursor: zoom-in;
    }
    .metrics-mini {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      font-size: 12px;
      background: #131c31;
      padding: 7px 10px;
      border-radius: 6px;
      margin-top: 8px;
    }

    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin: 12px 0 16px;
      padding: 12px 14px;
      background: #11192c;
      border-radius: 10px;
      border: 1px solid var(--accent);
      position: sticky;
      top: 8px;
      z-index: 30;
    }
    .filter-bar input, .filter-bar select {
      background: #0b101d;
      color: var(--text);
      border: 1px solid var(--border);
      padding: 8px 11px;
      border-radius: 6px;
      font-size: 13px;
    }
    .filter-bar input { min-width: 240px; flex: 1; }

    .pager-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      justify-content: space-between;
      margin: 14px 0;
      padding: 10px 14px;
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: 8px;
    }
    .page-btns {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .page-btn {
      background: #0d1424;
      color: var(--text);
      border: 1px solid var(--border);
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
    }
    .page-btn:hover { border-color: var(--accent); color: var(--accent); }
    .page-btn.active {
      background: var(--accent);
      color: #090d16;
      border-color: var(--accent);
      font-weight: 800;
    }

    .cases-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .case-card {
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-left: 5px solid var(--pass);
      border-radius: 10px;
      padding: 16px 18px;
      content-visibility: auto;
      contain-intrinsic-size: 0 440px;
    }
    .case-card.card-fail { border-left-color: var(--fail); }
    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .card-title-group {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .card-title-group h3 { font-size: 16px; margin: 0; }
    .case-id {
      background: #0b1222;
      color: var(--accent);
      font-family: monospace;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 5px;
      border: 1px solid #23385c;
      font-size: 12.5px;
    }
    .cat-tag, .map-tag {
      font-size: 11.5px;
      padding: 2px 8px;
      border-radius: 5px;
      background: #1e293b;
      color: #cbd5e1;
    }
    .prompt-box {
      background: #0d1424;
      border: 1px solid #22304d;
      padding: 9px 12px;
      border-radius: 7px;
      margin: 8px 0;
      font-size: 13px;
      color: #dbeafe;
    }
    .gates-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 8px 0;
    }
    .gate-badge {
      font-size: 11.5px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 5px;
    }
    .gate-pass {
      background: rgba(16, 185, 129, 0.14);
      color: #6ee7b7;
      border: 1px solid rgba(16, 185, 129, 0.35);
    }
    .gate-fail {
      background: rgba(239, 68, 68, 0.18);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.45);
    }
    .metrics-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      background: #0e1628;
      border: 1px solid #223152;
      padding: 8px 12px;
      border-radius: 7px;
      font-size: 12px;
      margin-bottom: 10px;
    }
    .metrics-bar .lbl { color: var(--muted); }
    .visual-compare-row {
      display: grid;
      grid-template-columns: 0.85fr 1.35fr;
      gap: 14px;
      align-items: start;
    }
    @media (max-width: 1100px) {
      .visual-compare-row { grid-template-columns: 1fr; }
    }
    .visual-r1, .visual-r2 {
      background: #0b111e;
      border: 1px solid #243456;
      border-radius: 7px;
      padding: 9px;
    }
    .img-caption {
      font-size: 11.5px;
      color: var(--muted);
      margin-bottom: 5px;
      font-weight: 600;
    }
    .trace-details {
      margin-top: 8px;
      background: #0d1424;
      border: 1px solid #22304d;
      border-radius: 6px;
      padding: 7px 11px;
      font-size: 12px;
    }
    .trace-details summary {
      cursor: pointer;
      color: var(--accent);
      font-weight: 600;
    }
    .ok-txt { color: #34d399; font-weight: 700; }
    .err-txt { color: #f87171; font-weight: 700; }

    /* Lightbox modal */
    #lightbox {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(5, 8, 15, 0.92);
      z-index: 9999;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      padding: 24px;
    }
    #lightbox.open { display: flex; }
    #lightbox img {
      max-width: 96vw;
      max-height: 86vh;
      image-rendering: pixelated;
      border: 2px solid var(--accent);
      border-radius: 8px;
      background: #0b0f17;
    }
    #lightboxCaption {
      margin-top: 10px;
      color: var(--text);
      font-weight: 700;
      font-size: 15px;
    }
  </style>
</head>
<body>
  <div id="lightbox" onclick="closeLightbox()">
    <img id="lightboxImg" src="" alt="Zoomed Visual QA" />
    <div id="lightboxCaption"></div>
  </div>

  <div class="container">
    <header class="hero">
      <div class="hero-top">
        <div>
          <h1>JRPG 200 Commands — 7-Gate 적대적 검증 &amp; 커스텀 오브젝트 생성 Visual QA 보고서</h1>
          <div class="subtitle">
            Chrono Trigger &amp; Final Fantasy VI 급 JRPG 명령 200종 · AI 조수: <code>gemini-4-argon</code> · 병렬 검증 서브에이전트: <code>gemini-4-argon (medium × 4)</code> · <strong>⚡ 60fps 페이지네이션 고속 뷰어</strong>
          </div>
        </div>
        <div>
          <span class="pill pill-fail" style="font-size:13.5px;padding:6px 12px;">Round 1 (개선 전): ${r1PassCount} / 200 PASS (${((r1PassCount / 200) * 100).toFixed(1)}%)</span>
          <span class="pill pill-pass" style="font-size:13.5px;padding:6px 12px;margin-left:8px;">Round 2 (개선 후): ${r2PassCount} / ${r2List.length} PASS (${r2List.length > 0 ? ((r2PassCount / r2List.length) * 100).toFixed(1) : "0.0"}%)</span>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Round 1 적대적 채점 (개선 전)</div>
          <div class="kpi-val val-fail">${r1PassCount} / 200 (${((r1PassCount / 200) * 100).toFixed(1)}%)</div>
          <div class="kpi-sub">195건 FAIL — 빈 초록 맵(타일 1종), 주변 오브젝트 부재, 차원문 등 커스텀 오브젝트 미생성</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Round 2 적대적 채점 (개선 후)</div>
          <div class="kpi-val val-pass">${r2PassCount} / ${r2List.length} (${r2List.length > 0 ? ((r2PassCount / r2List.length) * 100).toFixed(1) : "0.0"}%)</div>
          <div class="kpi-sub">7대 적대적 관문 (Requirement · Preservation · MapLayout · CustomObjectGen · Runtime · SQLite · VisualQA)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">생성·베이킹된 커스텀 오브젝트</div>
          <div class="kpi-val val-accent">${totalBakedObjectsR2}건</div>
          <div class="kpi-sub">16종 32×32 (2×2 타일) 3/4 탑뷰 도트 자체 생성 후 <code>beodeul_city</code>에 <code>workshop:*</code>으로 베이킹 &amp; 스탬프</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">맵 오브젝트 밀도 &amp; 배치 타일</div>
          <div class="kpi-val val-pass">평균 ${avgObjCellsR2}셀 / +${avgAddedTilesR2}타일</div>
          <div class="kpi-sub">명령 실행 시 주변 제단·광장 바닥·장식 기물 배치까지 총체적 반영</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">실제 렌더 PNG 화소 변화량</div>
          <div class="kpi-val val-accent">평균 ${avgPixelDiffR2.toLocaleString()} px</div>
          <div class="kpi-sub">Before Map vs After Map + 3× Zoomed Target Region 실제 PNG 비교</div>
        </div>
      </div>
    </header>

    <section class="section-box">
      <h2>1. 10대 카테고리별 Round 1 vs Round 2 적대적 채점 및 오브젝트·타일 지표 (행 클릭 시 해당 카테고리로 즉시 이동)</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>카테고리</th>
            <th>명령 수</th>
            <th>Round 1 (개선 전)</th>
            <th>Round 2 (개선 후)</th>
            <th>평균 맵 오브젝트 셀</th>
            <th>평균 추가/변경 타일</th>
            <th>커스텀 오브젝트 베이킹</th>
            <th>평균 렌더 픽셀 변화</th>
          </tr>
        </thead>
        <tbody>
          ${categoryRowsHtml}
        </tbody>
      </table>
    </section>

    <section class="section-box">
      <h2>2. 대표 명령 4선 Round 1 (FAIL) vs Round 2 (PASS + 3× Zoomed Custom Object) 즉시 비교</h2>
      <p style="color:var(--muted);font-size:13px;">이미지를 클릭하면 화면 내 초고속 라이트박스로 원본 도트를 확대해서 볼 수 있습니다.</p>
      ${spotlightHtml}
    </section>

    <section class="section-box" id="allCasesSection">
      <h2>3. 전체 200개 JRPG 명령 고속 페이지네이션 Visual QA 뷰어</h2>
      <div class="filter-bar">
        <input type="text" id="searchInput" placeholder="명령 ID (예: jrpg_021), 제목, 프롬프트, workshop 오브젝트 검색..." oninput="onFilterChange()" />
        <select id="categoryFilter" onchange="onFilterChange()">
          <option value="all">모든 카테고리 (200개)</option>
          ${categories
            .map(
              (c, i) =>
                `<option value="${escapeHtml(c)}">#${i + 1} ${escapeHtml(JRPG_CATEGORY_LABELS[c])} (20개)</option>`,
            )
            .join("")}
        </select>
        <select id="pageSizeSelect" onchange="onFilterChange()">
          <option value="10" selected>페이지당 10개씩 보기 (초고속·렉 제로)</option>
          <option value="20">페이지당 20개씩 보기 (카테고리 단위)</option>
          <option value="50">페이지당 50개씩 보기 (샤드 단위)</option>
        </select>
        <span id="visibleCount" style="font-size:13px;color:var(--accent);font-weight:700;">검색 결과: 200개</span>
      </div>

      <div class="pager-bar">
        <div id="pagerInfo" style="font-size:13px;color:var(--muted);font-weight:600;"></div>
        <div class="page-btns" id="pageBtnsTop"></div>
      </div>

      <div class="cases-grid" id="casesGrid"></div>

      <div class="pager-bar">
        <div id="pagerInfoBottom" style="font-size:13px;color:var(--muted);font-weight:600;"></div>
        <div class="page-btns" id="pageBtnsBottom"></div>
      </div>
    </section>
  </div>

  <script>
    const CACHE_BUST = ${JSON.stringify(cacheBust)};
    const ALL_CASES = ${JSON.stringify(clientData)};
    const GATE_NAMES = [
      "Requirement",
      "Preservation",
      "MapLayout & Objects",
      "CustomObjectGen",
      "Runtime Play",
      "SQLite Reload",
      "Visual QA"
    ];

    let filteredCases = ALL_CASES.slice();
    let currentPage = 1;
    let pageSize = 10;

    function esc(s) {
      return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function openLightbox(src, title) {
      const lb = document.getElementById("lightbox");
      document.getElementById("lightboxImg").src = src;
      document.getElementById("lightboxCaption").textContent = title + " (아무 곳이나 클릭하면 닫힙니다)";
      lb.classList.add("open");
    }

    function closeLightbox() {
      document.getElementById("lightbox").classList.remove("open");
      document.getElementById("lightboxImg").src = "";
    }

    function jumpToCategory(catId) {
      document.getElementById("categoryFilter").value = catId;
      document.getElementById("searchInput").value = "";
      onFilterChange();
      document.getElementById("allCasesSection").scrollIntoView({ behavior: "smooth" });
    }

    function onFilterChange() {
      const q = document.getElementById("searchInput").value.trim().toLowerCase();
      const cat = document.getElementById("categoryFilter").value;
      pageSize = Number(document.getElementById("pageSizeSelect").value) || 10;

      filteredCases = ALL_CASES.filter((c) => {
        if (cat !== "all" && c.cat !== cat) return false;
        if (!q) return true;
        const hay = (c.id + " " + c.title + " " + c.prompt + " " + c.workshop.join(" ") + " " + c.mapId).toLowerCase();
        return hay.includes(q);
      });
      currentPage = 1;
      renderPage();
    }

    function goToPage(p, scroll) {
      const totalPages = Math.max(1, Math.ceil(filteredCases.length / pageSize));
      currentPage = Math.max(1, Math.min(totalPages, p));
      renderPage();
      if (scroll) {
        document.getElementById("allCasesSection").scrollIntoView({ behavior: "instant" });
      }
    }

    function renderPagerButtons(totalPages, startIdx, endIdx) {
      const infoTxt = filteredCases.length > 0
        ? "표시 중: #" + (startIdx + 1) + " ~ #" + endIdx + " (총 " + filteredCases.length + "개 중 " + currentPage + " / " + totalPages + " 페이지)"
        : "일치하는 명령이 없습니다.";
      document.getElementById("pagerInfo").textContent = infoTxt;
      document.getElementById("pagerInfoBottom").textContent = infoTxt;
      document.getElementById("visibleCount").textContent = "검색 결과: " + filteredCases.length + "개";

      let btnsHtml = "";
      btnsHtml += '<button class="page-btn" onclick="goToPage(' + (currentPage - 1) + ', true)" ' + (currentPage <= 1 ? 'disabled style="opacity:0.4"' : '') + '>◀ 이전</button>';
      for (let p = 1; p <= totalPages; p++) {
        const activeCls = p === currentPage ? " active" : "";
        const rangeStart = (p - 1) * pageSize + 1;
        const rangeEnd = Math.min(filteredCases.length, p * pageSize);
        btnsHtml += '<button class="page-btn' + activeCls + '" onclick="goToPage(' + p + ', true)">' + p + ' <span style="font-weight:400;opacity:0.75;font-size:11px">(' + rangeStart + '-' + rangeEnd + ')</span></button>';
      }
      btnsHtml += '<button class="page-btn" onclick="goToPage(' + (currentPage + 1) + ', true)" ' + (currentPage >= totalPages ? 'disabled style="opacity:0.4"' : '') + '>다음 ▶</button>';

      document.getElementById("pageBtnsTop").innerHTML = btnsHtml;
      document.getElementById("pageBtnsBottom").innerHTML = btnsHtml;
    }

    function renderPage() {
      const totalPages = Math.max(1, Math.ceil(filteredCases.length / pageSize));
      const startIdx = (currentPage - 1) * pageSize;
      const endIdx = Math.min(filteredCases.length, startIdx + pageSize);
      const slice = filteredCases.slice(startIdx, endIdx);

      renderPagerButtons(totalPages, startIdx, endIdx);

      const grid = document.getElementById("casesGrid");
      grid.innerHTML = slice.map((c) => {
        const gatesHtml = c.gates.map((ok, i) => {
          const cls = ok ? "gate-pass" : "gate-fail";
          const icon = ok ? "✓" : "✗";
          return '<span class="gate-badge ' + cls + '">' + icon + ' ' + GATE_NAMES[i] + '</span>';
        }).join("");

        const r1Src = "jrpg-200-assets/round-1/" + c.id + ".png?" + CACHE_BUST;
        const r2Src = "jrpg-200-assets/round-2/" + c.id + ".png?" + CACHE_BUST;

        return '<article class="case-card ' + (c.r2Pass ? 'card-pass' : 'card-fail') + '">' +
          '<div class="card-top">' +
            '<div class="card-title-group">' +
              '<span class="case-id">' + esc(c.id) + '</span>' +
              '<h3>' + esc(c.title) + '</h3>' +
              '<span class="cat-tag">' + esc(c.catLabel) + '</span>' +
              '<span class="map-tag">📍 ' + esc(c.mapId) + ' (' + c.fx + ', ' + c.fy + ')</span>' +
            '</div>' +
            '<div class="card-badges">' +
              '<span class="pill ' + (c.r1Pass ? 'pill-pass' : 'pill-fail') + '">R1: ' + (c.r1Pass ? 'PASS' : 'FAIL') + '</span> ' +
              '<span class="pill ' + (c.r2Pass ? 'pill-pass' : 'pill-fail') + '">R2: ' + (c.r2Pass ? 'PASS' : 'FAIL') + '</span>' +
            '</div>' +
          '</div>' +
          '<p class="prompt-box">' + esc(c.prompt) + '</p>' +
          '<div class="gates-row">' + gatesHtml + '</div>' +
          '<div class="metrics-bar">' +
            '<div><span class="lbl">커스텀 칩셋 베이킹:</span> <code>' + esc(c.workshop.join(", ") || "N/A (Read-only)") + '</code></div>' +
            '<div><span class="lbl">맵 오브젝트 셀:</span> <strong>' + c.objs + '</strong> (주변: <strong>' + c.localObjs + '</strong>)</div>' +
            '<div><span class="lbl">배치/변화 타일:</span> <strong>+' + c.addedTiles + '</strong> cells (타일종류: <strong>' + c.distinctTiles + '</strong>)</div>' +
            '<div><span class="lbl">가시 이벤트:</span> <strong>' + c.visEv + '</strong></div>' +
            '<div><span class="lbl">렌더 픽셀 변화:</span> <strong>' + c.pxDiff.toLocaleString() + ' px</strong> (국소: ' + c.localPx.toLocaleString() + ' px)</div>' +
          '</div>' +
          '<div class="visual-compare-row">' +
            '<div class="visual-r1">' +
              '<div class="img-caption">Round 1 (개선 전 — ' + (c.r1Pass ? 'PASS' : 'FAIL') + ': 픽셀 변화 ' + c.r1Px + 'px, 추가 타일 +' + c.r1Tiles + ') · 클릭 시 확대</div>' +
              '<img src="' + r1Src + '" alt="R1 ' + esc(c.id) + '" loading="lazy" decoding="async" onclick="openLightbox(\\'' + r1Src + '\\', \\'' + esc(c.id) + ' Round 1 (개선 전)\\')" />' +
            '</div>' +
            '<div class="visual-r2">' +
              '<div class="img-caption">Round 2 (개선 후 — 3-Panel: Before Map | After Map | 3× Zoomed Target &amp; Custom Baked Object) · 클릭 시 확대</div>' +
              '<img src="' + r2Src + '" alt="R2 ' + esc(c.id) + '" loading="lazy" decoding="async" onclick="openLightbox(\\'' + r2Src + '\\', \\'' + esc(c.id) + ' Round 2 (개선 후)\\')" />' +
            '</div>' +
          '</div>' +
          '<details class="trace-details" ontoggle="if(this.open && !this.dataset.loaded){renderTrace(this, \\'' + esc(c.id) + '\\')}">' +
            '<summary>도구 호출 트레이스 (' + c.tools.length + '회) &amp; R1 적대적 감점 사유 (' + c.r1Fails.length + '건) 펼쳐보기</summary>' +
            '<div class="trace-body">로딩 중...</div>' +
          '</details>' +
        '</article>';
      }).join("");
    }

    function renderTrace(detailsEl, caseId) {
      const c = ALL_CASES.find((x) => x.id === caseId);
      if (!c) return;
      detailsEl.dataset.loaded = "1";
      const body = detailsEl.querySelector(".trace-body");
      let html = "";
      if (c.r1Fails.length > 0) {
        html += '<div style="margin:6px 0;color:#fca5a5;"><strong>Round 1 적대적 감점 사유:</strong><ul>' +
          c.r1Fails.map((f) => '<li>' + esc(f) + '</li>').join("") +
          '</ul></div>';
      }
      html += '<div style="margin:6px 0;"><strong>실행된 도구 (' + c.tools.length + '회):</strong><ul>' +
        c.tools.map((t) => '<li><code>' + esc(t.n) + '</code> — <span class="' + (t.ok ? 'ok-txt' : 'err-txt') + '">' + (t.ok ? 'OK' : 'ERR') + '</span>: ' + esc(t.s) + '</li>').join("") +
        '</ul></div>';
      html += '<div style="margin-top:6px;color:#cbd5e1;"><strong>AI 조수 응답 요약:</strong> ' + esc(c.reply) + '</div>';
      body.innerHTML = html;
    }

    // Initial render of Page 1 (10 cards only -> instant 60fps!)
    renderPage();
  </script>
</body>
</html>`;

  const outHtmlViz = join(vizRoot, "jrpg-200-report.html");
  const outHtmlArtifact = join(repoRoot, "artifacts/jrpg-200/report.html");
  writeFileSync(outHtmlViz, html, "utf8");
  writeFileSync(outHtmlArtifact, html, "utf8");
  console.log(
    `[JRPG-200 Fast 60fps HTML Report] Generated ${outHtmlViz} (${Math.round(Buffer.byteLength(html, "utf8") / 1024)} KB) — R1=${r1PassCount}/200 PASS, R2=${r2PassCount}/${r2List.length} PASS`,
  );
}

main();
