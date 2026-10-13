"""gothic_manor 실내 참고문서 번들 생성: python3 scripts/content/prepare-gothic-interior-references.py  (먼저 gothic-interior/plans.py 가 통과해야 한다)
출력: src/assets/gothicInteriorReferences.json (이미지 바이트 없음, /assets/gothic-interior-references/*.png 경로)."""
import os, sys, json, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(HERE, 'gothic-interior'))
import plans
from PIL import Image
if plans.main() != 0: sys.exit('plans.py 검증 실패')
OUT = plans.OUT; PIECES = plans.PIECES
meta = plans.META; batch = {json.loads(l)['label'].split('/')[1]: json.loads(l) for l in open(os.path.join(PIECES, '..', 'batch.jsonl'))}
# 조각 시트(보기용) — nearest 4배
ids = sorted(meta); W = 640; x = y = rh = 0; sheet = Image.new('RGBA', (W, 900), (46, 48, 58, 255)); pos = {}
for i in ids:
    im = Image.open(os.path.join(PIECES, i + '.png')).convert('RGBA'); s = 3
    if x + im.width * s > W: x = 0; y += rh + 6; rh = 0
    sheet.alpha_composite(im.resize((im.width * s, im.height * s), Image.NEAREST), (x, y)); x += im.width * s + 6; rh = max(rh, im.height * s)
