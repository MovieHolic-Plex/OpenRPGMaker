#!/usr/bin/env python3
"""Scarloxy People 변형 칩 증거 시트(자체완결 HTML). 사용: python3 scarloxy_sheet.py --out ~/claude-viz/monster-people-chips-1.html [--runs DIR]
뼈대 10명 표(직업·외형·빈 직군) · 설치 칩 전부(방향별 8배 + 걷기 1배) · 고른 근거(뼈대와 다른 화소 비율) · 기각 Argon 후보 · Argon 주문서 · 버릴 번호만 묻는 줄."""
import argparse
import base64
import html
import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import scarloxy_distinct as D  # noqa: E402

ROOT = HERE.parents[2]
BG = (122, 160, 122, 255)


def b64(im):
    b = io.BytesIO()
    im.save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def onbg(im):
    bg = Image.new('RGBA', im.size, BG)
    bg.alpha_composite(im)
    return bg


def cell(sheet, idx):
    return sheet.crop(((idx % 4) * 72, (idx // 4) * 128, (idx % 4) * 72 + 72, (idx // 4) * 128 + 128))


def facing(chip, row, col=1):
    return chip.crop((col * 24, row * 32, col * 24 + 24, row * 32 + 32))


def four(chip, scale):
    """위·오른쪽·아래·왼쪽 서 있는 칸을 scale 배로 한 줄에."""
    w = 24 * scale
    out = Image.new('RGBA', (w * 4 + 6 * 3, 32 * scale), BG)
    for r in range(4):
        out.alpha_composite(facing(chip, r).resize((w, 32 * scale), Image.NEAREST), (r * (w + 6), 0))
    return out


def walk1x(chip):
    out = Image.new('RGBA', (72 * 2, 128), BG)
    out.alpha_composite(chip.resize((144, 256), Image.NEAREST).crop((0, 0, 0, 0)) if False else chip.resize(chip.size), (0, 0))
    return out


BASES = [
    ('Scarloxy1', 0, '청록 야구모자 소년', '청록 모자·주황 배낭·붉은 멜빵 — 등산·캠프', '등산가/캠퍼 (설치됨)'),
    ('Scarloxy1', 1, '금발 소년(상의 붉음)', '맨팔 금발, 붉은 상의·흰 하의', '수영·해변 (비키니 변형으로 설치)'),
    ('Scarloxy1', 2, '초록 벙거지 곱슬머리', '초록 벙거지·흰 민소매, 갈색 피부', '낚시꾼 (설치됨)'),
    ('Scarloxy1', 3, '보라 긴 머리', '남색 웃옷에 분홍 십자, 보라 긴 머리', '연구원 (설치됨)'),
    ('Scarloxy1', 4, '갈래머리 소녀', '분홍 리본 갈래머리·분홍 노랑 옷·붉은 신발', '트레이너(여)·어린이'),
    ('Scarloxy1', 5, '짙은 머리 소년', '짙은 머리·하늘색 민소매·주황 반바지', '학생·곤충채집·경찰(머리 이식)'),
    ('Scarloxy1', 6, '밀짚모자', '밀짚모자·흰 민소매·갈색 피부', '캠퍼·낚시·해변·레인저'),
    ('Scarloxy1', 7, '청록 긴 머리 원피스', '청록 긴 머리·분홍 귀 장식·파란 원피스', '간호사·신관·에스퍼'),
    ('Scarloxy2', 0, '붉은 불꽃 머리', '붉은 불꽃 머리·검은 가면·붉은 코트', '도장 보스(불 → 얼음·전기로 색 변형)'),
    ('Scarloxy2', 1, '초록 잎 머리', '초록 잎 머리·연두 튜닉', '숲지기·도장 보스(바위)'),
]

NEED = [
    ('연구원·박사', '있음(연구원·박사)', '흰 가운 깃이 큰 박사까지'),
    ('경찰·간호사·낚시꾼·곤충채집·캠퍼·등산가·레인저', '있음', ''),
    ('악당 조직 단원', '있음(남·여)', '두건·망토 같은 윤곽 변화는 없음'),
    ('도장 보스', '4종(얼음·전기·바위·에스퍼)', '땅·불·물 보스는 Argon 이 3회 안에 통과 못 함 → 빈 칸'),
    ('남학생', '1종(흰 셔츠 붉은 넥타이)', '교복 변형 더 필요'),
    ('요리사·상점 점원(앞치마)', '요리사 1종', '상인·점원은 Argon 이 구멍·앵커로 실패, 스크립트 후보는 뼈대와 비슷해 기각 → 빈 칸'),
    ('수영 선수·뱃사람·노인', '해변 관광객만', '수영 선수·뱃사람(기존과 61% 같음)·노인(126개 오류) 빈 칸'),
    ('큰 소품(낚싯대·잠자리채)·긴 가운 실루엣', '없음', '뼈대에 손 칸이 없어 Argon 도 쓰지 않음 → 이후 별도 소품 시트'),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--runs', default=str(Path.home() / 'spc-runs'))
    a = ap.parse_args()
    roster = json.loads((ROOT / 'src/assets/scarloxyPeopleCharsets.json').read_text())
    sheets = {n: Image.open(ROOT / f'public/assets/generated/charsets/ScarloxyPeople{n}.png').convert('RGBA') for n in range(1, roster['sheets'] + 1)}
    base_img = {n: Image.open(ROOT / f'public/assets/scarloxy/scarloxy-charset-people{n}.png').convert('RGBA') for n in (1, 2)}
    base_arr = [(f'Scarloxy{n}:{i}', np.array(cell(base_img[n], i)).astype(int)) for n in (1, 2) for i in range(8 if n == 1 else 2)]

    def nearest(chip):
        arr = np.array(chip).astype(int)
        return min(((D.score(arr, r), k) for k, r in base_arr))

    h = ['<!doctype html><meta charset="utf-8"><title>몬스터 세계 사람 칩 — Scarloxy 변형 1</title>',
         '<style>body{background:#161a1d;color:#e6e6e6;font:14px/1.5 sans-serif;margin:20px;max-width:1500px}h1{font-size:20px}h2{font-size:17px;margin-top:34px;border-bottom:1px solid #333;padding-bottom:4px}'
         'img{image-rendering:pixelated;display:block}table{border-collapse:collapse}td,th{border:1px solid #333;padding:4px 8px;vertical-align:top}th{background:#222}.grid{display:flex;flex-wrap:wrap;gap:12px}'
         '.c{background:#1f2428;border:1px solid #333;padding:8px;border-radius:6px}.c h3{margin:0 0 4px;font-size:13px}.m{color:#9fb0ba;font-size:12px;max-width:420px}.arg{border-color:#7a6a2a}.rej{border-color:#6b3030}code{background:#222;padding:1px 4px}.ask{background:#233326;border:1px solid #3c6b43;padding:10px;margin-top:16px}</style>']
    h.append('<h1>몬스터 세계 사람 걷기 칩 — Scarloxy People 변형 (설치 25종, 계열 scarloxy-people)</h1>')
    h.append('<p>뼈대는 Scarloxy MPWSP01 People1~2 의 <b>10명</b>(CC BY 4.0)뿐이다. 변형은 두 길이다: 스크립트(머리 이식+부위 색, 모델 없음) 21종, 실제 Argon(gemini-4-argon-high, 8318 스트리밍) 부분 편집 4종. 얼굴·피부·손·몸 비율은 12프레임 전부 화소 고정이다. 이 시트는 사람이 눈으로 거르는 용이다.</p>')

    h.append('<h2>1. 기존 Scarloxy 뼈대 10명 — 직업·외형·변형으로 채운 직군</h2><table><tr><th>칸</th><th>그림(방향 4)</th><th>외형</th><th>읽히는 직업</th><th>변형이 채운 곳</th></tr>')
    for sh, i, nm, look, use in BASES:
        n = int(sh[-1])
        h.append(f'<tr><td>{sh}#{i}<br>{html.escape(nm)}</td><td><img src="{b64(four(cell(base_img[n], i), 3))}"></td><td>{html.escape(look)}</td><td>{html.escape(use.split(" (")[0])}</td><td>{html.escape(use)}</td></tr>')
    h.append('</table>')
    h.append('<h2>2. 몬스터 세계 직군 대비 — 아직 빈 곳</h2><table><tr><th>필요한 직군</th><th>현재</th><th>빈틈·한계</th></tr>')
    for a1, a2, a3 in NEED:
        h.append(f'<tr><td>{html.escape(a1)}</td><td>{html.escape(a2)}</td><td>{html.escape(a3)}</td></tr>')
    h.append('</table><p class="m">한계: 뼈대가 모두 머리 큰 2.5등신 한 체형이라 키·체형은 같다. 실루엣은 모자·머리·가운 깃으로만 바뀐다. 얼굴 그림(faceset)은 새 칩에 아직 연결하지 않았다(후속).</p>')

    h.append('<h2>3. 설치된 칩 25종 — 방향별 8배(위·오른쪽·아래·왼쪽) + 걷기 12프레임 1배</h2><div class="grid">')
    rows = []
    for c in roster['characters']:
        chip = cell(sheets[c['sheet']], c['index'])
        d, nb = nearest(chip)
        model = c['source']['model']
        arg = model.startswith('gemini')
        rows.append((c, chip, d, nb, arg))
        num = f"ScarloxyPeople{c['sheet']}#{c['index']}"
        h.append(f'<div class="c{" arg" if arg else ""}"><h3>{num} · {html.escape(c["name"])}</h3>'
                 f'<img src="{b64(four(chip, 8))}">'
                 f'<div style="display:flex;gap:8px;margin-top:6px"><img src="{b64(onbg(chip))}"><div class="m">{html.escape(c["desc"])}<br>역할: {html.escape(c["role"] or "")}<br>'
                 f'경로: {"<b>Argon 실호출</b>" if arg else "스크립트"} · {html.escape(c["source"]["baseChip"])}<br>가장 가까운 뼈대 {nb} 와 다른 화소 {d:.0%}</div></div></div>')
    h.append('</div>')
    h.append('<h2>4. 고른 근거</h2><p>기준(제작자 위임으로 직접 거름): 칩셋 결이 뼈대와 같다 · 몸통·머리가 읽힌다 · 옷이 얼굴/손에 잘리지 않는다 · 12프레임이 하네스 구조 검사 통과 · '
             '<b>가장 가까운 기존 칩과 실루엣 화소의 색이 달라진 비율</b>이 스크립트 후보는 27% 이상, Argon 후보는 45% 이상. 색만 바꾼 후보는 직업이 달라도 같은 사람으로 읽혀 기각했다.</p>')
    h.append('<p>스크립트 기각: 교수(흰 머리 소년처럼 읽힘)·남학생 1(밋밋)·수영 선수(남성 머리에 상의 어색)·상인(구별 약함)·여학생/수영(여) 2종(머리·몸 윤곽 검사 불합격 후 재설계 실패).</p>')

    runs = Path(a.runs)
    rej = [('sp-r1/sp-sailor-a', '뱃사람', '하네스 통과했으나 뼈대 #2 와 61% 같은 화소, 흰 모자 윤곽도 같음'),
           ('sp-r1/sp-scientist-f-a', '연구원(여)', '통과했으나 뒷모습이 거대한 머리 덩어리, 간호사와 같은 흰 원피스 긴 머리'),
           ('sp-r2/sp-merchant-a', '상인(청록 모자)', '구멍만 메워 통과, 뼈대 #5 와 66% 같음 — 앞치마가 안 그려짐'),
           ('sp-r1/sp-chef-a', '요리사 시도 1(회색 모자)', '같은 요리사의 흰 모자 판이 더 뚜렷해 기각')]
    h.append('<h3>Argon 이 통과했으나 기각한 후보</h3><div class="grid">')
    for p, nm, why in rej:
        f = runs / p / 'chip.png'
        if f.exists():
            chip = Image.open(f).convert('RGBA')
            h.append(f'<div class="c rej"><h3>{html.escape(nm)}</h3><img src="{b64(four(cell(chip, 0) if chip.size == (288, 256) else chip, 5))}"><div class="m">{html.escape(why)}</div></div>')
    h.append('</div><p class="m">하네스가 3회 안에 통과시키지 못한 Argon 후보(오류 수): 상인 r1 [39,21,17]·수영 선수 [37,1,12]·남학생 r1 [81,28,3]·등산가 [59,8,9]·단원 [1,59,11]·노인 [126,65,78]·도장 보스(땅) [50,50,50] · 두 라운드 모두 대표 오류는 「몸 안쪽 구멍」「장비가 앵커에 안 닿음」「마스크 밖 칸을 바꿈」.</p>')

    spec = json.loads((ROOT / 'harness-data/charset-actor/scarloxy-people-spec.json').read_text())
    h.append('<h2>5. Argon 주문서 — 이번에 돌린 것과 다음 라운드</h2><table><tr><th>주문</th><th>뼈대</th><th>요구한 실루엣 변화</th></tr>')
    for ar in spec['archetypes']:
        for c in ar['candidates']:
            h.append(f'<tr><td>{html.escape(ar["name"])}</td><td>{c["base"]}</td><td>{html.escape(c["variant"])}</td></tr>')
    h.append('</table><p>실행(8318 스트리밍, 키는 환경변수에서만 읽음, 모델 gemini-4-argon-high 만):<br>'
             '<code>OPRN_LIVE_KEY="$(cat ~/.config/oprn/live-key)" CTFF6_PART_OUT=$HOME/spc-runs python3 src/harnesses/charset-actor/scarloxy_draw.py draw --spec harness-data/charset-actor/scarloxy-people-spec.json --model gemini-4-argon-high --run sp-r3 --label sp-merchant-a</code><br>'
             '2026-10-21 이후 Agy 로 돌리려면 <code>CHR_ARGON_BACKEND=agy</code> 를 앞에 붙인다. 구멍만 남은 후보는 <code>scarloxy_repair.py RUN/KEY</code>, 거름·굽기는 <code>install_scarloxy_people.py</code>(칸 번호 덧붙이기 전용).</p>')
    h.append('<div class="ask"><b>판단 한 가지:</b> 위 25종 중 <b>버릴 번호</b>만 알려 주세요(예: ScarloxyPeople3#6). 나머지는 그대로 둡니다.</div>')
    Path(a.out).expanduser().write_text('\n'.join(h), encoding='utf-8')
    print(a.out)


if __name__ == '__main__':
    main()
