"""도쿄 거리(modern3 팔레트) 탈것 전용 pxgrid 팔레트 — 글자 하나 = modern3 램프의 한 단. 맵에 들어갈 색만 쓴다."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts/content/atlas-pick'))

# 램프 → 글자들(어두운→밝은). 7단/5단/3단은 modern3 의 단 수 그대로.
LETTERS = {
    'conc':  ('1234567', '차체(중립 회색) 7단 — 1 가장 어둠 … 7 가장 밝음. 색 변형은 이 램프를 다른 램프로 바꿔 만든다'),
    'garasu': ('abcdefg', '유리 7단 — a 윤곽쪽 … g 반사 하이라이트'),
    'tekko': ('hijklmn', '검은 쇠 7단 — 아랫판·범퍼·창틀·윤곽(h,i)'),
    'sumi':  ('xyz', '타이어 3단 — x 가장 검음'),
    'shiro': ('STUVW', '흰색 5단 — 번호판·전조등 하이라이트·크롬'),
    'aka':   ('ABCDE', '빨강 5단 — 후미등·브레이크등'),
    'kii':   ('FGHIJ', '노랑 5단 — 방향등·전조등'),
    'sora':  ('KLMNO', '파랑 5단 — 사이렌·표시등'),
}

def ramps():
    from modern_style_bible_proof import RAMPS
    return RAMPS

def rgb(h): return ((h >> 16) & 255, (h >> 8) & 255, h & 255)

def write_pal(path):
    R = ramps(); lines = ['// 탈것 전용 팔레트 — 생성 파일(harness.py palette). 글자 하나 = modern3 램프 한 단. 이 밖의 색은 맵에 못 들어간다.',
                          '// `.` 투명/그대로, `_` 지우기, `~` 바닥 그림자(반투명)']
    for name, (chars, desc) in LETTERS.items():
        r = R[name]; assert len(r) == len(chars), (name, len(r))
        lines.append(f'@ramp {name} {" ".join(chars)}   // {desc}')
        for ch, c in zip(chars, r): lines.append('%s #%02x%02x%02x' % ((ch,) + rgb(c)))
    lines.append('~ #1c1418 90   // 바닥 그림자')
    open(path, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')

def legend():
    return '\n'.join(f'- `{chars}` = {name}: {desc}' for name, (chars, desc) in LETTERS.items())
