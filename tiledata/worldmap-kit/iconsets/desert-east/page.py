#!/usr/bin/env python3
"""비교 페이지(자체완결 data URI) 생성. python3 page.py [출력경로]"""
import base64
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def uri(p):
    return 'data:image/png;base64,' + base64.b64encode((HERE / p).read_bytes()).decode()


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / 'claude-viz/worldmap-set-desert-east.html'
    m = json.loads((HERE / 'manifest.json').read_text())
    chk = json.loads((HERE / 'sheet-check.json').read_text())
    rows = ''.join(f"<tr><td>{i['role']}</td><td>{i['name']}</td><td>{i['cells'][0]}x{i['cells'][1]}</td><td>{i['desc']}</td></tr>" for i in m['icons'])
    crit = (HERE / 'criteria.md').read_text()
    vr = ''
    for l in crit.splitlines():
        if not l.startswith('| '):
            continue
        c = [x.strip() for x in l.strip('|').split('|')]
        if len(c) == 4 and c[3][:1] in ('✓', '△', '✗'):
            cls = 'ok' if c[3].startswith('✓') else 'mid' if c[3].startswith('△') else 'bad'
            vr += f"<tr class='{cls}'><td>{c[0]}</td><td>{c[1]}</td><td>{c[2]}</td><td>{c[3]}</td></tr>"
    html = f"""<!doctype html><meta charset=utf-8><title>월드맵 세트 — 사막·동양풍</title>
<style>body{{background:#1e1e22;color:#e6e6e6;font:14px/1.5 system-ui,sans-serif;margin:20px;max-width:1500px}}
h2{{border-bottom:1px solid #444;padding-bottom:4px;margin-top:32px}}
img{{image-rendering:pixelated;max-width:100%;display:block;margin:6px 0}}
table{{border-collapse:collapse;margin:8px 0}}td,th{{border:1px solid #444;padding:3px 8px;text-align:left}}
tr.ok td:last-child{{color:#7fe08a}}tr.mid td:last-child{{color:#f0c060}}tr.bad td:last-child{{color:#ff7070}}
.grid{{display:flex;flex-wrap:wrap;gap:12px}}.grid div{{background:#2a2a30;padding:6px}}small{{color:#aaa}}</style>
<h1>사막·동양풍 (desert-east) — 월드맵 아이콘 {len(m['icons'])}장 · 17역할</h1>
<p>투영 렌더러로 만들어 3/4 시점(윗면·앞면·오른쪽면, 빛은 왼쪽 위)을 규칙으로 보장했다. 색은 전부 원본 월드 칩셋 색(새 색 {chk['new_color_count']}개, 한도 12).
판정: ✓ 의도한 것으로 읽힘 · △ 애매 · ✗ 다른 것으로 읽힘. 못 한 것은 맨 아래.</p>
<h2>1. 도감 (8배)</h2><img src="{uri('preview/catalog-8x.png')}">
<h2>2. 지도 맥락 — 원본 월드 칩셋 풀밭·사막 위 (12x9칸, 2배)</h2>
<div class=grid><div><small>풀밭</small><img src="{uri('preview/ctx-grass-2x.png')}"></div><div><small>사막</small><img src="{uri('preview/ctx-sand-2x.png')}"></div>
<div><small>섞임</small><img src="{uri('preview/ctx-mix-2x.png')}"></div><div><small>해안·폐허·부유섬</small><img src="{uri('preview/ctx-coast-2x.png')}"></div></div>
<h2>3. 한 지도에 모두 (2배)</h2><img src="{uri('preview/ctx-all-2x.png')}">
<h2>4. 아이콘 시트 (sheet.png 4배, 키 색 배경 → 풀밭 합성)</h2><img src="{uri('preview/sheet-4x-on-grass.png')}">
<h2>5. 「이게 뭐로 보이나」 판정</h2><table><tr><th>역할</th><th>아이콘</th><th>이게 뭐로 보이나</th><th>판정</th></tr>{vr}</table>
<h2>6. 3/4 기준과 보장 방식</h2><table><tr><th>기준</th><th>보장</th></tr>
<tr><td>윗면이 보인다</td><td>경사 투영 <code>u=x+.28y, v=z+.5y</code> 레이캐스트. 지붕은 입체의 기울어진 평면이라 정면 박공 한 장이 나올 수 없다</td></tr>
<tr><td>윗면 밝음/앞면 중간/오른쪽면 어둠</td><td>법선·광원(왼쪽 위) 내적으로 자동</td></tr>
<tr><td>밑변 발자국 + 오른쪽 아래 그림자</td><td>광선으로 판정한 키 색(254,103,139)</td></tr>
<tr><td>지도 1배에서 읽힘</td><td>눈 검수(위 판정표) — 숫자 아님</td></tr></table>
<h2>7. 역할 표</h2><table><tr><th>역할</th><th>이름</th><th>칸</th><th>설명</th></tr>{rows}</table>
<h2>8. 못 한 것 (정직하게)</h2><ul>
<li>△ 4장은 의도한 종류로 읽히되 애매하다: harbor_city(배가 부두와 붙어 단정하기 약함), large_town_b(건물이 낱개로 서 있음), camp_b(게르/티피 중간), circle(석등 지붕이 모자 같음).</li>
<li>large_town 은 기와집 여섯 채가 빽빽해 지붕이 겹친다. 간격을 더 벌리면 3x3칸에 안 들어가 그대로 두었다.</li>
<li>지도 맥락은 원본 월드 칩셋의 풀·사막 칸만 썼다. 산·바다 지형 위 배치는 보지 않았다.</li>
<li>청회 기와·옥색 기와는 원본 칩셋의 석재·잎 계열 색을 빌린 것이다. 원본에는 「기와」 색이 따로 없다.</li></ul>
"""
    out.write_text(html)
    print(out, len(html) // 1024, 'KB')


if __name__ == '__main__':
    main()
