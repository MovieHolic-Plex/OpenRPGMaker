#!/usr/bin/env python3
"""modern_campus 다시 그리기 결과 페이지 → ~/claude-viz/campus-bake.html (자체완결, data URI).
   python3 bake_page.py [--qa /tmp/campus-redo/qa] [--compose /tmp/campus-redo/compose] [--assist /tmp/campus-gem/assist.json]
   QA·조수 시험 그림은 저장소 밖 작업 폴더에서 읽는다(없으면 그 절을 뺀다)."""
import json, os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
MC = os.path.dirname(HERE)
ROOT = os.path.abspath(os.path.join(MC, '..', '..', '..'))
sys.path[:0] = [HERE, MC, os.path.join(MC, 'interior')]
import page as P
import bake_mc as BM
import campus_interior as CI
import props as PR
TB = BM.TB


def arg(n, d):
    return sys.argv[sys.argv.index('--' + n) + 1] if '--' + n in sys.argv else d


QA, COMP, ASSIST = arg('qa', '/tmp/campus-redo/qa'), arg('compose', '/tmp/campus-redo/compose'), arg('assist', '/tmp/campus-gem/assist.json')
body = []
rep = json.load(open(os.path.join(ROOT, 'tiledata/modern-campus/bake-report.json')))
sheet = Image.open(os.path.join(ROOT, 'public/assets/modern-campus/modern-campus-chipset.png')).convert('RGBA')

# 관문
rows, cards = [], {'terrain': [], 'buildings': [], 'props': [], 'interior': []}
lawn = Image.open(os.path.join(ROOT, 'tiledata/modern-campus/terrain/_gate/mc-lawn.png')).convert('RGBA') if os.path.exists(os.path.join(ROOT, 'tiledata/modern-campus/terrain/_gate/mc-lawn.png')) else None
for it in BM._art_items():
    st = TB.gate_status(it['png'], it['kind']) if os.path.exists(it['png']) else 'PNG 없음'
    ok = st in ('pass', 'prov')
    rows.append((it['group'], ok))
    if ok: cards[it['group']].append((it['id'], Image.open(it['png']).convert('RGBA'), it['kind']))
for id_, (a, kind, ko) in CI.kit_images().items():
    im = Image.fromarray(a, 'RGBA'); st = TB.gate_status(im, kind); ok = st in ('pass', 'prov')
    rows.append(('interior', ok))
    if ok: cards['interior'].append((id_, im, kind))
tab = '<table><tr><th>묶음</th><th>통과(임시)</th><th>막힘</th></tr>' + ''.join(
    '<tr><td>%s</td><td>%d</td><td>%d</td></tr>' % (g, sum(1 for gg, ok in rows if gg == g and ok), sum(1 for gg, ok in rows if gg == g and not ok))
    for g in cards) + '</table>'
drop_out, drop_in = getattr(PR, 'DROPPED', []), getattr(CI, 'DROPPED', [])

body.append('<p>Opus 가 코드 손 도트로 처음부터 다시 그린 판입니다. 첫 판(Sonnet 초안)의 그림은 쓰지 않았습니다. 3/4 시점(윗면과 남쪽 앞면)이고, 팔레트는 modern3 램프입니다. '
            '관문은 object-gate(gemini-3.8-flash 넷 중 과반)입니다. 프로필을 아직 보정하지 않아서 모든 통과는 <b>임시통과</b>입니다.</p>')
body.append('<h2>1. 관문 현황 — 구운 조각 전부 통과, 끝까지 떨어진 14종은 뺐다</h2>' + tab +
            '<p>뺀 야외 조각: %s<br>뺀 실내 조각: %s<br>네 판까지 다시 그려도 떨어진 것들입니다. 기준을 낮추지 않고 칩셋에서 뺐고, 참고문서 「없는 소재」에 적었습니다.</p>'
            % (', '.join(drop_out), ', '.join(drop_in)))
T = rep['tiles']
body.append('<h2>2. 구운 시트</h2><p>%d칸(%d×%dpx) · 키트 %d · 애니메이션 스트립 %d · 그룹 %d · 야외 조각 %d · 실내 기물 %d(새 %d + jp_city 학교 기물 재사용 %d) · 정의 위반 %d · 재조립 불일치 %d</p><div class=wide>%s</div>' % (
    T['count'], T['sheetPx'][0], T['sheetPx'][1], T['kits'], T['strips'], T['groups'], T['outdoor_pieces'], T['interior_objects'],
    rep['interior_gate']['new_gated'], len(rep['interior_gate']['legacy_reused']), rep['definition']['violations'], rep['reassembly']['mismatched'],
    '<img src="%s" width=%d>' % (P.uri(sheet, 2), sheet.width * 2)))
