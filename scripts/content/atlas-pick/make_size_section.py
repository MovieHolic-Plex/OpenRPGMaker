import json
d=json.load(open('tiledata/atlas-pick/size-table.json'))
rows=d['rows']
def line(r):
    tr='; '.join(r['trims']) if r['trims'] else ''
    memo=r['note']
    if r['scale_exempt']: memo+=' (축약 관례 — 감사 제외)'
    return f"| {r['id']} | {r['name']} | {r['W']:.2f} x {r['D']:.2f} x {r['H']:.2f} | {r['wpx']} | {r['F_raw']} → **{r['F']}** | {r['T_raw']} → {r['T_c']:g} → **{r['T']}** | {r['total']} | {r['cells'][0]}x{r['cells'][1]} | {r['blocked'][0]}x{r['blocked'][1]} | {(memo+' ' if memo else '')}{('['+tr+']') if tr else ''} |"
head="| id | 물건 | 실제 W x D x H (m) | 폭 px | F 원본 → 최종 | T 원본(D x 16) → 압축 → 최종 | F+T | 캔버스 칸 | 막힘 칸 | 메모 [칸 맞추기] |\n|---|---|---|---|---|---|---|---|---|---|"
ind=[r for r in rows if r['group']=='실내']; out=[r for r in rows if r['group']=='실외']
txt='''## 12. 칸수 계산 — 1칸 = 16px = 1m (2026-09-30, 사용자 확정 16 px/m)

지금까지 칸수는 감으로 정했다(자판기 2x2, 서랍장 1x1 …). **실제 크기에서 계산**하도록 바꾼다. 계산기: `scripts/content/atlas-pick/size_calc.py`, 표 정본: `tiledata/atlas-pick/size-table.json`, 전수 점검: `tiledata/atlas-pick/size-audit.json`, 표준 캔버스 사이드카: `tiledata/atlas-pick/size-std.json`.
(이력: 같은 날 먼저 「주인공 170cm 기준 1 m = 14 px」 잠정 기준으로 만들어 `abcaf7dcc` 로 커밋했으나, 사용자가 「16x16 기준으로 칸수를 재설계」 를 확정해 이 절 전체를 16 px/m 으로 다시 썼다. 14 px 숫자는 이 절에 남기지 않는다.)

### 12-1. 기준
- **1 칸 = 16 px = 1 m.** 캔버스 폭(칸) = ceil(실제 폭 m). 폭 1.0 m 인 물건은 폭 16 px, 한 칸을 꽉 채운다.
- 주인공은 **16x24, 발자국 1칸 그대로**다.
- **모순(기록)**: 이 축척에서 주인공 24 px = **1.5 m** 로, 실사 170 cm 와 어긋난다(키 2.0 m 옷장이 32 px = 주인공의 1.33배). 주인공은 축약 캐릭터이므로 손대지 않고, 표는 히어로가 아니라 「1칸 = 1 m」 에 묶는다. 「히어로 옆에 세웠을 때 어색함」 은 이 모순의 부작용이므로 판단할 때 1.5 m 를 감안한다(옷장은 히어로보다 8px 크게 보이는 것이 정상).

### 12-2. 공식
| 값 | 식 |
|---|---|
| 그림 폭 px | 실제 폭 W(m) x 16 (칸 경계를 1 px 넘으면 1 px 깎음) |
| 캔버스 폭(칸) | ceil(W) |
| 앞면 F px | 실제 높이 H(m) x 16 |
| 윗면 T0 (원본) | 실제 깊이 D(m) x 16 |
| 윗면 T (압축) | T0 x **압축계수 c** (종류별 하한 tmin·상한) |
| 캔버스 높이(칸) N | N0 = ceil(F / 16) 에서 시작, **F + T <= 16 x N** 이 되는 첫 N |
| 막힘(blocked) | 폭 칸 x max(1, round(D)). 벽 붙은 가구·기둥은 깊이 1. 그 위 칸은 walk-behind(over) |

- **압축계수 c**: 윗면은 3/4 시점에서 세로로 눌려 보인다. 자립 가구 0.6(T 하한 4), 침대·의자·화분·긴 판 0.5, 벽 붙은 키 큰 가구 0.6(T 4~6), 가는 기둥 0.5(T 하한 2), 벽 부착 평면(칠판·문) T 0, 가로 진행 차량 0.30(T 하한 6), 세로 진행 차량 0.65(T 하한 6). **표에는 원본 T0 와 압축 T, 최종 T 를 모두 적는다.** F 도 원본(H x 16)과 최종을 함께 적는다.
- **넘침 규칙 (누가 먼저 양보하는가)** — F + T 가 16 x N 을 넘는 양을 o 라 할 때:
  1. o <= 6 px 이면 칸을 늘리지 않고 아낀다. **먼저 T(윗면)가 양보한다**: 종류의 하한 tmin 까지 줄인다(윗면은 4 px 아래로 가면 3/4 읽기가 무너진다).
  2. T 를 하한까지 줄이고도 남으면 **그다음에 F(앞면)가 양보한다**: 단 **4 px 이하이고 F 의 15% 이내**일 때만. 넘으면 칸을 하나 늘린다(N+1). (서랍장 F16 은 4 px = 25% 라서 F 는 못 깎는다.)
  3. o > 6 px 이거나 위가 안 되면 N+1.
  - 요약: **T → F → 칸 늘림** 순서. 앞면(F)은 사람이 알아보는 몸통이므로 마지막에, 그것도 4 px·15% 한도 안에서만 깎는다.
- **옷장 앞면을 깎는 규칙**: 키 2.0 m = F 32 px = 정확히 2칸이라 윗면 T 를 둘 자리가 없다. T 를 하한 4 로 두고 **F 를 4 px(12.5%) 깎아 F 28 + T 4 = 32** 로 정한다. 허용 범위는 F 26~28 / T 4~6(F+T = 32). 기본은 T 를 하한(4)에 두는 쪽이며 F 26 T 6 은 손이 갈 때만. 같은 규칙이 키 1.8 m 물건(사물함·약품장·자판기: F 29 → 28)에 적용된다.
- **축약 관례**(가로등·전봇대·신호등·차량·가로수·건물)는 화면 한 장에 넣으려고 줄이는 것이 게임 문법이다 → 감사에서 `exempt` 로 따로 센다.

### 12-3. 실제 크기 표 (실내)
'''+head+'\n'+'\n'.join(line(r) for r in ind)+'''

### 12-4. 실제 크기 표 (실외)
'''+head+'\n'+'\n'.join(line(r) for r in out)+'''

- 사용자 요구 예시와의 대조: 옷장 1.0x0.6x2.0 → 1x2 F 28 T 4(F 26~28·T 4~6 안) / 서랍장 1.0x0.5x1.0 → 1x2 F 16 T 5 / 자판기 1.0x0.8x1.8 → 1x2 / 침대 → 1x2(bed_single) / 책상 → 2x1(office_desk) / 문 → 1x2(door).

### 12-5. 쓰는 법
```
python3 scripts/content/atlas-pick/size_calc.py 1.0 0.8 1.8             # W D H(m) → 폭px·F·T·칸수·막힘
python3 scripts/content/atlas-pick/size_calc.py 1.0 0.6 2.0 --kind wall  # 벽 붙은 키 큰 가구
python3 scripts/content/atlas-pick/size_calc.py --table / --json        # 표 출력 / size-table.json 갱신
python3 scripts/content/atlas-pick/size_audit.py                        # 후보 전수를 표와 견주어 size-audit.json
```
새 물건은 `size_calc.py` 의 표 `T` 에 한 줄(실제 크기·종류)을 넣고 `--json` 으로 갱신한다. 표에 없는 물건은 가장 비슷한 행의 종류로 잰다.

### 12-6. 충돌 기록 — 「일본 자판기는 2x2」
- 사용자가 앞서 「일본 자판기는 2x2 사이즈로. 자판기를 여러 종류를 할거임.」 이라 했고 jp `vending_drink`·`vending_ice` info.json 에 `resized: [1,2] → [2,2]` 로 남아 있다.
- 16 px/m 표에서는 자판기 1대 = 폭 1.0 m = **16 px = 1칸**(1x2). 2x2 캔버스에 그리면 옆 자판기와 폭이 맞지 않는다.
- **해석**: 2x2 는 「자판기 **두 대 한 벌**(나란히)」의 칸수로 읽는다(`vending_pair`, 폭 32 = 2칸). 낱개 자판기는 1x2 로 정한다. 이 해석이 사용자 의도와 다르면 사용자가 다시 정한다 — 그때까지 **표(1x2)가 기준**이고, 기존 2x2 후보는 지우지 않고 두며 전수 점검에는 `alt`(쌍 해석)로 기록한다.
'''
txt+='''
### 12-7. h34-B 후보와 전수 점검 (16 px/m)
- **h34-B = 표 크기 그대로 그린 후보**(h34-A·v34-A 는 그대로 둔다). H 방법(Tibo 회색 상자 → C → Sonnet 손질) 을 같은 지시로 돌렸고, 생성 틀의 상자 비율만 표(폭 x (F+T), 윗면 띠 T)를 따른다: `H34_STD=1 python3 scripts/content/atlas-pick/ascii_h34_sets.py {frame|gen|c|e|emit} <세트>`. 표준 캔버스는 사이드카 `tiledata/atlas-pick/size-std.json` 이 들고 있어 info.json 은 건드리지 않는다(`common.std_of`·`canvas_for`; pick_server 가 `c['std']` 로 알려 준다).
- 아래 표: 그림 크기는 불투명 화소 바깥 상자, 표 크기는 size-table.json 의 폭 px x (F+T).

| 물건 | 표(칸 / 캔버스) | 표 폭x(F+T) | 그린 크기 | 검사기 |
|---|---|---|---|---|
| jp vending_drink | 1x2 / 16x32 | 16x32 (F28 T4) | 16x32 | check 합격, 3/4 검사 FRONT(윗면이 크림 한 색이라 띠가 얇다 — h34-A 도 같음) |
| jp vending_ice | 1x2 / 16x32 | 16x32 (F28 T4) | 16x32 | check 합격, 3/4 검사 TOPDOWN(하늘색 패널 판정 오차 — 눈 검수 필요) |
| school locker_row | 2x2 / 32x32 | 29x32 (F28 T4) | 29x32 | check 합격, 벽 붙이 판정 front(h34-A 와 같음) |
| school lab_cabinet | 2x2 / 32x32 | 24x32 (F28 T4) | 24x32 | check 합격, 벽 붙이 판정 front(h34-A 와 같음) |
| horror wardrobe_ajar | 1x2 / 16x32 | 16x32 (F28 T4) | 16x32 | check 합격(pxlint outline_black 경고), 벽 붙이 rim |
| horror dresser | 1x2 / 16x32 | 16x21 (F16 T5) | 16x20 | check 합격, 3/4 ok (t=9 f=10) |
- **폭 16 px 물건은 칸을 꽉 채운다**(옷장·자판기·서랍장). 여백이 없으므로 `check_candidate.py` 의 bg 규칙을 표준 후보에 한해 완화했다: 그림 폭이 표 폭과 같으면 「네 귀퉁이 중 둘 이상 투명」을 요구하지 않고, F+T 가 캔버스 높이와 같으면 「전체 불투명 금지」도 면제한다(자판기는 32줄 전부가 몸통이다).
- 알려진 한계: 3/4 검사기(view34_check)는 자판기를 FRONT/TOPDOWN 으로 잘못 읽는다(윗면·앞면이 같은 밝은 색). 옷장·사물함·약품장의 「front」 판정도 h34-A 와 같다. 눈 판정이 최종이다.
- **전수 점검**(`size_audit.py` → `size-audit.json`, 16 px/m 기준): 후보 162개 중 적합 59 / 너무 작음 29 / 너무 큼 21 / 혼합 1 / 판정 불가 52 / 축약 관례(제외) 9. 세트별: modern 30(ok 10·작 10·큼 0·불명 10·제외 5), jp 36(9·13·6·불명 8·제외 4), school 44(17·2·11·혼합 1·불명 13), horror 52(23·4·4·불명 21). 자판기 2x2 는 `alt`(쌍 해석)로 따로 적는다.
'''
p='tiledata/atlas-pick/modern-style-bible.md'
s=open(p).read()
i=s.index('## 12. 칸수 계산')
open(p,'w').write(s[:i]+txt)
