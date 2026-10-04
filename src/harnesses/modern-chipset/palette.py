"""modern4(도시 목표 톤) 팔레트 — 사용자가 준 위에서 내려다본 도시 그림의 색 덩이를 눈으로 읽어 채도 55% 로 눌러 재구성했다.
참고 그림은 제3자 자료라 화소를 복사하지 않고 저장소에 넣지 않는다(~/.local/share/oprn/modern-chipset/ref/). 시드 색만 아래에 적는다.
규칙으로 만든다(손으로 색을 더하지 않는다): 램프 = 시드 색을 가운데로 명도 5단(중립은 7단), 어두운 쪽은 청보라로, 밝은 쪽은 살구로 살짝 이동."""
import colorsys, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SAT = 0.55   # 목표 그림 대비 채도 (사용자: 너무 진하니 적절히 조절)

# 이름, 시드(목표 그림에서 읽은 대표색), 단 수, 설명
SEEDS = [
    ('road',  '#173d64', 5, '도로 남색 — 아스팔트'),
    ('slate', '#476772', 5, '보도·연석 청회색'),
    ('roof',  '#6c5d5a', 5, '평지붕 갈회색'),
    ('mint',  '#83aba2', 5, '건물 벽 민트'),
    ('teal',  '#11636e', 5, '청록 — 지붕 테두리·유리'),
    ('blue',  '#1e4da9', 5, '파랑 — 창·간판'),
    ('brick', '#aa3d20', 5, '벽돌 주황빨강'),
    ('wine',  '#5e0a24', 3, '적갈 — 간판 띠·처마'),
    ('amber', '#ffb94a', 5, '노랑 — 차선·횡단보도·불빛'),
    ('leaf',  '#2f7a5a', 5, '녹색 — 수목·화단'),
    ('body',  '#8f93a6', 7, '차체·콘크리트 중립 7단 — 색 변형은 이 램프를 다른 램프로 바꿔 만든다'),
    ('white', '#e4e9e8', 3, '흰색 — 지붕 난간 테두리·하이라이트·번호판'),
    ('ink',   '#0b1224', 3, '윤곽·타이어 — 순검정 아님'),
]
POOL = [c for c in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789']

def _hex(h): return tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))

def ramp(seed, n, sat=SAT):
    h, l, s = colorsys.rgb_to_hls(*_hex(seed)); s *= sat if n != 3 else 1.0
    half = n // 2; out = []
    for i in range(n):
        t = (i - half) / max(half, 1)                      # -1(어둠) … +1(밝음)
        li = min(.95, max(.09, l + t * (.17 if n >= 5 else .12) * (1.0 if t < 0 else .85)))
        hi = (h if n == 3 else h + (.64 - h) * .03 * (-t if t < 0 else 0) + (.08 - h) * .02 * (t if t > 0 else 0)) % 1.0   # 어둠→청보라, 밝음→살구
        si = min(1.0, s * (1.0 + (.18 if t < 0 else -.08 if t > 0 else 0) * abs(t)))
        r, g, b = colorsys.hls_to_rgb(hi, li, si)
        out.append('#%02x%02x%02x' % tuple(int(round(x * 255)) for x in (r, g, b)))
    return out

def build():
    """[(이름, 글자들, 색들, 설명)] — 글자는 풀에서 차례로."""
    res, k = [], 0
    for name, seed, n, desc in SEEDS:
        letters = POOL[k:k + n]; k += n
        res.append((name, ''.join(letters), ramp(seed, n), desc))
    assert k <= len(POOL)
    return res

LETTERS = {name: (chars, desc) for name, chars, cols, desc in build()}

def write_pal(path):
    lines = ['// modern4 팔레트 — 생성 파일(palette.py). 글자 하나 = 램프 한 단(어두운→밝은). 이 밖의 색은 못 쓴다.',
             '// `.` 투명/그대로, `_` 지우기, `~` 바닥 그림자(반투명)']
    for name, chars, cols, desc in build():
        lines.append(f'@ramp {name} {" ".join(chars)}   // {desc}')
        for ch, c in zip(chars, cols): lines.append(f'{ch} {c}')
    lines.append('~ #0b1224 90   // 바닥 그림자')
    open(path, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')

def legend():
    return '\n'.join(f'- `{chars}` = {name}: {desc}' for name, (chars, desc) in LETTERS.items())