bg = P.ground_bg(lawn, 2) if lawn else None
for g, title in (('buildings', '건물'), ('props', '소품·나무'), ('terrain', '바닥'), ('interior', '실내 가구·바닥·벽면')):
    z = 2 if g == 'buildings' else 3
    body.append('<h2>3. 조각 — %s (%d)</h2><div class=grid>%s</div>' % (title, len(cards[g]), ''.join(
        P.card(i, im, z, k, bg if g in ('buildings', 'props') else None) for i, im, k in cards[g])))


def img(path, z=1, w=None):
    if not os.path.exists(path): return '<i>(없음 %s)</i>' % os.path.basename(path)
    im = Image.open(path).convert('RGBA')
    return '<img src="%s" width=%d>' % (P.uri(im, z), w or im.width * z)


DEFECTS = [
    ('D1', '나무 밑 「그늘 잔디」 칸이 딱딱한 네모로 보임', '그늘 칸을 쓰지 않음'),
    ('D2', '들꽃이 잔디 전체에 자잘한 점 잡음', '큰 덩이 잡음 + 드문 무리'),
    ('D3', '48×36 학교에서 운동장이 빠짐', '주 통로 옆 전폭 사용'),
    ('D4', '큰 빈 잔디밭', '7×7 빈 곳에 숲 덩이(나무+관목)'),
    ('D5', '같은 나무가 같은 간격으로 늘어선 줄', '간격 흔들기 + 관목 쌍'),
    ('D6', '대학 도서관 두 채가 나란히', '같은 키트 두 번 고르지 않음'),
    ('D7', '쿼드 둘레 회색 길이 화면을 덮음', '양옆 다리 제거·북쪽 벽돌 길·철쭉 화단'),
    ('D8', '시계탑이 어느 씨앗에서도 서지 않음', '쿼드가 낮으면 교문 가로수길 옆에 세움'),
    ('D9', '기숙사 서랍장이 방 가운데 떠 있음·4호실 텅 빔', '벽에 붙이고 책상·서랍장 추가'),
    ('D10', '교실 뒤 서가가 책상 줄에 붙음', '뒷줄 책상을 줄여 통로 확보'),
    ('D11', '강의실 PC 카트가 바닥 가운데 떠 있음', '벽 쪽으로'),
]
body.append('<h2>4. 적대적 시각 QA 한 번 — 결함 11 → 고침 11</h2><table><tr><th></th><th>결함</th><th>고친 것</th></tr>%s</table>'
            '<p>장면을 원 해상도로 잘라 보았습니다. 고친 뒤 다시 렌더한 장면은 배치 검사기(BFS 포함)에서 오류 0, 엔진 실내 조립 5/5, 엔진 통행 검사 72판 중 실패 0이었습니다.</p>'
            % ''.join('<tr><td>%s</td><td>%s</td><td>%s</td></tr>' % d for d in DEFECTS))
for n, label in (('school-1', '학교 52×40 seed 1'), ('university-2', '대학 56×44 seed 2'), ('school-5', '학교 48×36 seed 5'), ('university-7', '대학 52×40 seed 7'),
                 ('school-class-wing', '교실 동(엔진 조립)'), ('dorm-2f', '기숙사 2층(엔진 조립)')):
    body.append('<h3>%s — 전 / 후</h3><div class=grid><div class=card>%s<div class=nm>전</div></div><div class=card>%s<div class=nm>후</div></div></div>'
                % (label, img('%s/before/%s.png' % (QA, n), 1), img('%s/after/%s.png' % (QA, n), 1)))
body.append('<h3>그 밖의 실내(후)</h3><div class=grid>%s</div>' % ''.join(
    '<div class=card>%s<div class=nm>%s</div></div>' % (img('%s/after/%s.png' % (QA, n), 2), n) for n in ('school-special-wing', 'dorm-1f')))
if os.path.isdir(COMP):
    body.append('<h2>5. 조수 도구 compose_campus_grounds — 엔진 통행 검사 통과 판</h2><div class=grid>%s</div>' % ''.join(
        '<div class=card>%s<div class=nm>%s</div></div>' % (img(os.path.join(COMP, f), 1), f[:-4]) for f in sorted(os.listdir(COMP)) if f.endswith('.png')))
if os.path.exists(ASSIST):
    A = json.load(open(ASSIST))
    body.append('<h2>6. 실제 조수 시험 — gemini-3.8-flash (reasoning high), 실제 입력창 경로</h2><p>%s</p>' % A.get('intro', ''))
    for rnd in A['rounds']:
        body.append('<h3>%s</h3>' % rnd['title'])
        for c in rnd['cases']:
            body.append('<div class=card style="margin:8px 0"><div class=nm><b>「%s」 — %s/10</b> · %s</div><div class=nt style="max-width:1400px">%s</div><div class=grid>%s</div></div>' % (
                c['prompt'], c['score'], c.get('meta', ''), c['why'], ''.join(img(p, c.get('zoom', 1)) for p in c['images'])))
P.write('campus-bake', 'modern_campus 다시 그리기 — 굽기·관문·QA·조수 시험', '\n'.join(body))
print(os.path.join(P.VIZ, 'campus-bake.html'))