sheet.crop((0, 0, W, y + rh)).save(os.path.join(OUT, 'pieces-sheet.png'))
anim = {n: Image.open(os.path.join(PIECES, 'anim', n + '_strip.png')) for n in ('candelabra', 'wall_sconce', 'night_window', 'fog')}
for n, im in anim.items(): im.resize((im.width * 5, im.height * 5), Image.NEAREST).save(os.path.join(OUT, f'anim-{n}.png'))
LAYER = {'wall_mounted': 'upper(벽 부착)', 'flat': 'lower(바닥 덧그림)', 'terrain': 'lower(바닥·벽면)'}
dic = '\n'.join(f"| `{i}` | {meta[i][0]*16}×{meta[i][1]*16} px ({meta[i][0]}×{meta[i][1]}칸) | {meta[i][2]} | {LAYER.get(meta[i][2], 'upper(기물, 아래 2줄 차단)')} | {batch[i]['name']} |" for i in ids)
f1, f2 = plans.manor(); hs = plans.hide_spots()
def arr(p): return '```\n' + '\n'.join(p.rows) + '\n```\n기물 [id, x, y]: `' + json.dumps([list(t) for t in p.items]) + '`\n접근칸: `' + json.dumps([d['access'] for d in p.doors + p.hide]) + '`' + (f' 계단칸: `{list(p.stairs)}`' if p.stairs else '')
md = f'''# gothic_manor 실내 — 기물 사전 · 저택 평면(1·2층) · 은신처 접근칸

> 2026-10-13. 코드 손 도트(`scripts/content/gothic-interior/pieces.py`)로 그린 실내 기물 {len(ids)}종. 전부 `object-gate`(gemini-3.8-flash x4 다수결) PASS 영수증이 현재 그림 화소 해시에 묶여 있다.
> 사람·글자·상표 없음, 3/4 시점(윗면 깊은 슬랩 + 앞면). 램프는 beodeul_city 보다 채도·명도 한 단계 낮춘 청회색·검붉음·고사목 갈색.
> **칩셋 칸 번호는 이 문서에 없다.** 시트에 굽는 번호는 gothic_manor 칩셋 굽기가 정한다 — 번호를 지어내지 말고 `tilesetId:"gothic_manor"` 의 `list_tileset_references`·킷 이름표에서 id 로 찾아 쓴다. 여기서는 조각 id·픽셀 크기·종류·차단 규칙만 정본이다. 탈락(4판 미통과, 쓰지 않음): `rope_post`(차단봉), 샹들리에 흔들림·불꽃 프레임.

## 1. 사전 (id · 크기 · 종류 · 레이어)
타일 16px, 좌표는 0기준 왼위 타일. 기물 접지선 = 그림 맨 아래 줄. **차단 판정**: kind 가 wall_mounted·flat·terrain 이 아니면 그림 높이의 아래쪽 최대 2칸 줄(폭 전체)이 통행 불가, 윗부분은 시각만(위층 레이어, 캐릭터 뒤).

| id | 크기 | 종류 | 레이어·통행 | 설명 |
|---|---|---|---|---|
{dic}

액자 3크기: `frame_s`(16×16) `frame_m`(32×32) `frame_l`(48×32) — 모두 벽 면 안쪽에 겹쳐 붙이는 wall_mounted. 조각 받침 = `plinth`, 유리 진열장 = `glass_case`, 거미줄 = `cobweb`(구석 겹침 한 장, 좌우 반전은 렌더 시 처리). 샹들리에 `chandelier`는 천장 쪽 장식이라 차단하지 않고 방 중앙 위쪽 기물 줄에 둔다(이 문서의 예제에서는 편의상 접지선 기준 배치).

![조각 시트](/assets/gothic-interior-references/pieces-sheet.png)

## 2. 실행 순서 (방 하나)
1. 바닥 전체: `floor_parquet`(거실·서재·복도) / `floor_checker`(전시실) / `floor_cellar`(지하실) / `floor_bath`(욕실). 방 하나에 바닥 한 종.
2. 벽면: 바깥 둘레와 칸막이 줄을 `wall_wallpaper`(지하실은 `floor_cellar` 를 벽에도 쓴다). 칸막이는 최소 1칸 두께, 방 안쪽 최소 3×3.
3. 벽 부착물(액자·창·거울·촛대 벽등·거미줄)은 **벽 칸의 윗줄**에: 겹침 우선순위 벽 < 부착물. 창 `night_window` 는 위쪽 벽 줄만(16×32 → 위 두 칸 벽에 걸침).
4. 큰 기물 → 작은 기물: 피아노·책장·옷장·침대·진열장 → 책상·탁자 → 의자·통·상자. 기물끼리 차단 줄이 겹치면 오류 `E_OVERLAP`.
5. 바닥 덧그림(`rug_runner`·`blood_stain`·`fog`)은 기물보다 먼저 깔고 기물이 위에 온다.
6. 문마다 **접근칸**(문 바로 앞 바닥 한 칸)을 비워 두고 시작 칸에서 4방향으로 닿는지 확인한다(`E_DOOR_ACCESS_BLOCKED`·`E_DOOR_UNREACHABLE`).
7. 위·아래층 계단 칸 좌표는 1층과 2층이 같아야 한다(`E_STAIR_MISMATCH`). 출입·계단 이벤트는 그림과 별개로 접근칸에 둔다.
금지: 문 앞 접근칸에 기물, 칸막이로 막힌 방, 바닥 종류 혼합, 차단 줄 겹침, 사람 모양 기물(인형은 장난감 상자 위의 작은 소품만).

## 3. 저택 평면 — 1층 (24×13칸, 완전 배열)
`#` = 벽 칸, `.` = 바닥. 바닥 `floor_parquet`.
{arr(f1)}

## 4. 저택 평면 — 2층 (24×13칸, 완전 배열)
바닥 `floor_bath`(욕실 구역 포함, 침실 쪽은 같은 바닥에 `rug_runner` 로 구분). 1층과 같은 계단칸 (19,9) 으로 이어진다.
{arr(f2)}

연결: 1층 (19,9) 의 계단 이벤트 → 2층 (19,9) 도착, 2층 접근칸 (19,5) 은 복도 쪽에서 계단으로 향하는 길. 두 층의 계단칸이 다르면 `E_STAIR_MISMATCH`.

![1층](/assets/gothic-interior-references/manor-1f.png)
![2층](/assets/gothic-interior-references/manor-2f.png)
(노란 칸 = 계단, 초록 칸 = 접근칸. 3배 nearest 확대. 이 그림은 `plans.py` 가 위 배열·기물에서 합성한 것이며 실제 맵 출력이 아니다.)

## 5. 은신처 접근칸 (옷장 · 침대 밑)
옷장은 문이 앞(남)면에 있고 **바로 아래 칸이 접근칸**, 침대 밑은 침대 그림 맨 아래 어두운 틈 앞 칸이 접근칸이다. 은신 이벤트(숨기)는 접근칸에서 위 방향 상호작용으로 걸고, 그림만으로 은신이 되지 않는다.
{arr(hs)}

정상 / 오류 그림(아래 두 장 — 오류는 접근칸에 상자·통을 놓아 막음):
![정상](/assets/gothic-interior-references/hide-room.png)
![오류](/assets/gothic-interior-references/hide-room-bad.png)

자동 좌표 검증(`scripts/content/gothic-interior/plans.py`, 실행 결과 `/assets/gothic-interior-references/validation.json`): 범위 `E_BOUNDS`, 차단 겹침 `E_OVERLAP`, 문 접근칸 막힘 `E_DOOR_ACCESS_BLOCKED`, 문 도달 `E_DOOR_UNREACHABLE`, 은신 접근칸 `E_HIDE_ACCESS`, 계단 `E_STAIR_MISMATCH`. 오류 표본 실제 검출: 옷장·침대 밑 접근칸 두 곳 `E_HIDE_ACCESS`(좌표 (1,4)·(6,4)), 계단 어긋남 `E_STAIR_MISMATCH 1F(19,9) 2F(18,9)`.
**확인 범위:** 구조·통행(BFS)만. 이벤트 실행, 미적 품질, 모델 성공률은 이 검사로 주장하지 않는다. 저장 전에 하나라도 오류면 부분 배치를 남기지 않는다.

## 6. 애니메이션 스트립 (3프레임 가로)
촛불 `candelabra`·벽등 `wall_sconce`(불꽃 3모양), 번개 창 `night_window`(어둠→약한 섬광→강한 섬광), 안개 `fog`(바닥 덧그림, 프레임마다 흐름). 기본 프레임은 0, 흔들림 주기는 프레임당 6~8틱 권장. 샹들리에 흔들림과 불꽃 프레임은 게이트 미통과라 없다.
![촛대](/assets/gothic-interior-references/anim-candelabra.png)
![벽등](/assets/gothic-interior-references/anim-wall_sconce.png)
![번개 창](/assets/gothic-interior-references/anim-night_window.png)
![안개](/assets/gothic-interior-references/anim-fog.png)
'''
def img(id, name, cap, path): return dict(id=id, name=name, caption=cap, dataUrl=path)
P = '/assets/gothic-interior-references/'
refs = [dict(id='gothic-interior-authoring', name='고딕 저택 실내 · 기물 사전·평면·은신처', description='gothic_manor 실내 기물 id 사전, 저택 1·2층 완전 배열 조립 예제, 옷장·침대 밑 접근칸 예제와 자동 좌표 검증.',
    documents=[dict(id='gi-guide', name='기물 사전 · 실행 순서 · 평면 · 은신처', markdown=md)],
    images=[img('gi-sheet', '기물 시트', '실내 기물 3배 nearest 확대', P + 'pieces-sheet.png'), img('gi-1f', '저택 1층', '1층 조립(노랑=계단, 초록=접근칸)', P + 'manor-1f.png'), img('gi-2f', '저택 2층', '2층 조립', P + 'manor-2f.png'),
        img('gi-hide-ok', '은신처 정상', '옷장·침대 밑 접근칸 열림', P + 'hide-room.png'), img('gi-hide-bad', '은신처 오류', '접근칸이 막힘(E_HIDE_ACCESS)', P + 'hide-room-bad.png')] +
        [img(f'gi-anim-{n}', f'애니 {n}', '3프레임 스트립 5배', P + f'anim-{n}.png') for n in anim])]
open(os.path.join(ROOT, 'src', 'assets', 'gothicInteriorReferences.json'), 'w').write(json.dumps(refs, ensure_ascii=False, indent=2) + '\n')
print('refs ok', len(md), 'chars')
