"""parallax-easing.capture.mjs 결과(report.json + PNG)를 자체완결 HTML 한 장으로 묶는다.

사용: python3 scripts/qa/runtime/parallax-easing-viz.py /tmp/parallax-easing ~/claude-viz/parallax-easing.html
"""
import base64
import io
import json
import math
import sys
from pathlib import Path

from PIL import Image

src = Path(sys.argv[1])
out = Path(sys.argv[2]).expanduser()
report = json.loads((src / "report.json").read_text())


def data_uri(name: str, crop_hud: bool = False) -> str:
    image = Image.open(src / name).convert("RGB")
    # 960x720 → 480x360 (게임 1px = 1.5px 로는 흐려지므로 정수 배율 3→1.5 대신 원본 절반을 nearest 로)
    image = image.resize((480, 360), Image.NEAREST)
    buffer = io.BytesIO()
    image.save(buffer, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()


before = [data_uri(frame["file"]) for frame in report["before"]["frames"]]
after = [data_uri(frame["file"]) for frame in report["after"]["frames"]]
strip = [data_uri(name) for name in report["easing"]["strip"]]
tiles = [frame["x"] for frame in report["after"]["frames"]]

easings = report["easing"]["samples"]
names = report["easings"]
labels = {"linear": "일정하게 (지금까지)", "easeIn": "천천히 출발", "easeOut": "천천히 멈춤", "easeInOut": "천천히 출발·멈춤"}
colors = ["#3987e5", "#d95926", "#199e70", "#c98500"]
from_x, to_x, move_ms = report["fromX"], report["toX"], report["moveMs"]


def ideal(name: str, t: float) -> float:
    x = max(0.0, min(1.0, t))
    if name == "easeIn":
        return x * x
    if name == "easeOut":
        return 1 - (1 - x) * (1 - x)
    if name == "easeInOut":
        return -(math.cos(math.pi * x) - 1) / 2
    return x


# 측정 곡선(실측) — 진행률 = (x - from) / (to - from)
W, H, PAD_L, PAD_B, PAD_T, PAD_R = 560, 300, 44, 34, 18, 16
def sx(t): return PAD_L + (t / move_ms) * (W - PAD_L - PAD_R)
def sy(p): return PAD_T + (1 - p) * (H - PAD_T - PAD_B)

paths = []
for i, name in enumerate(names):
    pts = []
    for sample in easings:
        if sample["t"] > move_ms + 5:
            continue
        p = (sample["xs"][i] - from_x) / (to_x - from_x)
        pts.append(f"{sx(sample['t']):.1f},{sy(p):.1f}")
    ideal_pts = " ".join(f"{sx(k / 60 * move_ms):.1f},{sy(ideal(name, k / 60)):.1f}" for k in range(61))
    end_y = sy(1.0)
    paths.append(
        f'<polyline class="ideal" points="{ideal_pts}" stroke="{colors[i]}"/>'
        f'<polyline class="measured" data-series="{i}" points="{" ".join(pts)}" stroke="{colors[i]}"/>'
    )
# 직접 라벨: 시간 중간(50%)에서 각 곡선의 진행률 — 곡선이 갈라지는 지점이라 겹치지 않는다
mid_labels = []
for i, name in enumerate(names):
    p = ideal(name, 0.5)
    mid_labels.append((p, name, i))
grid = "".join(
    f'<line class="grid" x1="{PAD_L}" x2="{W - PAD_R}" y1="{sy(v):.1f}" y2="{sy(v):.1f}"/>'
    f'<text class="tick" x="{PAD_L - 6}" y="{sy(v) + 4:.1f}" text-anchor="end">{int(v * 100)}%</text>'
    for v in (0, 0.25, 0.5, 0.75, 1)
)
xticks = "".join(
    f'<text class="tick" x="{sx(ms):.1f}" y="{H - PAD_B + 18}" text-anchor="middle">{ms / 1000:.1f}s</text>'
    for ms in (0, 400, 800, 1200, 1600)
)
# 라벨 자리: 시간 25% 지점 — 50% 에서는 일정하게·출발·멈춤 곡선이 한 점(50%)에서 만나 라벨이 겹친다.
LABEL_T = 0.25
end_labels = "".join(
    f'<circle cx="{sx(move_ms * LABEL_T):.1f}" cy="{sy(ideal(n, LABEL_T)):.1f}" r="4" fill="{colors[i]}" stroke="#1a1a19" stroke-width="2"/>'
    f'<line x1="{sx(move_ms * LABEL_T) + 6:.1f}" x2="{sx(move_ms * LABEL_T) + 22:.1f}" y1="{sy(ideal(n, LABEL_T)):.1f}" y2="{sy(ideal(n, LABEL_T)):.1f}" stroke="#6b6a63" stroke-width="1"/>'
    f'<text class="lbl" x="{sx(move_ms * LABEL_T) + 26:.1f}" y="{sy(ideal(n, LABEL_T)) + 4:.1f}">{labels[n]}</text>'
    for i, n in enumerate(names)
)
samples_json = json.dumps([{"t": s["t"], "xs": s["xs"]} for s in easings if s["t"] <= move_ms + 5])

follow_rows = "".join(
    f"<tr><td>{i + 1}</td><td>{row['id'].replace('oga-craftpix-hills-layer-', '')}</td><td>0</td><td><b>{row['followX']}</b></td></tr>"
    for i, row in enumerate(report["follow"])
)

html = f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>OPRN · 연출 이징 + 원근 배경</title>
<style>
:root {{ --bg:#141413; --surface:#1a1a19; --ink:#fff; --ink2:#c3c2b7; --muted:#8a897f; --line:#2c2b29; }}
* {{ box-sizing:border-box; }}
body {{ margin:0; background:var(--bg); color:var(--ink); font:15px/1.6 system-ui,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif; }}
main {{ max-width:1040px; margin:0 auto; padding:32px 24px 64px; }}
h1 {{ font-size:24px; margin:0 0 4px; }} h2 {{ font-size:18px; margin:40px 0 6px; }}
p.lead {{ color:var(--ink2); margin:0 0 20px; }} .note {{ color:var(--muted); font-size:13px; }}
.pair {{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }}
figure {{ margin:0; background:var(--surface); border:1px solid var(--line); border-radius:8px; padding:10px; }}
figure img {{ width:100%; image-rendering:pixelated; display:block; border-radius:4px; }}
figcaption {{ font-size:14px; margin-top:8px; color:var(--ink2); }} figcaption b {{ color:var(--ink); }}
.controls {{ display:flex; gap:12px; align-items:center; margin:12px 0 0; color:var(--ink2); font-size:14px; }}
button {{ background:#2a2a28; color:var(--ink); border:1px solid #3a3936; border-radius:6px; padding:6px 14px; font:inherit; cursor:pointer; }}
input[type=range] {{ flex:1; }}
table {{ border-collapse:collapse; font-size:13px; color:var(--ink2); }} td,th {{ padding:3px 12px 3px 0; text-align:left; }} th {{ color:var(--muted); font-weight:500; }}
.chart {{ background:var(--surface); border:1px solid var(--line); border-radius:8px; padding:12px; position:relative; }}
svg text {{ font-family:inherit; }} .tick {{ fill:var(--muted); font-size:11px; }} .lbl {{ fill:var(--ink2); font-size:12px; }}
.grid {{ stroke:#2c2b29; stroke-width:1; }} .measured {{ fill:none; stroke-width:2; stroke-linejoin:round; }} .ideal {{ fill:none; stroke-width:1; stroke-dasharray:3 4; opacity:.55; }}
.tip {{ position:absolute; pointer-events:none; background:#0b0b0b; border:1px solid #3a3936; border-radius:6px; padding:6px 9px; font-size:12px; color:var(--ink2); display:none; white-space:nowrap; }}
.cross {{ stroke:#6b6a63; stroke-width:1; }}
.strip {{ display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }}
.strip figure {{ padding:6px; }} .strip figcaption {{ margin-top:4px; font-size:12px; }}
ul.where li {{ margin:4px 0; color:var(--ink2); }} code {{ background:#242422; padding:1px 6px; border-radius:4px; color:#e9e8e1; font-size:13px; }}
</style></head><body><main>
<h1>연출 이징(새로 추가) + 원근 배경(기존 기능 확인) — 실제 게임 화면</h1>
<p class="lead">전부 출하용 플레이어(player.html)에서 origin/main + 이번 변경으로 찍었다. 1번이 이번에 새로 넣은 것, 2번은 이미 main 에 있던 기능(PR #1646)이 출하 경로에서 실제로 도는지 확인한 것이다.</p>

<h2 id="easing">1. 그림이 가감속하며 움직이는가 <span class="note">(이번에 추가)</span></h2>
<p class="note">얼굴 그림 4장을 같은 시각에 같은 거리({to_x - from_x}px, {move_ms / 1000:.1f}초)로 옮겼다. 곡선만 다르다. 실선은 브라우저에서 rAF 마다 잰 실제 위치, 점선은 목표 곡선이다. <b>실선이 점선에 붙어 있으면</b> 런타임이 곡선대로 그린 것이다.</p>
<div class="chart" id="chart">
<svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="시간에 따른 그림 이동 진행률, 곡선 4종">
{grid}{xticks}
<text class="tick" x="{PAD_L}" y="{PAD_T - 2}">진행률 · 실선=실측, 점선=목표 곡선</text>
{''.join(paths)}
{end_labels}
<line id="cross" class="cross" x1="0" x2="0" y1="{PAD_T}" y2="{H - PAD_B}" style="display:none"/>
<rect id="hit" x="{PAD_L}" y="{PAD_T}" width="{W - PAD_L - PAD_R}" height="{H - PAD_T - PAD_B}" fill="transparent"/>
</svg><div class="tip" id="tip"></div></div>
<details style="margin-top:8px"><summary class="note">표로 보기 (0.2초 간격 진행률)</summary><div id="table"></div></details>

<h3 style="font-size:15px;margin:22px 0 8px">같은 순간의 화면 (위에서부터 일정하게 · 천천히 출발 · 천천히 멈춤 · 천천히 출발·멈춤)</h3>
<div class="strip">{''.join(f'<figure><img src="{u}" alt="이징 {i}"><figcaption>{i * 0.2:.1f}초 무렵</figcaption></figure>' for i, u in enumerate(strip[:9]))}</div>

<h2 id="parallax">2. 걸을 때 배경에 깊이가 생기는가 <span class="note">(기존 기능 · 층별 깊이 cameraFollow)</span></h2>
<p class="note">주인공이 오른쪽으로 {len(tiles)}칸 걷는다. 왼쪽은 깊이 0(배경 7장이 화면에 붙어 있음), 오른쪽은 레이어 세트를 고를 때 자동으로 붙는 깊이(먼 산 느리게, 가까운 산·구름 빠르게). <b>먼 산과 가까운 산이 서로 어긋나며 지나가는지</b>를 보면 된다.</p>
<div class="pair">
  <figure><img id="imgBefore" src="{before[0]}" alt="이전: 화면 고정 배경"><figcaption><b>깊이 0</b> · 배경 전부 화면 고정</figcaption></figure>
  <figure><img id="imgAfter" src="{after[0]}" alt="이후: 원근 배경"><figcaption><b>세트 기본 깊이</b> · 0 → 0.7</figcaption></figure>
</div>
<div class="controls"><button id="play">일시정지</button><input id="scrub" type="range" min="0" max="{len(before) - 1}" value="0"><span id="pos">x=—</span></div>
<details style="margin-top:12px"><summary class="note">레이어별 값 (아래 → 위)</summary>
<table><tr><th>#</th><th>레이어</th><th>왼쪽</th><th>오른쪽</th></tr>{follow_rows}</table></details>

<h2>어디서 고치나</h2>
<ul class="where">
<li>이벤트 명령 <b>그림 표시</b> → 「회전 · 서서히」 → <b>움직임 곡선</b>. <b>그림 이동</b>·<b>카메라 제어</b>에도 같은 칸이 생겼다.</li>
<li>조수(AI)·컷신 DSL: camera·picture 비트에 <code>easing</code>.</li>
<li>생략하면 지금과 똑같이 일정하게 움직인다 — 기존 프로젝트 연출은 바뀌지 않는다.</li>
<li>원근은 원래 있던 칸: 맵 속성 → 맵 배경 → 레이어별 <b>깊이(%)</b>.</li>
</ul>
<p class="note">아직 안 한 것: 맵 스크롤 명령(scrollMap) 팬은 일정하게 고정.</p>
</main>
<script>
const before = {json.dumps(before)};
const after = {json.dumps(after)};
const tiles = {json.dumps(tiles)};
let i = 0, playing = true;
const ib = document.getElementById('imgBefore'), ia = document.getElementById('imgAfter');
const scrub = document.getElementById('scrub'), pos = document.getElementById('pos'), btn = document.getElementById('play');
function show(k) {{ i = k; ib.src = before[k]; ia.src = after[k]; scrub.value = k; pos.textContent = '주인공 x=' + tiles[k] + '칸'; }}
setInterval(() => {{ if (playing) show((i + 1) % before.length); }}, 140);
btn.onclick = () => {{ playing = !playing; btn.textContent = playing ? '일시정지' : '재생'; }};
scrub.oninput = () => {{ playing = false; btn.textContent = '재생'; show(+scrub.value); }};
show(0);

const samples = {samples_json};
const names = {json.dumps([labels[n] for n in names])};
const colors = {json.dumps(colors)};
const FROM = {from_x}, TO = {to_x}, MS = {move_ms};
const W = {W}, PL = {PAD_L}, PR = {PAD_R};
const svg = document.querySelector('#chart svg'), tip = document.getElementById('tip'), cross = document.getElementById('cross');
function nearest(t) {{ let best = samples[0]; for (const s of samples) if (Math.abs(s.t - t) < Math.abs(best.t - t)) best = s; return best; }}
document.getElementById('hit').addEventListener('mousemove', (e) => {{
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  const t = Math.max(0, Math.min(MS, (p.x - PL) / (W - PL - PR) * MS));
  const s = nearest(t);
  const x = PL + s.t / MS * (W - PL - PR);
  cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.style.display = '';
  tip.innerHTML = '<div style="color:#fff">' + (s.t / 1000).toFixed(2) + '초</div>' + names.map((n, k) =>
    '<div><span style="display:inline-block;width:10px;height:2px;background:' + colors[k] + ';vertical-align:middle;margin-right:6px"></span>' + n + ' ' + Math.round((s.xs[k] - FROM) / (TO - FROM) * 100) + '%</div>').join('');
  const box = document.getElementById('chart').getBoundingClientRect();
  tip.style.display = 'block'; tip.style.left = (e.clientX - box.left + 14) + 'px'; tip.style.top = (e.clientY - box.top + 10) + 'px';
}});
document.getElementById('hit').addEventListener('mouseleave', () => {{ tip.style.display = 'none'; cross.style.display = 'none'; }});
let rows = '<table><tr><th>시간</th>' + names.map(n => '<th>' + n + '</th>').join('') + '</tr>';
for (let t = 0; t <= MS; t += 200) {{ const s = nearest(t); rows += '<tr><td>' + (t / 1000).toFixed(1) + 's</td>' + s.xs.map(x => '<td>' + Math.round((x - FROM) / (TO - FROM) * 100) + '%</td>').join('') + '</tr>'; }}
document.getElementById('table').innerHTML = rows + '</table>';
</script></body></html>"""
out.write_text(html)
print(out, f"{out.stat().st_size / 1e6:.1f}MB")
