import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import Jimp from "jimp";
const DIR = process.env.ADV_OUT ?? "/tmp/adv-tile-qa";
const files = readdirSync(DIR).filter((f) => /^\d\d-[a-z0-9-]+\.json$/.test(f)).sort();
const FAIL_RE = /실행 실패|검증 실패|찾지 못했습니다|실패\(|오류|거부/u;
const rows = [];
const details = [];
for (const f of files) {
  const r = JSON.parse(readFileSync(`${DIR}/${f}`, "utf8"));
  const turns = r.turns ?? [];
  const allTools = turns.flatMap((t) => t.tools ?? []);
  const failed = allTools.filter((t) => FAIL_RE.test(t.summary ?? ""));
  const writes = allTools.filter((t) => /fill_region|paint_tiles|paint_road|lay_path|place_props|build_wall|clear_region|tile_erase|place_concept|author_|stamp_|set_tile_passability|mirror_region|copy_map_region|resize_map|create_map/.test(t.name ?? ""));
  const elapsed = turns.reduce((a, t) => a + (t.elapsedMs ?? 0), 0);
  const llm = turns.reduce((a, t) => a + (t.llmCalls ?? 0), 0);
  const lastText = turns.length ? (turns[turns.length - 1].assistantTexts ?? []).filter(Boolean).slice(-1)[0] ?? "" : "";
  const d = r.diff ?? {};
  rows.push({
    id: r.id, boot: r.boot, prompt: r.prompt, elapsedS: Math.round(elapsed / 1000), llm, tools: allTools.length, failed: failed.length,
    changes: d.total ?? 0, lower: d.lower ?? 0, upper: d.upper ?? 0, inside: d.inside, outside: d.outside, regionCells: d.regionCells,
    tiles: Object.entries(d.hist ?? {}).map(([k, v]) => `${k}×${v}`).join(" "),
    pass: r.passability ? `${r.passability.before}→${r.passability.after}` : "",
    chip: r.chip ? `dom=${r.chip.inDom} vis=${r.chip.visible} host=${r.chip.hostDisplay}` : (r.region ? "n/a" : ""),
    startChanged: r.start?.startCellChanged ?? null, startNeigh: r.start?.neighbourPassableAfter ?? null,
    events: (r.eventsCovered ?? []).length, undo: r.undo ? `${r.undo.clicked ?? "none"} residual=${r.undo.residualChanges}` : "",
    fourConn: r.lowerFourConnected, timedOut: turns.some((t) => t.timedOut), lastText,
  });
  details.push(`## ${f.replace(/\.json$/, "")} — ${r.title}\n\n- 프롬프트: 「${r.prompt}」 (boot=${r.boot}, 맵 ${r.map?.name} ${r.map?.size}, 시작 ${JSON.stringify(r.map?.startPos)})\n- 기대: ${r.expect}\n- 선택 영역: ${JSON.stringify(r.region)} · 칩 ${r.chip ? JSON.stringify(r.chip) : "-"} · 칩해제=${r.chipClearedOk}\n- 시간 ${Math.round(elapsed / 1000)}s · LLM ${llm}회 · 툴 ${allTools.length}회(실패 ${failed.length}) · 변경 ${d.total}칸 (lower ${d.lower}/upper ${d.upper}, 안 ${d.inside}/밖 ${d.outside}, 영역 ${d.regionCells}칸) · 타일 ${rows[rows.length - 1].tiles} · bbox ${JSON.stringify(d.bbox)}\n- 통행(영역/시작주변) ${rows[rows.length - 1].pass} · 시작칸 변경 ${r.start?.startCellChanged} · 시작 이웃 통행 ${JSON.stringify(r.start?.neighbourPassableAfter)} · 이벤트 덮음 ${JSON.stringify(r.eventsCovered)} · lower 4연결 ${r.lowerFourConnected}\n- 되돌리기: ${r.undo ? JSON.stringify(r.undo) : "-"} · 맵 수 ${r.mapsAfter?.length}\n${turns.map((t, i) => `- 턴${i + 1} 「${t.text}」 ${Math.round((t.elapsedMs ?? 0) / 1000)}s${t.timedOut ? " ⏰TIMEOUT" : ""}\n${(t.tools ?? []).map((x) => `    - ${FAIL_RE.test(x.summary ?? "") ? "✗" : "·"} ${x.name}: ${(x.summary ?? "").slice(0, 230)}`).join("\n")}\n    - 조수: ${(t.assistantTexts ?? []).filter(Boolean).slice(-1)[0]?.replace(/\n+/g, " ").slice(0, 500) ?? "(없음)"}\n    - 라우팅: ${(t.statuses ?? []).filter((s) => /intent:llm|planner|volume|clarify|의도 확인/.test(s)).map((s) => s.slice(0, 160)).join(" | ")}`).join("\n")}\n`);
  // 3x zoom crops
  for (const suffix of ["0before-zoom", "1after-zoom", "2undo-zoom"]) {
    const p = `${DIR}/${f.replace(/\.json$/, "")}-${suffix}.png`;
    if (existsSync(p)) {
      try {
        const img = await Jimp.read(p);
        img.resize(img.bitmap.width * 3, img.bitmap.height * 3, Jimp.RESIZE_NEAREST_NEIGHBOR);
        await img.writeAsync(p.replace(/\.png$/, "@3x.png"));
      } catch (e) { console.error("zoom fail", p, String(e).slice(0, 100)); }
    }
  }
}
const header = "| # | 케이스 | 프롬프트 | 시간 | LLM | 툴(실패) | 변경칸 (lower/upper) | 안/밖 | 통행 | 타일 | 비고 |\n|---|---|---|---|---|---|---|---|---|---|---|";
const table = rows.map((r, i) => `| ${String(i + 1).padStart(2, "0")} | ${r.id} | ${r.prompt.replace(/\|/g, "／")} | ${r.elapsedS}s | ${r.llm} | ${r.tools}(${r.failed}) | ${r.changes} (${r.lower}/${r.upper}) | ${r.inside ?? "-"}/${r.outside ?? "-"} | ${r.pass} | ${r.tiles} | ${[r.timedOut ? "⏰" : "", r.startChanged ? "시작칸 변경" : "", r.events ? `이벤트 ${r.events}` : "", r.undo].filter(Boolean).join(" ")} |`).join("\n");
writeFileSync(`${DIR}/SUMMARY.md`, `# 적대적 타일 QA 실측 요약\n\n${header}\n${table}\n\n${details.join("\n")}`, "utf8");
console.log(`${header}\n${table}`);
