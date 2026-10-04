# 회색 늑대 — retro2003 손도트

원본: `scripts/asset-gen/pixel-enemy/wolf-grey.py` + 공통 출력기 `pe_lib.py`.
시트: `public/assets/generated/pixel-enemies/wolf-grey.png`.
리소스: `generated-enemy-wolf-grey` · motion `dash` · idleFrameMs `180`.

## 제작·규격

Python 3 + Pillow로 최종 격자에 다각형·선·개별 픽셀을 직접 찍은 OPRN Studio 원작.
AI 이미지 생성, 외부 몬스터 이미지의 축소·트레이스·팔레트 교체는 사용하지 않았다.
재배포 원작·라이선스는 저장소의 코드/자산 정책을 따른다. 아군 비교 그림은 기존 EasyRPG
Actor1-0 유도 시트이며 몬스터 원화 입력으로 쓰지 않는다(아군 출처: `assets/easyrpg/AUTHORS.md`).

- 셀 48×48, 3열×3행, 시트 144×144 RGBA, 실제 사용 8색(투명 제외), 알파 0/255.
- 오른쪽 보기, 몸 중심 x=24, 공통 바닥 y=44. 부유·도약 칸은 바닥 위를 허용한다.
- 화면은 원본의 정수 2배. 아군 비교는 **양쪽 같은 4배 nearest**이며 발 기준선을 맞춘다.
- 광원 왼쪽 위, 그림자는 오른쪽 아래에 면으로 묶고 선택적 외곽선을 쓴다.

긴 주둥이와 밝은 목털, 회청색 네 다리, 뒤로 뻗은 꼬리. 아군급 키의 사족수.

## 아홉 칸

| 행/열 | 0 | 1 | 2 |
|---|---|---|---|
| 0 | idle_a | idle_b | idle_c |
| 1 | windup | move | attack |
| 2 | recover | hit | dead |

windup 몸 낮춤 → move 앞뒤 다리를 뻗어 질주 → attack 입을 벌려 물기.
대기는 a→b→c→b. hit는 피격 칸, dead는 별도로 저작한 무너짐/소멸 윤곽이다.

## 재생성·직접 검토

```sh
python3 scripts/asset-gen/pixel-enemy/wolf-grey.py
```

실제 PNG 저장 후 재로드 일치, 팔레트·알파·칸 밖 침범을 검사한다.
GIF도 저장 후 매 10ms 시간축의 픽셀을 원본 순서와 대조한다(같은 칸 병합 허용).
미리보기는 `.omo/pixel-enemy-wolf-grey/`에 생성한다:

- `preview.png`: 4배, 칸 경계·포즈 이름·바닥선.
- `cycle.gif`: idle→windup→move→attack→recover→hit→dead.
- `gif-keyframes.png`: GIF 공격 구간의 네 칸을 한 줄로 검토.
- `scale.png`: 실제 actor1-0 idle 칸과 동일한 4배율 비교.
- `validation.json`: 색 수·칸별 경계·크기.

직접 `view_image`로 확인한 뒤 수정한 기록:
1. 등 윗면·배 그림자, idle 높이 분리, 귀 안쪽 음영.
2. 먼 쪽 두 다리를 추가해 네 다리로 수정. 황색 눈과 피격 눈 찡그림.

수정 전 산출물은 같은 검토 폴더 `round0/`, 첫 수정 후는 `round1/`에 보존했다.
