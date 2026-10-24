"""Self-contained review page for beodeul_organic: family strips beside Beodeul references, the sample B1 woodland map at 1x, 3x crops, QA summary.

  python3 scripts/content/beodeul-organic/viz.py <sample-map-1x.png> <out.html>
Images are embedded as data URIs (no local paths, no CDN).
"""
import base64, io, json, subprocess, sys
from pathlib import Path
from PIL import Image
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
spec = json.loads((HERE / "spec.json").read_text())["items"]
FAMILIES = ["rock", "mossy", "bush", "wood", "mushroom", "fern", "grass", "flower", "landmark"]
NAMES = {"rock": "바위·자갈", "mossy": "이끼 돌", "bush": "덤불·관목", "wood": "통나무·그루터기", "mushroom": "버섯", "fern": "고사리",
         "grass": "풀포기·갈대", "flower": "들꽃", "landmark": "숲 표지물 (고목·사당 돌)"}

def uri(img):
    b = io.BytesIO(); img.save(b, "PNG"); return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()

def strip(fam, scale):
    out = Path(f"/tmp/org-viz-{fam}.png")
    subprocess.run([sys.executable, str(HERE / "preview.py"), fam, str(out), str(scale)], check=True, capture_output=True)
    return Image.open(out)

def main(map_png, html):
    m = Image.open(map_png).convert("RGB")
    W, H = m.size
    crops = []
    for (cx, cy, w, h, label) in [(0.08, 0.40, 300, 200, "서쪽 빈터"), (0.62, 0.40, 300, 200, "동쪽 빈터"), (0.38, 0.0, 300, 170, "북쪽 빈터"),
                                  (0.32, 0.30, 300, 200, "사당 빈터 가운데")]:
        x0, y0 = int(cx * W), int(cy * H)
        c = m.crop((x0, y0, min(W, x0 + w), min(H, y0 + h)))
        crops.append((label, c.resize((c.width * 3, c.height * 3), Image.NEAREST)))
    ledger = subprocess.run([sys.executable, str(HERE / "qa" / "ledger.py"), "status"], capture_output=True, text=True).stdout.strip().splitlines()
    rows = "".join(f"<tr><td>{l[3:21].strip()}</td><td>{l[21:].strip()}</td><td>{'통과' if l.startswith('OK') else '미통과'}</td></tr>" for l in ledger[:-1])
    fam_html = "".join(f"<h3>{NAMES[f]} <small>({sum(1 for i in spec if i['family'] == f)}종)</small></h3><img class=px src='{uri(strip(f, 5))}'>" for f in FAMILIES)
    crop_html = "".join(f"<figure><img class=px src='{uri(c)}'><figcaption>{l} · 3배</figcaption></figure>" for l, c in crops)
    Path(html).write_text(f"""<!doctype html><meta charset=utf-8><title>버들항 자연 기물 2판</title>
<style>body{{background:#1e1f22;color:#ddd;font:15px/1.5 system-ui,sans-serif;margin:24px;max-width:1900px}}
img.px{{image-rendering:pixelated;max-width:100%;display:block;margin:6px 0 18px}} h2{{margin-top:36px}} small{{color:#999}}
figure{{display:inline-block;margin:0 16px 16px 0;vertical-align:top}} figcaption{{color:#aaa}}
table{{border-collapse:collapse}} td{{border-bottom:1px solid #333;padding:2px 10px}} .note{{color:#bbb;max-width:1100px}}</style>
<h1>버들항 · 자연 기물 37종 (beodeul_organic)</h1>
<p class=note>숲·들판에 까는 바위·덤불·통나무·버섯·고사리·풀·들꽃·이끼 돌·고목·사당 돌. 버들항 잠금 팔레트 손 도트. 각 줄 왼쪽은 버들항 원본 키트, 오른쪽이 새 그림(5배), 아래 줄은 1배.
조수·편집기에서는 beodeul_city 칩셋의 kit <code>bd-org-&lt;id&gt;</code> 로 놓는다(3층 서 있는 기물은 밑칸만 막힘, 2층 바닥 꾸미기는 전부 통행).</p>
<h2>1. 견본 지도 — B1 활엽 숲(낙성 숲 화풍) 빈터, 1배</h2>
<p class=note>무엇을 볼지: 새 기물이 버들항 나무 사이에 같은 색·윤곽·명암으로 앉는지, 길·출구를 막지 않는지(출구 사이 통행 검사 통과).</p>
<img class=px src='{uri(m)}'>
<h2>2. 3배 확대</h2>{crop_html}
<h2>3. 갈래별 — 버들항 원본 옆에 같은 배율</h2>{fam_html}
<h2>4. 검수</h2>
<p class=note>판정자 두 명(argon, klb-sonnet-5-5)에게 새 그림 37종과 버들항 원본 16종을 섞어 이름 없는 번호로 보여 주는 블라인드 시트로 매 판 새로 판정했다.
원본도 판정자마다 4~10/16 만 통과할 만큼 엄격한 판정이다. 기준(qa/protocol.md): 지금 화소 그대로 2장 이상 시트에 나와, 한 번 이상 두 판정자 모두 통과, 판정자마다 2/3 이상 통과.
3/4 관문(object-gate)은 현재 프로필이 미보정이라 AI 판정은 조언이고, 이 검수 근거로 감독 위임 허용을 기록한 뒤 굽기 관문을 통과했다.</p>
<table>{rows}</table><p>{ledger[-1] if ledger else ''}</p>
""")
    print(html)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
