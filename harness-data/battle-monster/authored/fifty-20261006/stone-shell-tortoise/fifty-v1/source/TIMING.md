# 바위등거북 — 8동작 시간표

64×64 원본 격자를 그대로 재생한다. 프레임 사이의 합성·보간은 없다. GIF는 모두 투명 배경, disposal=2, 무한 반복이다. 타이밍은 10ms 단위로 저장했다. actual GIF를 다시 열어 원본 RGBA와 각 노출 시간을 확인했다.

| GIF | 자세 순서 | 노출 시간(ms) |
| --- | --- | --- |
| idle.gif | idle_a → idle_b → idle_c → idle_b | 240 / 240 / 240 / 240 |
| attack.gif | idle_a → windup → move → attack → recover → idle_a | 600 / 200 / 100 / 120 / 220 / 900 |
| hit.gif | idle_a → hit → idle_a | 700 / 180 / 900 |
| dead.gif | idle_a → hit → dead | 700 / 150 / 1700 |
| skill.gif | idle_a → skill_a → skill_b → skill_c → idle_a | 700 / 260 / 160 / 240 / 900 |
| poison.gif | poison_a → poison_b | 420 / 420 |
| stun.gif | stun_a → stun_b | 300 / 300 |
| sleep.gif | sleep_a → sleep_b | 650 / 650 |

## 접지와 공격

접지 기준은 y=60이다. windup에서 굽힌 뒷다리를 move에서 왼쪽으로 뻗어 추진을 읽게 했다. attack은 오른쪽 돌 어깨 x=42..47, y=31..44가 접촉 면이고, 넓은 앞발 x=34..49, y=55..60이 체중을 받는다. 목은 그 뒤로 회수된다. recover에서 앞발과 목을 순서상 다시 회수한다. 미리보기에는 게임 이동량이나 피해 이벤트가 없다.

## 석갑진 앵커

기술에는 손·무기·입 발사가 없다. 기의 시작은 등껍질 홈이며, 세 돌방패의 공통 뿌리는 등 앞쪽 x=20..40, y=25..31이다.

- skill_a / 260ms: 갑석 홈 x=15..36, y=25..43에 청록 기를 모음. 목을 세우고 발을 버틴다.
- skill_b / 160ms: 왼쪽 짧은 방패 x=12..21, y=14..23, 중앙 세로 방패 x=27..37, y=6..22, 오른쪽 비스듬한 방패 x=37..48, y=12..24. 각 돌방패에서 내려온 기의 줄기가 껍질 홈으로 이어진다. 가장 위 효과는 y=6이며 캔버스 밖으로 잘리지 않는다.
- skill_c / 240ms: x=19..47, y=17..29의 돌가루·파편과 끊어진 청록 군집으로 회수. 등 홈의 짧은 잔기만 남기고 목·가슴을 푼다.

## 상태 동작

독은 낮은 턱과 굽은 무릎, 교체되는 두 독 거품 군집을 유지한다. 기절은 머리를 어깨 아래에 늘어뜨리고 두 별의 위치와 목의 면을 바꾼다. 수면은 x=46..48, y=51의 닫힌 눈꺼풀을 고정하며 접힌 발·꼬리를 보존한 작은 호흡이다. 수면과 쓰러짐은 껍질 높이와 다리·턱의 배열이 다르다.

## 파일

- preview/poses.png: 기본 9자세, 투명 192×192, 3×3, 행 순서 idle_a/b/c · windup/move/attack · recover/hit/dead.
- preview/actions.png: 추가 9자세, 투명 192×192, 3×3, 행 순서 skill_a/b/c · poison_a/b/stun_a · stun_b/sleep_a/b.
- preview/<pose>.png: 각 자세 64×64.
- preview/<motion>.gif: 위 시간표의 8종 실제 GIF.
- preview/<motion>-gif-frames.png: 실제 GIF 디코드 확인판. 확대·라벨은 진단용이다.
