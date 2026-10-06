# 적궁궁녀 GIF 시간표

모든 GIF는 native64×64, 투명 배경, 원본 18색 고정 팔레트, 무한 반복이다. 프레임 보간이나 합성 중간 자세를 쓰지 않는다. 시간은 ms이다.

| GIF | 직접 저작 프레임 순서와 유지 시간 | 합계 |
|---|---|---:|
| idle | idle_a 240 → idle_b 240 → idle_c 240 → idle_b 240 | 960 |
| attack | idle_a 180 → windup 260 → move 100 → attack 150 → recover 200 → idle_a 220 | 1110 |
| hit | idle_a 240 → hit 180 → recover 220 → idle_a 240 | 880 |
| dead | hit 180 → dead 1200 | 1380 |
| skill | idle_a 180 → skill_a 320 → skill_b 160 → skill_c 300 → idle_a 240 | 1200 |
| poison | poison_a 420 → poison_b 420 | 840 |
| stun | stun_a 360 → stun_b 360 | 720 |
| sleep | sleep_a 700 → sleep_b 800 | 1500 |

## 손·시위·화살자리 앵커 (native 좌표, x/y는 0부터)

- 대기: 활손 피부는 x=46–48, y=40–42에서 소매 끝과 만나고 활 파지는 x=49–52이다.
- 준비: 현손은 x=35–38, y=29–32에서 목 아래로 당긴다. 현의 당긴 지점/화살 꼬리는 약 (38,30). 활손의 손가락은 x=48–51, y=31–32, 파지는 x=52–55, y=31–33이다. 활팔의 소매 면과 피부 면을 별도로 남겼다.
- 전진: 같은 활팔과 현손 경로를 유지하며 팔꿈치와 파지가 앞쪽으로 펼쳐진다. 아래팔과 화살은 서로 다른 높이이다.
- 방출: 같은 활손의 파지는 x=53–56, y=31–33. 현손은 뒤 어깨 쪽 x=26–32, y=26–30으로 회수된다. 짧은 일반 화살은 활 화살자리에서 x=62까지 보인다.
- skill_a: 활 화살자리의 핵은 약 (50,30); 따뜻한 v/e 중심과 h/r 외곽을 직접 찍었다. 현손·소매와 핵 사이를 화살자리/현으로 이어 놓았다.
- skill_b: 발사 줄기는 실제 활 앞 (54,31)에서 시작해 x=62까지 간다. 위쪽 깃 갈래는 y=23–29, 아래쪽 깃 갈래는 y=33–38의 별도 군집이다. 효과 아래의 손목/파지는 y=32–33에서 남는다.
- skill_c: 활은 y=42–44의 낮은 손으로 돌아오고, 그 옆 y=35–49의 끊어진 작은 깃 군집이 식는다. 다른 큰 원 오라로 대체하지 않았다.
- 수면: 두 자세 모두 활손/소매는 y=51–53에서 파지와 이어진다. 무릎/신발은 y=54–60이며, sleep_b에서는 눈꺼풀·턱·어깨/가슴 윤곽만 조금 더 낮고 압축된다.

## 파일

- `motions/`: 위 8개 실제 GIF.
- `previews/*-gif-decoded.png`: 저장한 GIF의 실제 디코딩 프레임 및 실제 유지 시간.
- `previews/<pose>.png`: 각각의 64×64 원본 PNG.
- `previews/<pose>-diagnostic.png`: 밝은/어두운/체커, 원본1배와 최근접3배.
- `poses-sheet.png`: idle_a/b/c, windup/move/attack, recover/hit/dead의 native3×3.
- `actions-sheet.png`: skill_a/b/c, poison_a/b/stun_a, stun_b/sleep_a/sleep_b의 native3×3.
- `preview.html`: 8GIF와 18PNG 로컬 관찰 화면. 브라우저 재생 확인의 환경 제한은 AUTHORING.md에 기록했다.
