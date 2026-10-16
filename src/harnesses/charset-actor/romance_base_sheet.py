#!/usr/bin/env python3
"""현대 연애물 인물 칩 — 베이스 선택 시트(자체완결 HTML). 아무것도 설치하지 않는다. 고르는 것은 사용자다.
  python3 romance_base_sheet.py --out ~/claude-viz/chips-modern-romance-base-1.html
"""
import argparse
import base64
import html
import io
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import chr as C  # noqa: E402
import harness as H  # noqa: E402
from PIL import Image  # noqa: E402

BG = (92, 140, 70, 255)

# 종류 → (제목, 후보 [(베이스, ★?, 이유·우려)])
GROUPS = [
    ('남 · 교복 2색(남색 블레이저 · 회색 블레이저) + 캐주얄 사복', '고등학생·대학 새내기 남주/조연', [
        ('People1:0', True, '소년 체형에 짧은 갈색 머리, 원본이 이미 검은 재킷+청바지라 블레이저·후디로 바꾸기 쉽다. 머리 윤곽이 단순(이마가 가려져 눈이 잘 보임). 분할 SPEC 검증된 칩(CT 파일럿에서 사용).'),
        ('Actor4:1', False, '금발 곱슬 + 하늘색 셔츠. 얼굴·칼라·손이 모두 흰색(ffffff)이라 마스크 경계가 깨끗하지 않다 — 의복 바꾸기에 불리해 보류.'),
        ('Actor2:0', False, '마른 체형, 옆 꼬리 머리. 회색 상의+붉은 띠라 사복 후보지만 머리 면적이 얼굴을 반쯤 가려 표정이 약하다.'),
        ('People3:2', False, '파란 재킷+남색 바지(블레이저 느낌)지만 양 손이 큰 흰 장갑이라 맨손이어야 할 현대물에 어색.'),
        ('People1:2', False, '파란 헝클어진 머리·녹색 상의. 머리색은 리컬러되지만 상의 면적이 작아 후순위.'),
    ]),
    ('남 · 직장인 정장', '직장인·선배·상사 조연', [
        ('Actor4:0', True, '흰 셔츠 위 어두운 조끼/재킷 형태라 셔츠+넥타이+재킷으로 바꾸기 좋다. 남색 머리는 리컬러로 검정·갈색. 바지·신발이 분리돼 정장 바지·구두 리컬러 가능.'),
        ('People1:0', False, '교복과 같은 얼굴이 되므로 정장은 다른 얼굴로 가는 편이 인물 구분에 좋다.'),
        ('People2:4', False, '검은 뾰족 머리·보라 상의. 상의 색 변화는 쉽지만 머리 모양이 튄다.'),
    ]),
    ('남 · 선생 / 교수', '조연', [
        ('People4:1', True, '갈색 곱슬 머리 + 안경(안경이 얼굴 고정 영역이라 항상 유지된다). 녹색 스웨터 → 셔츠+조끼·카디건. 안경이 선생·교수 기호로 가장 직접적.'),
        ('People3:4', False, '흰 머리 노년. 교수 할아버지 타입에는 맞지만 연애 상대/선배로는 노인이라 보류(원하면 알려 주세요).'),
        ('People2:0', False, '중절모를 쓰고 있어 모자를 못 벗는다(모자는 머리 부위 일부 교체 한도 안).'),
    ]),
    ('여 · 교복 2색(세일러/블레이저 + 주름치마)', '고등학생·대학 새내기 여주/조연', [
        ('People1:1', True, '가장 작은 소녀 체형, A라인 치마 형태(허리 띠 + 치마 4줄)라 교복 치마·주름 표현이 쉽다. 금발 곱슬은 흑갈색·검정으로 리컬러. 긴 머리가 등을 덮지 않아 뒷모습 상의가 보인다.'),
        ('Actor4:6', False, '보라 긴 머리 + 무릎 아래 치마. 머리가 길어 뒷모습에서 상의가 가려진다(교복 뒷모습이 안 읽힘).'),
        ('Actor4:3', False, '하늘색 긴 머리 + 검은 코트. 코트 폭이 넓어 블레이저 교복으로는 길고, 긴 머리가 등을 덮는다.'),
        ('People3:5', False, '보라 머리 + 머리띠, 회색 갑옷풍 상의라 상의 모양을 많이 바꿔야 한다.'),
    ]),
    ('여 · 캐주얼 사복 / 직장인 정장(슬랙스)', '대학생·직장인 여주/조연', [
        ('People1:5', True, '단발 갈색 머리에 녹색 눈, 회색 상의+갈색 바지(치마 아닌 직선 하의)라 니트+청바지 / 블라우스+슬랙스로 바꾸기 좋다. 머리가 짧아 뒷모습 상의가 보인다.'),
        ('Actor4:4', False, '분홍 갈색 머리, 붉은 상의에 금 목도리. 목도리 면적이 커 상의 교체 공간이 좁다.'),
        ('People5:3', False, '기모노풍 상의라 현대 상의로 바꾸려면 면적 대부분을 칠해야 한다(교체 한도 초과 가능).'),
    ]),
    ('여 · 카페 앞치마', '아르바이트·바리스타 조연', [
        ('People5:5', True, '이미 흰 앞치마 원피스+푸른 소매 구성이라 앞치마를 \'의복 상의 T\'로 처리하기 가장 자연스럽다. 붉은 머리는 갈색/검정으로 리컬러. 치마가 발목까지 와 신발은 안 보인다(카페 유니폼 긴치마로 처리).'),
        ('People1:7', False, '노년 체형 + 주황 두건이라 연애 상대로는 부적합.'),
        ('People5:1', False, '작은 체형 두 갈래 머리 — 앞치마를 입히면 어려 보여 보류.'),
    ]),
]


