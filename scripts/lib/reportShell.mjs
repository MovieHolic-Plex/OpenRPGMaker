/**
 * 두 상점 보고서가 공유하는 껍데기 — CSS 와 이미지 임베드 헬퍼.
 *
 * 생성기가 두 개로 늘어나면서 115행짜리 CSS 를 복사해 두 곳에서 관리하게 됐다.
 * 한쪽만 고치면 두 보고서 모양이 갈라지므로 여기로 모았다.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const REPORT_CSS = String.raw`  :root{
    --ink:#141719; --ink-2:#454c54; --ink-3:#79828c;
    --paper:#f7f8fa; --card:#fff; --line:#e3e7ec;
    --brand:#2f5bd0; --brand-soft:#eef2fd; --brand-line:#c9d6f5;
    --code-bg:#151a21; --code-ink:#dfe6ef;
    --hi:#c62f3d; --mid:#c07a12; --lo:#2f7d4f;
    --gold:#b07d18;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);
    font:16px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans KR","Malgun Gothic",sans-serif;}
  .wrap{max-width:1200px;margin:0 auto;padding:0 28px 96px}
  header.hero{background:linear-gradient(155deg,#0f1420 0%,#1d2a4a 46%,#2f4f8c 100%);color:#eef3fb;padding:54px 0 46px;margin-bottom:40px}
  header.hero .wrap{padding-bottom:0}
  header.hero h1{margin:0 0 12px;font-size:34px;letter-spacing:-.5px;line-height:1.32}
  header.hero p{margin:0;color:#c8d6ee;max-width:76ch}
  header.hero b{color:#fff}
  .meta{margin-top:24px;display:flex;flex-wrap:wrap;gap:8px}
  .meta span{background:rgba(255,255,255,.11);border:1px solid rgba(255,255,255,.19);
    border-radius:999px;padding:4px 12px;font-size:12.5px;color:#e6eefb}
  h2{margin:60px 0 6px;font-size:24px;letter-spacing:-.3px;padding-bottom:10px;border-bottom:2px solid var(--brand-line)}
  h2 .n{color:var(--brand);font-variant-numeric:tabular-nums;margin-right:10px;font-size:20px}
  h3{margin:36px 0 10px;font-size:17.5px}
  h4{margin:22px 0 6px;font-size:15px;color:var(--ink-2)}
  p{margin:10px 0}
  .lede{font-size:17px;color:var(--ink-2)}
  ul,ol{margin:10px 0;padding-left:22px}
  li{margin:5px 0}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;
    background:var(--brand-soft);border:1px solid var(--brand-line);border-radius:4px;padding:1px 5px}
  pre{background:var(--code-bg);color:var(--code-ink);border-radius:10px;padding:16px 18px;overflow-x:auto;
    font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.8px;line-height:1.62;margin:14px 0}
  pre code{background:none;border:0;padding:0;color:inherit;font-size:12.8px}
  pre .del{color:#ff9d9d} pre .add{color:#9ce6a8} pre .cmt{color:#7d8b9c}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:18px 0}
  .card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px}
  .card h5{margin:0 0 6px;font-size:13px;color:var(--brand);letter-spacing:.2px}
  .card p{margin:0;font-size:13.5px;color:var(--ink-2)}
  .card .big{font-size:26px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums;line-height:1.2}
  figure.shot{margin:22px 0;background:var(--card);border:1px solid var(--line);border-radius:12px;
    padding:12px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
  figure.shot img{display:block;width:100%;height:auto;border-radius:7px;border:1px solid var(--line);background:#f1f3f6}
  figure.shot.dark img{background:#07090c}
  figcaption{margin-top:10px;font-size:13.5px;color:var(--ink-3);line-height:1.6}
  figcaption b{color:var(--ink)}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  .grid2 figure.shot{margin:0}
  .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
  .grid3 figure.shot{margin:0}
  @media (max-width:900px){.grid2,.grid3{grid-template-columns:1fr}}
  .ba{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:20px 0}
  .ba figure.shot{margin:0}
  .ba-tag{font-size:12px;font-weight:700;letter-spacing:.06em;padding:3px 11px;border-radius:999px;display:inline-block;margin-bottom:8px}
  .ba-tag.before{background:#fdecec;color:var(--hi);border:1px solid #f4c9c9}
  .ba-tag.after{background:#e9f6ee;color:var(--lo);border:1px solid #c2e3ce}
  @media (max-width:900px){.ba{grid-template-columns:1fr}}
  table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;background:var(--card);
    border:1px solid var(--line);border-radius:10px;overflow:hidden}
  th,td{text-align:left;padding:10px 13px;border-bottom:1px solid var(--line);vertical-align:top}
  th{background:#eef1f6;font-size:12.5px;letter-spacing:.3px;color:var(--ink-2);font-weight:700}
  tr:last-child td{border-bottom:0}
  td.num{font-variant-numeric:tabular-nums;white-space:nowrap}
  .chip{display:inline-block;border-radius:999px;padding:2px 9px;font-size:11.5px;font-weight:700;color:#fff;white-space:nowrap}
  .chip.hi{background:var(--hi)} .chip.mid{background:var(--mid)} .chip.lo{background:var(--lo)}
  .chip.done{background:var(--lo)} .chip.extra{background:#5b4bb5}
  .note{background:var(--brand-soft);border:1px solid var(--brand-line);border-left:4px solid var(--brand);
    border-radius:8px;padding:13px 16px;margin:16px 0;font-size:14.5px}
  .note b{color:var(--brand)}
  .ok{border-left-color:var(--lo);background:#f0f7f2;border-color:#c9e2d3}
  .ok b{color:#2b6b45}
  .warn{border-left-color:var(--mid);background:#fdf6e9;border-color:#eddcb8}
  .warn b{color:#8f5b0d}
  .path{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;color:var(--ink-3)}
  .toc{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 22px;margin:8px 0 0}
  .toc ol{margin:0;padding-left:20px;columns:2;column-gap:34px}
  @media (max-width:700px){.toc ol{columns:1}}
  .toc a{color:var(--ink-2);text-decoration:none;border-bottom:1px solid transparent}
  .toc a:hover{color:var(--brand);border-bottom-color:var(--brand-line)}
  .fx{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--brand);border-radius:10px;padding:16px 20px;margin:20px 0}
  .fx > h3{margin:0 0 8px;font-size:16.5px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .fx .fx-id{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;background:#eef1f6;border:1px solid var(--line);border-radius:5px;padding:1px 7px;color:var(--ink-2)}
  .fx dl{margin:10px 0 0;display:grid;grid-template-columns:88px 1fr;gap:6px 14px;font-size:14px}
  .fx dt{color:var(--ink-3);font-size:12.5px;padding-top:2px}
  .fx dd{margin:0}
  .fx.extra{border-left-color:#5b4bb5}
  footer{margin-top:64px;padding-top:22px;border-top:1px solid var(--line);color:var(--ink-3);font-size:13px}
`;

/** 디렉터리의 png 를 전부 base64 로 읽어 `prefix+파일명`(확장자 제거) 키로 담는다. */
export function loadShots(dir, prefix = "") {
  return Object.fromEntries(
    readdirSync(dir)
      .filter((f) => f.endsWith(".png"))
      .map((f) => [`${prefix}${f.replace(/\.png$/, "")}`, readFileSync(join(dir, f)).toString("base64")])
  );
}

/**
 * 이미지 헬퍼 묶음. 없는 캡처를 참조하면 즉시 던진다 — 캡처 없이 만들어진
 * "그림 없는 이미지 리치 보고서"를 막는다.
 */
export function makeImageHelpers(shots) {
  const img = (name, alt) => {
    const data = shots[name];
    if (!data) throw new Error(`missing shot: ${name} (있는 것: ${Object.keys(shots).join(", ")})`);
    return `<img src="data:image/png;base64,${data}" alt="${alt}" loading="lazy">`;
  };
  const fig = (name, title, caption, cls = "") =>
    `<figure class="shot ${cls}">${img(name, title)}<figcaption><b>${title}</b>${caption ? ` — ${caption}` : ""}</figcaption></figure>`;
  const ba = (before, after, title, beforeCap, afterCap) => `
<div class="ba">
  <div class="ba-col">
    <div class="ba-tag before">수정 전</div>
    ${fig(before, title, beforeCap, "dark")}
  </div>
  <div class="ba-col">
    <div class="ba-tag after">수정 후</div>
    ${fig(after, title, afterCap, "dark")}
  </div>
</div>`;
  return { img, fig, ba };
}
