#!/usr/bin/env python3
"""몬스터 눈 점검·후보 판정 시트 생성기 (자체완결 HTML, 그림은 data URI).

  python3 eye_sheets.py audit <out.html> <audit.json> <eyes.json>
      번들 15종 앞·뒤 30장 결함 점검표. audit.json = 사람이 눈으로 본 종별 판정, eyes.json = checks/eyes.ts 측정값.
  python3 eye_sheets.py blind <outdir> <species,...>
      판정자에게 줄 눈가림 시트: 종마다 후보 번호(1~N)만 노출. 원본 64px + 6배 + 얼굴 확대 + 64px 검정 실루엣. 생성 순서·점수·눈 규칙 결과는 숨긴다.
      후보 목록은 <outdir>/candidates.json (종 → {side: [{label, sprite}]}) 에서 읽는다.
"""
import base64, io, json, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
BUNDLE = ROOT / "public/assets/harnesses/monster-collect-species"
BG = (214, 224, 205, 255)


def uri(img):
    b = io.BytesIO(); img.save(b, "PNG")
    return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()


def load(path):
    return Image.open(path).convert("RGBA")


def on_bg(im, scale=1):
    bg = Image.new("RGBA", im.size, BG); bg.alpha_composite(im)
    out = bg.convert("RGB")
    return out.resize((im.size[0] * scale, im.size[1] * scale), Image.NEAREST) if scale != 1 else out


def mask_img(im, scale=1):
    a = np.array(im.split()[3]) >= 128
    arr = np.zeros((*a.shape, 4), dtype=np.uint8)
    arr[a] = (0, 0, 0, 255)
    m = Image.fromarray(arr, "RGBA")
    bg = Image.new("RGBA", m.size, (232, 238, 242, 255)); bg.alpha_composite(m)
    out = bg.convert("RGB")
    return out.resize((m.size[0] * scale, m.size[1] * scale), Image.NEAREST) if scale != 1 else out


