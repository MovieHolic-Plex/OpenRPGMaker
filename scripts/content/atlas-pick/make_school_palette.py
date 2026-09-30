#!/usr/bin/env python3
"""학원 세트 팔레트 tiledata/atlas-pick/palette/school.pal 을 만든다.
  python3 scripts/content/atlas-pick/make_school_palette.py

세 겹으로 쌓는다(앞에 온 램프가 바탕, 뒤는 더하기만).
  1. m* = 현대 칩셋 pal.RAMPS 그대로 — jp.pal 의 m* 램프와 글자 하나 다르지 않다. 강남·일본 세트와 섞어 깔 수 있는 이유.
  2. v* = 16px 손 도트 실내 v5 공통 램프(tiledata/hand-interior/pick/palette/v5.pal) 중 학교에 쓰는 것 — v5 방(여관·빵집…)의
     가구 결과 같은 색. 교실 나무·쇠·천은 이것부터 쓰면 v5 실내와 섞인다.
  3. 일본 세트와 같은 이름·같은 색(sakura hinoki washi ai) + 학교 전용 램프(칠판·사물함·리놀륨·체육관 마루 …).
검사(check_candidate.py)가 받는 색 = 이 파일의 색(반투명은 여기 적힌 (색, 알파)만).
작업자는 이 파일에 색을 더하지 않는다. 모자라면 감독자에게 말하고, 감독자가 여기서 램프를 고친 뒤 다시 돌린다
(그다음 make_school_jobs.py 로 기물 폴더의 palette.pal 사본을 갱신)."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa
import make_jp_palette

V5_PAL = os.path.join(ROOT, 'tiledata/hand-interior/pick/palette/v5.pal')
V5_TAKE = ['wood', 'dwood', 'pine', 'iron', 'brass', 'stone', 'linen', 'red', 'blue', 'green', 'yellow', 'glass', 'black', 'white', 'leaf']
JP_SHARE = ['sakura', 'hinoki', 'washi', 'ai']   # 일본 세트와 같은 이름·같은 색(교문 벚나무·신발장 나무·게시물 종이·교복 남색)

SCHOOL = {   # 학교 전용 (이름: 어두운 → 밝은). 몸통 채도 낮게, 어두운 끝은 붉은 보라·남색 쪽
    'kokuban': ['0e1a16', '16291f', '1e3a2c', '284c3a', '36604a', '4c765e', '6a8e78'],   # 녹색 칠판(흑판) 면 — 분필 글씨는 washi·vwhite
    'wboard':  ['7c8290', '9ea4b0', 'bfc4cc', 'dadde2', 'eceef0', 'fafbfc'],               # 화이트보드 면(푸른 기 도는 흰색)
    'cork':    ['4a2c14', '6e4422', '92603a', 'b07e52', 'c89c70', 'dcbc94'],               # 게시판 코르크
    'locker':  ['2a3038', '3e4652', '56606e', '707c8a', '8e9aa6', 'aeb8c2', 'cdd4da'],     # 쇠 사물함·캐비닛(회청색)
    'cream':   ['5e5644', '84795e', 'a89c7c', 'c8bc9a', 'ded4b6', 'eee8d2'],               # 교실·복도 벽 크림색 페인트, 쇠 책상 다리 도장
    'cfloor':  ['3e2412', '5e3a1c', '7e5430', '9e7046', 'ba8e60', 'd4ac80', 'e8cca2'],     # 교실 마루(꿀빛 참나무 널)
    'lino':    ['243028', '34443a', '48584c', '5e7062', '76887a', '94a496', 'b4c0b2'],     # 복도 리놀륨(회녹색)
    'gym':     ['5a3410', '80501c', 'a8702c', 'c89042', 'deae5e', 'eeca84', 'f8e2b0'],     # 체육관 마루(밝은 단풍나무 바니시)
    'gmat':    ['0c1e34', '143054', '1e4674', '2c5e94', '4a7eb2', '76a2cc'],               # 체육 매트(파랑 비닐)
    'jersey':  ['2a0c2a', '4a1640', '6a2458', '8a3670', 'a8568c', 'c47eaa'],               # 체육복·보건실 커튼 자주(적은 면적)
    'fence':   ['0e2418', '163822', '22502e', '346a3e', '4e8656', '72a474'],               # 옥상·운동장 철망 펜스(녹색 도장)
    'undo':    ['4e3c28', '6c5438', '8a6e4c', 'a48a64', 'bca47e', 'd4c09c', 'e8dcc0'],     # 운동장 마사토(흙)
    'stile':   ['4c5a64', '6c7c86', '8c9ca6', 'aabac2', 'c6d2d8', 'dee8ec', 'f2f8fa'],     # 화장실·과학실·급식실 타일(흰 푸른 기)
    'tray':    ['3a4044', '5a6266', '7e8688', 'a2a8aa', 'c2c6c6', 'dee0de'],               # 스테인리스 식판·배식통·국솥
    'uniform': ['10141e', '1a2030', '262e44', '343e58', '4a5670', '66728c'],               # 교복 감색·가방
}

def read_rampc(path):
    out = {}
    for line in open(path, encoding='utf-8'):
        m = re.match(r'@rampc\s+(\S+)\s+(.*)', line.split('//')[0])
        if m: out[m.group(1)] = [h.lstrip('#') for h in m.group(2).split()]
    return out

def main():
    sys.path.insert(0, MODERN_LIB)
    import pal
    v5 = read_rampc(V5_PAL)
    out = ['// 학원 세트 팔레트 — m* 현대 칩셋(jp.pal 과 같다) + v* v5 손 도트 실내 + 일본 공용 램프 + 학교 전용 램프.',
           '// 이 파일은 scripts/content/atlas-pick/make_school_palette.py 가 만든다. 손으로 색을 더하지 마라(검사가 이 밖의 색을 불합격시킨다).',
           '// 격자: @mat 글자 램프 [기본단] → @mblock / @tblock X Y 램프 / @tadj. 0 = 가장 어두움.', '',
           '// ── 1. 현대 칩셋 바탕(강남·일본 세트와 같은 색) ──']
    for name, ramp in pal.RAMPS.items():
        out.append('@rampc m%-7s ' % name + ' '.join('#' + h for h in ramp))
    out += ['', '// ── 2. v5 손 도트 실내 램프(v5 방 가구와 같은 색). 이름 앞 v ──']
    for name in V5_TAKE:
        out.append('@rampc v%-7s ' % name + ' '.join('#' + h for h in v5[name]))
    out += ['', '// ── 3a. 일본 세트와 같은 램프 ──']
    for name in JP_SHARE:
        out.append('@rampc %-8s ' % name + ' '.join('#' + h for h in make_jp_palette.JP[name]))
    out += ['', '// ── 3b. 학교 전용 ──']
    for name, ramp in SCHOOL.items():
        out.append('@rampc %-8s ' % name + ' '.join('#' + h for h in ramp))
    out += ['', '// 반투명(빛은 왼쪽 위 → 그림자는 오른쪽 아래). 가구 발치·책상 밑·처마 밑에만.',
            '~ #141218 110   // 그림자 속',
            '- #141218 58    // 그림자 번짐',
            '% #fff8d0 120   // 불빛 번짐(형광등·창으로 든 햇빛이 바닥에 비친 자리)',
            '& #cfe8f0 96    // 유리 반사(창·약품장 유리문·수조 — 뒤가 비치는 면)',
            '# #e040c0       // 실루엣 단계 표시색(최종본에 남으면 불합격)']
    os.makedirs(PAL_DIR, exist_ok=True)
    p = os.path.join(PAL_DIR, 'school.pal'); atomic_write(p, '\n'.join(out) + '\n')
    print(p, len(pal.RAMPS), '현대 +', len(V5_TAKE), 'v5 +', len(JP_SHARE), '일본 공용 +', len(SCHOOL), '학교')

if __name__ == '__main__':
    main()
