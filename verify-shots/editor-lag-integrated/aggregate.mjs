import fs from "node:fs";
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]};
const runs={before:[],after:[]};
for(const s of Object.keys(runs))for(let r=1;r<=3;r++)runs[s].push(JSON.parse(fs.readFileSync(`raw/${s}-${r}.json`)));
const metrics={
 cold_ready_ms:j=>j.s1_cold.readyMs,
 cold_longtask_total_ms:j=>j.s1_cold.long.totalMs,
 cold_net_MB:j=>j.s1_cold.netMB,
 warm_ready_ms:j=>Math.min(j.s1_warm.readyMs,j.s1_warm2.readyMs),
 warm_longtask_total_ms:j=>j.s1_warm.long.totalMs,
 warm_longest_task_ms:j=>j.s1_warm.long.top[0].durMs,
 paint_autosave_longtask_total_ms:j=>j.s2.long.totalMs,
 paint_autosave_longest_ms:j=>j.s2.long.top[0]?.durMs??0,
 paint_save_max_req_KB:j=>Math.max(...j.s2.saveFetches.map(f=>f.reqKB)),
 paint_save_max_resp_ms:j=>Math.max(...j.s2.saveFetches.map(f=>f.respMs)),
 drag20_only_ms:j=>j.s3.dragOnlyMs,
 drag_per_move_median_ms:j=>j.s3.perMoveMedianMs,
 map_switch_median_ms:j=>j.s4.medianMs,
 layer_switch_median_ms:j=>j.s5.medianMs,
 palette_filter_median_ms:j=>j.s6.medianMs,
 places_raf_ms:j=>j.s7.rafMs,
 places_settle_ms:j=>j.s7.settleMs,
 places_longtask_ms:j=>j.s7.longSumMs,
 heap_used_MB:j=>j.heap.jsHeapUsedMB,
};
const out={generatedAt:new Date().toISOString(),loadavgPerRun:{before:runs.before.map(j=>j.load),after:runs.after.map(j=>j.load)},metrics:{}};
let md="| 지표 | before(main) 3회 | after(perf) 3회 | 중앙값 before | 중앙값 after | 비 |\n|---|---|---|---|---|---|\n";
for(const [k,f] of Object.entries(metrics)){
 const b=runs.before.map(f),a=runs.after.map(f);
 out.metrics[k]={before:b,after:a,medBefore:med(b),medAfter:med(a)};
 md+=`| ${k} | ${b.join(" / ")} | ${a.join(" / ")} | ${med(b)} | ${med(a)} | ${(med(a)/med(b)).toFixed(2)}x |\n`;
}
out.summaryMarkdown=md;
fs.writeFileSync("RESULT.json",JSON.stringify(out,null,1));
console.log(md);console.log(JSON.stringify(out.loadavgPerRun));