def head_crop(im, center, w=30, h=24, scale=10):
    x, y = center
    box = (max(0, x - w // 2), max(0, y - h // 2), max(0, x - w // 2) + w, max(0, y - h // 2) + h)
    return on_bg(im).crop(box).resize((w * scale, h * scale), Image.NEAREST)


CSS = """body{margin:0;background:#14161c;color:#e4e7ee;font:14px/1.5 system-ui,'Noto Sans KR',sans-serif;padding:16px 20px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:22px 0 6px}p.s{color:#9aa3b5;margin:2px 0 10px;max-width:1100px}
table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #2a2f3b;padding:6px 8px;vertical-align:top;text-align:left}
th{color:#9aa3b5;font-weight:600;font-size:12px}
img{image-rendering:pixelated;display:block}.art{background:#d6e4cd;padding:4px}.sil{background:#e8eef2;padding:4px}
.row{display:flex;gap:6px;align-items:flex-end}.sev{font-weight:700;font-size:18px}.s5{color:#ff6b6b}.s4{color:#ff9f5a}.s3{color:#ffd166}.s2{color:#9ad18b}.s1{color:#6fe3a5}
.k{color:#9aa3b5;font-size:12px}ul{margin:2px 0;padding-left:16px}.bad{color:#ff8a8a}.ok{color:#8fe3b0}.warn{color:#ffd166}
.cand{display:inline-block;margin:6px;vertical-align:top;background:#1d2029;padding:8px;border-radius:6px}.cand h3{margin:0 0 6px;font-size:18px}
.group{border-top:2px solid #333b4d;margin-top:24px;padding-top:8px}"""


def audit(out, audit_json, eyes_json):
    audit_data = json.loads(Path(audit_json).read_text())
    eyes = json.loads(Path(eyes_json).read_text())
    rows = sorted(audit_data["species"], key=lambda s: -s["severity"])
    trs = []
    for s in rows:
        sid = s["id"]
        f = load(BUNDLE / sid / "front.png"); b = load(BUNDLE / sid / "back.png")
        e = eyes[sid]
        def eyetxt(side):
            r = e[side]
            p = r["primary"]
            ptxt = f"주 눈 {p['w']}×{p['h']} · 면적 {p['area']} · 하이라이트 {p['hl']}" if p else "주 눈 후보 없음"
            return f"<span class='{'ok' if r['pass'] else 'bad'}'>{'통과' if r['pass'] else '탈락'}</span> · {ptxt}" + "".join(f"<br><span class='warn'>{m}</span>" for m in r["issues"])
        trs.append(f"""<tr><td><b>{sid}</b><br><span class='k'>{s['name']} · {s['stage']}단계</span><div class='sev s{s['severity']}'>{s['severity']}</div></td>
<td><div class='row'><div class='art'><img src='{uri(on_bg(f))}' width=64 height=64><div class='k'>앞 64px</div></div><div class='art'><img src='{uri(on_bg(f, 6))}' width=384 height=384><div class='k'>앞 6배</div></div></div></td>
<td><div class='row'><div class='art'><img src='{uri(on_bg(b))}' width=64 height=64><div class='k'>뒤 64px</div></div><div class='art'><img src='{uri(on_bg(b, 6))}' width=384 height=384><div class='k'>뒤 6배</div></div></div></td>
<td><div class='art'><img src='{uri(head_crop(f, tuple(s['face'])))}' width=300 height=240><div class='k'>앞 얼굴 10배</div></div></td>
<td><b>눈</b> {s['eye']}<div class='k'>자동 측정(앞): {eyetxt('front')}<br>(뒤): {eyetxt('back')}</div><b>입·표정</b> {s['mouth']}<br><b>몸 읽힘</b> {s['body']}<br><b>앞/뒤 일관</b> {s['consistency']}<br><b>도트 뭉개짐</b> {s['mush']}</td></tr>""")
    n = len(rows)
    front_pass = sum(1 for s in rows if eyes[s['id']]['front']['pass'])
    back_pass = sum(1 for s in rows if eyes[s['id']]['back']['pass'])
    html = f"""<!doctype html><meta charset=utf-8><title>몬스터 눈 점검 1</title><style>{CSS}</style>
<h1>기본 몬스터 15종 눈·자연스러움 점검 (번들 30장, 판본 2 그림)</h1>
<p class=s>결함이 가장 심한 순서(5 = 심각, 1 = 양호). 눈이 최우선. 점검은 원본 64px 와 6배 확대, 얼굴 10배 확대를 직접 열어 본 눈 판정이다.
자동 측정(checks/eyes.ts, 판본 3 규칙)은 필요조건 검사일 뿐이다 — 앞모습 주 눈 규칙 통과 {front_pass}/{n}, 뒷모습 눈 비침 없음 {back_pass}/{n}. 통과해도 눈이 죽어 보일 수 있다(예: gustchick 은 통과하나 눈이 윤곽색에 묻힌다).</p>
<table><tr><th>종 · 심각도</th><th>앞모습</th><th>뒷모습</th><th>얼굴</th><th>판정</th></tr>{''.join(trs)}</table>"""
    Path(out).write_text(html)
    print("wrote", out, len(html) // 1024, "KB")


def blind(outdir, species):
    """종마다 후보 시트(html) 하나. 눈가림: 번호만 노출."""
    outdir = Path(outdir)
    cands = json.loads((outdir / "candidates.json").read_text())
    for sid in species:
        c = cands[sid]
        parts = []
        for side in ("front", "back"):
            if side not in c:
                continue
            cells = []
            for item in c[side]:
                im = load(item["sprite"])
                face = ""
                if side == "front":
                    face = f"<div class='art'><img src='{uri(head_crop(im, tuple(item['face']), 24, 20, 12))}'><div class='k'>얼굴 12배</div></div>" if item.get("face") else ""
                cells.append(f"""<div class='cand'><h3>후보 {item['label']}</h3><div class='row'>
<div class='art'><img src='{uri(on_bg(im))}' width=64 height=64><div class='k'>원본 64px</div></div>
<div class='art'><img src='{uri(on_bg(im, 6))}' width=384 height=384><div class='k'>6배</div></div>
<div class='sil'><img src='{uri(mask_img(im))}' width=64 height=64><div class='k'>64px 실루엣</div></div></div>{face}</div>""")
            parts.append(f"<h2>{'앞모습' if side == 'front' else '뒷모습'}</h2>{''.join(cells)}")
        ctx = ""
        if c.get("context_front"):
            ctx = f"<h2>기준: 선택된 앞모습</h2><div class='art' style='display:inline-block'><img src='{uri(on_bg(load(c['context_front']), 6))}' width=384 height=384></div>"
        Path(outdir / f"sheet-{sid}.html").write_text(f"<!doctype html><meta charset=utf-8><title>{sid}</title><style>{CSS}</style><h1>{sid}</h1><p class=s>{c.get('brief', '')}</p>{ctx}{''.join(parts)}")
        print("wrote", outdir / f"sheet-{sid}.html")


def blind_png(out, items, context=None, title=""):
    """판정자용 눈가림 PNG 한 장. items = [{label, sprite, face}] — 번호만 노출. 후보마다 원본 64px · 6배 · 64px 실루엣 · 얼굴 12배."""
    from PIL import ImageDraw, ImageFont
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
    small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
    cw, ch = 384 + 12 + 288, 384 + 40
    cols = 2
    n = len(items) + (1 if context else 0)
    rows = (n + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (cw + 16) + 16, rows * (ch + 16) + 16 + 36), (20, 22, 28))
    d = ImageDraw.Draw(sheet)
    if title:
        d.text((16, 6), title, font=small, fill=(220, 224, 232))
    cells = ([("CONTEXT", context, None)] if context else []) + [(it["label"], it["sprite"], it.get("face")) for it in items]
    for idx, (label, path, face) in enumerate(cells):
        ox = 16 + (idx % cols) * (cw + 16)
        oy = 36 + 16 + (idx // cols) * (ch + 16)
        d.rectangle((ox - 4, oy - 4, ox + cw + 4, oy + ch + 4), fill=(32, 36, 46))
        im = load(path)
        d.text((ox, oy), "chosen FRONT (reference, context only)" if label == "CONTEXT" else f"candidate {label}", font=font if label != "CONTEXT" else small, fill=(255, 255, 255))
        sheet.paste(on_bg(im, 6), (ox, oy + 36))
        if label != "CONTEXT":
            sheet.paste(on_bg(im), (ox + 384 + 12, oy + 36))
            sheet.paste(mask_img(im), (ox + 384 + 12 + 80, oy + 36))
            d.text((ox + 384 + 12, oy + 36 + 66), "64px   silhouette", font=small, fill=(180, 186, 200))
            if face:
                fc = head_crop(im, tuple(face), 24, 20, 12)
                sheet.paste(fc, (ox + 384 + 12, oy + 36 + 100))
                d.text((ox + 384 + 12, oy + 36 + 100 + 242), "face crop x12", font=small, fill=(180, 186, 200))
    sheet.save(out)


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "audit":
        audit(sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == "blind":
        blind(sys.argv[2], sys.argv[3].split(","))
    else:
        raise SystemExit(__doc__)
