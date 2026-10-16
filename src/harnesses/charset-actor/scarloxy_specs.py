"""Scarloxy People1~2 뼈대(10명) 영역 분할 SPECS — partedit.SPECS 에 합쳐진다(partedit 끝에서 import).

뼈대 = Scarloxy MPWSP01(CC BY 4.0). 칩 배치는 RTP 와 같다(288×256, 8명=4열×2행, 24×32, 3패턴×4방향, 행 0 위·1 오른쪽·2 아래·3 왼쪽).
얼굴 상자 안과 맨살 글자는 고정 부위(F). 상자는 눈~턱을 가로 전부 담고, 머리 장식 구역·어깨 구역·장비 띠는 partedit 이 몸 둘레에서 자동으로 만든다.
분할은 원본 크기 격자와 8배 마스크 시트(`python3 partedit.py masks Scarloxy1:0 ... --out ~/claude-viz/x.html`)를 눈으로 보고 정했다.
held(손에 든) 장비용 hands 는 아직 없다 — Argon 으로 손에 든 소품이 필요해지면 베이스마다 손 칸을 정의해 덧붙인다(hip·back 장비는 지금도 된다).
Scarloxy 칩은 왼쪽 방향이 오른쪽 방향의 좌우 거울(1px 이내)이라 왼쪽 상자는 오른쪽 상자를 23-x 로 뒤집은 값이다.
"""


def _mirror(box):
    x0, y0, x1, y1 = box
    return (23 - x1, y0, 23 - x0, y1)


def _spec(down, right, t_start, waist, shoe_top, skin):
    return dict(face={'down': down, 'right': right, 'left': _mirror(right), 'up': None},
                t_start=t_start, waist=waist, shoe_top=shoe_top, skin=skin)


SCARLOXY_SPECS = {
    # 모자 트레이너 소년(청록 야구모자, 흰 재킷, 주황 배낭, 초록 바지)
    'Scarloxy1:0': _spec((7, 13, 17, 16), (9, 12, 17, 16), 17, 25, 29, 'tuql'),
    # 금발 소년(빨간 민소매, 흰 반바지)
    'Scarloxy1:1': _spec((8, 12, 17, 16), (8, 12, 16, 16), 17, 24, 29, 'okpqh'),
    # 초록 벙거지 소년(보라 머리, 흰 민소매, 보라 바지)
    'Scarloxy1:2': _spec((7, 12, 17, 16), (9, 12, 17, 16), 17, 24, 29, 'onjg'),
    # 보라 긴 머리 소녀(남색 웃옷, 분홍 십자 무늬, 청록 신발)
    'Scarloxy1:3': _spec((7, 11, 17, 16), (10, 11, 18, 16), 17, 26, 29, 'oqkh'),
    # 갈래머리 소녀(노란 웃옷, 분홍 반바지, 빨간 신발)
    'Scarloxy1:4': _spec((7, 15, 17, 18), (10, 15, 18, 18), 19, 25, 29, 'rvnjp'),
    # 보라 머리 소년(민트 민소매, 주황 반바지)
    'Scarloxy1:5': _spec((6, 15, 17, 18), (9, 15, 17, 18), 19, 26, 29, 'pqlj'),
    # 밀짚모자 농부(흰 민소매, 초록 반바지, 빨간 신발)
    'Scarloxy1:6': _spec((7, 16, 17, 19), (9, 16, 17, 19), 20, 26, 29, 'monj'),
    # 물 도장 보스(청록 긴 머리·분홍 귀, 파란 드레스·분홍 치마 — 치마가 발까지 내려와 신발이 따로 없다)
    'Scarloxy1:7': _spec((8, 9, 16, 15), (14, 9, 19, 15), 16, 27, 31, 'ilfp'),
    # 불 도장 보스(붉은 불꽃 머리, 검은 가면, 붉은 코트에 금빛 띠)
    'Scarloxy2:0': _spec((5, 8, 17, 15), (8, 8, 17, 15), 16, 27, 29, 'pnkh'),
    # 풀 도장 보스(초록 잎 머리, 연두 튜닉, 올리브 바지)
    'Scarloxy2:1': _spec((6, 12, 18, 16), (9, 12, 18, 16), 17, 26, 29, 'tqlu'),
}