def b64png(im):
    b = io.BytesIO()
    im.save(b, 'PNG')
    return base64.b64encode(b.getvalue()).decode()


def idle4(k, scale):
    pal, fr = H.base_of(k)
    im = Image.new('RGBA', (4 * 26, 34), BG)
    for i, d in enumerate(('down', 'right', 'up', 'left')):
        im.alpha_composite(C.frame_rgba(pal, fr[(d, 1)]), (1 + i * 26, 1))
    return im.resize((im.width * scale, im.height * scale), Image.NEAREST).convert('RGB')


def gif(k, scale):
    pal, fr = H.base_of(k)
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / 'w.gif'
        C.gif_walk(pal, fr, out, scale=scale, lawn=None, ms=170)
        return base64.b64encode(out.read_bytes()).decode()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    secs = []
    for title, role, cands in GROUPS:
        cards = []
        for k, star, why in cands:
            pal, fr = H.base_of(k)
            walk = f'<div><img src="data:image/gif;base64,{gif(k, 8)}"><div class="cap">원본 걷기 8× (위·오른쪽·아래·왼쪽 순환)</div></div>' if star else ''
            cards.append(f'<div class="card{" star" if star else ""}"><div class="k">{k} <span class="g">{H.base_label(k)}</span>{" <span class=st>★ 기본 선택</span>" if star else ""}</div>'
                         f'<div class="two"><div><img src="data:image/png;base64,{b64png(idle4(k, 6 if star else 4))}"><div class="cap">서 있는 그림 4방향(아래·오른쪽·위·왼쪽) {6 if star else 4}×</div></div>{walk}</div>'
                         f'<p class="why">{html.escape(why)}</p></div>')
        secs.append(f'<h2>{html.escape(title)} <small>{html.escape(role)}</small></h2><div class="row">{"".join(cards)}</div>')
    page = f'''<!doctype html><html lang="ko"><meta charset="utf-8"><title>현대 연애물 인물 칩 — 베이스 선택 시트 1</title>
<style>body{{background:#161a1d;color:#e6e6e6;font:15px/1.5 system-ui,sans-serif;margin:0;padding:24px 32px}}h1{{margin:0 0 6px}}h2{{margin:34px 0 6px;border-bottom:1px solid #3a4248;padding-bottom:4px}}small{{color:#8fa0aa;font-weight:400;font-size:13px}}
.how{{background:#1f272c;border:1px solid #3a4a55;border-radius:8px;padding:14px 18px;margin:12px 0;max-width:1100px}}.how code{{background:#0e1214;padding:1px 6px;border-radius:4px}}
.row{{display:flex;gap:14px;flex-wrap:wrap}}.card{{background:#1d2328;border:1px solid #333c43;border-radius:8px;padding:10px;width:900px}}.card.star{{border-color:#5a8f62}}
.k{{font:600 15px ui-monospace,monospace;color:#ffd479;margin-bottom:4px}}.g{{color:#8fa0aa;font-weight:400}}.st{{color:#7fe08a}}.two{{display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap}}.cap{{color:#8fa0aa;font-size:12px}}img{{image-rendering:pixelated;display:block}}.why{{margin:8px 0 2px;color:#cfd8dd;font-size:13.5px}}</style>
<h1>현대 연애물 인물 칩 — 베이스 선택 시트 1</h1>
<div class="how"><b>무엇을 보나</b><br>연애 게임용 현대 인물(교복·사복·정장·카페 앞치마·선생)을 만들기 전에, RTP 칩(Actor1–4·People1–5, CC BY 4.0) 72칩 중 <b>어느 칩을 몸으로 쓸지</b> 정합니다. 선택한 칩에서는 <b>의복(상의·하의·신발)과 머리</b>만 바꾸고, 얼굴·피부·손·몸 비율·걷기는 그대로 둡니다(그래서 베이스의 얼굴이 곧 결과의 얼굴).<br>
녹색 테두리 ★ 카드가 <b>제가 기본으로 고른 베이스</b>입니다. 이 베이스로 바로 후보 그림을 그리기 시작합니다(중간 보고 후 계속). 다른 칩을 쓰고 싶으면 칩 번호를 알려 주세요(예 <code>남 교복=Actor4:0</code>) — 그 종은 다시 그립니다.<br>
한계: RTP 칩은 머리가 큰 2.5등신이라 교복·정장 윤곽이 \'현대 만화\'가 아니라 RPG 칩 느낌입니다. 가방·안경·이름표 같은 소품은 이번 범위 밖입니다(장비 앵커 방식이 다른 작업에서 개편 중).</div>
{"".join(secs)}</html>'''
    out = Path(a.out).expanduser()
    out.write_text(page, encoding='utf-8')
    print(out, len(page), 'bytes')


if __name__ == '__main__':
    main()
