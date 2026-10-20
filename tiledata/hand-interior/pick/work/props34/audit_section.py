"""Append/replace the props34 section in ~/claude-viz/interior-props-34-audit-1.html."""
import base64, io, json, re, sys, os
sys.path.insert(0, '/home/main/z-project/rpg-zzu-v5-interior-props-34/scripts/content/hand-interior/props34')
import redraw as R, compare as C
from PIL import Image
W = os.path.dirname(os.path.abspath(__file__))
PAGE = '/home/main/claude-viz/interior-props-34-audit-1.html'
def uri(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
res = R.build()
mine = json.load(open(os.path.join(W, 'my_verdicts.json')))
argon = {json.loads(l)['id']: json.loads(l) for l in open(os.path.join(W, 'argon_verdicts.jsonl'))}
gate = json.load(open(os.path.join(W, 'gate_final.json')))
real = [k for k in res]
pairs = ''.join(
    f'<div class="p34c"><div class="p34n">{k}</div><img src="{uri(C.card("before", R.frames(k)[0], 4))}"><img src="{uri(C.card("after", res[k][0], 4))}">'
    f'<div class="p34g">gate: {gate.get(k, "-")}</div></div>' for k in real)
rows = ''.join(
    f'<tr><td>{m["id"]}</td><td>{"<b>REAL</b>" if m["id"] in res else "false"}</td><td>{m["why"] if m["id"] not in res else "redrawn"}</td>'
    f'<td>{argon.get(m["id"], {}).get("v34", "")}/{argon.get(m["id"], {}).get("quality", "")}</td></tr>' for m in mine)
html = f'''<section id="props34-v5-nonseat">
<style>#props34-v5-nonseat .p34c{{display:inline-block;vertical-align:top;margin:6px;background:#2a2622;padding:4px}}#props34-v5-nonseat img{{image-rendering:pixelated;display:inline-block;vertical-align:top;margin:2px}}
#props34-v5-nonseat .p34n{{color:#ffe9b0;font:12px monospace}}#props34-v5-nonseat .p34g{{color:#bbb;font:11px monospace;max-width:420px}}#props34-v5-nonseat table{{font:12px sans-serif;border-collapse:collapse}}#props34-v5-nonseat td{{border:1px solid #444;padding:2px 6px}}</style>
<h2>15. atlas_biome_interior 의자 밖 기물 재판정·재작도 (2026-10-20)</h2>
<p>이 칩셋 FAIL 100 중 의자 4를 뺀 96종을 4·8배로 합격 그림 옆에서 다시 봤다. 실제 위반 {len(real)}종(진열장 재고 변형 13은 몸통 하나) · 오판 {96 - len([m for m in mine if m["id"] in res])}종.
그림은 칸 번호 그대로 덮었다(전후 4배). gate = object-gate(현재 프로필 ee216f0de5822996, 아직 보정 거절 상태) 결과.</p>
{pairs}
<h3>96종 판정표 (첫 판정 · 독립 Argon v34/quality)</h3><table><tr><th>id</th><th>판정</th><th>이유</th><th>Argon</th></tr>{rows}</table>
</section>'''
s = open(PAGE, encoding='utf-8').read()
s = re.sub(r'<section id="props34-v5-nonseat">.*?</section>', '', s, flags=re.S)
i = s.rfind('</body>')
s = s[:i] + html + s[i:] if i >= 0 else s + html
open(PAGE + '.tmp', 'w', encoding='utf-8').write(s); os.replace(PAGE + '.tmp', PAGE)
print('ok', len(real))
