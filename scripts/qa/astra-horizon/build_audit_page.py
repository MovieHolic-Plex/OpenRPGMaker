"""감사 페이지 생성기 — spec.json(문제·이미지·계획)을 받아 자체완결 HTML 한 장을 쓴다.

  python3 build_audit_page.py spec.json out.html

spec: {"title", "intro", "problems": [{"rank","sev","title","detail","fix","shots":[{"path","cap","scale"}],
       "after":[{"path","cap"}], "status"}], "plan": [str], "notes": [str]}
이미지는 1배(긴 변 ≤ 480)로 줄여 PNG data URI 로 넣고, CSS 로 2배 픽셀 확대해서 보여 준다. scale=3 이면 원본(3배)을 크롭 없이 넣는다.
"""
import base64, io, json, sys, html
from PIL import Image

def data_uri(path, scale):
    im = Image.open(path).convert("RGB")
    if scale == 1:
        w, h = im.size
        f = max(1, round(max(w, h) / 480))
        if f > 1:
            im = im.resize((w // f, h // f), Image.NEAREST)
    buf = io.BytesIO(); im.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode(), im.size

def fig(s):
    uri, (w, h) = data_uri(s["path"], s.get("scale", 1))
    disp = w * 2 if s.get("scale", 1) == 1 else w // 2
    return f'<figure><img src="{uri}" style="width:{disp}px;max-width:100%"><figcaption>{html.escape(s.get("cap",""))}</figcaption></figure>'

spec = json.load(open(sys.argv[1]))
sev_cls = {"blocker": "b", "major": "m", "minor": "n"}
rows = []
for p in spec["problems"]:
    shots = "".join(fig(s) for s in p.get("shots", []))
    after = "".join(fig(s) for s in p.get("after", []))
    status = f'<div class="status">{html.escape(p["status"])}</div>' if p.get("status") else ""
    rows.append(f'''<section class="p"><h2><span class="sev {sev_cls.get(p["sev"],"n")}">{html.escape(p["sev"])}</span> {p["rank"]}. {html.escape(p["title"])}</h2>
<p>{html.escape(p["detail"])}</p><p class="fix">고칠 것: {html.escape(p["fix"])}</p>{status}
<div class="shots">{shots}</div>{('<h3>고친 뒤</h3><div class="shots">'+after+'</div>') if after else ''}</section>''')
plan = "".join(f"<li>{html.escape(x)}</li>" for x in spec.get("plan", []))
notes = "".join(f"<li>{html.escape(x)}</li>" for x in spec.get("notes", []))
out = f'''<!doctype html><html lang="ko"><meta charset="utf-8"><title>{html.escape(spec["title"])}</title>
<style>body{{font:15px/1.55 system-ui,sans-serif;background:#14161a;color:#e8e8e8;max-width:1180px;margin:24px auto;padding:0 16px}}
h1{{font-size:22px}}h2{{font-size:17px;margin:0 0 6px}}h3{{font-size:14px;color:#9fd29f}}.p{{background:#1d2026;border-radius:8px;padding:14px 16px;margin:14px 0}}
.sev{{font-size:12px;padding:2px 7px;border-radius:4px;vertical-align:2px}}.b{{background:#b3261e}}.m{{background:#b26a00}}.n{{background:#3b5b7a}}
.fix{{color:#a8d5ff}}.status{{color:#9fd29f;font-weight:600}}.shots{{display:flex;flex-wrap:wrap;gap:10px}}figure{{margin:0}}img{{image-rendering:pixelated;border:1px solid #333;display:block}}
figcaption{{font-size:12px;color:#aaa;max-width:480px}}ol li,ul li{{margin:4px 0}}</style>
<h1>{html.escape(spec["title"])}</h1><p>{html.escape(spec.get("intro",""))}</p>
{"".join(rows)}<h2>고치는 순서</h2><ol>{plan}</ol>{('<h2>메모</h2><ul>'+notes+'</ul>') if notes else ''}</html>'''
open(sys.argv[2], "w").write(out)
print(sys.argv[2], len(out) // 1024, "KB")
