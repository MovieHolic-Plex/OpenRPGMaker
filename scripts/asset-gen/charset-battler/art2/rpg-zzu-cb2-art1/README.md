# 2차 시전 도트 — 담당 여섯 명

담당: actor3-0, actor1-0, actor1-1, actor1-2, actor1-3, actor1-4.

actor3-0은 걷기 칩의 사무라이 외형을 보존하되 **데모 마도사 역할이 우선**이다.
24포즈 전부 지팡이로 다시 만들었다. actor1-1·actor1-4는 지팡이,
actor1-0은 검, actor1-2·actor1-3은 검과 방패를 유지한다.
걷기 세 칸에도 장비를 붙이고, 기존 공통 시전 세 칸은 새 비전 시전으로 교체했다.
무기를 숨기던 아이템·빈사·쓰러짐·정면 칸도 장비를 이어 붙였다.

## 저작과 출처

- 그림 원본: `public/assets/easyrpg/charset/Actor1.png`, `Actor3.png`.
- 장비 도안 참고: `public/assets/easyrpg/battle-weapon/Weapon.png`. 손잡이·평행 명암·지팡이 머리를 정수 좌표로 재저작했다.
- Actor1: Marina Navarro Travesset(기본), VictorSena(편집), CC-BY.
- Actor3: VictorSena, CC-BY.
- Weapon: russidan(Alephman), CC-BY.
- 상세 출처와 원저자 링크: `public/assets/easyrpg/AUTHORS.md`.
- 기존 1차 `art/rpg-zzu-cb-art1/paint.py`, `art/rpg-zzu-cb-art4/draw.py`의 머리·몸통 분해와 관절 함수를 읽기 전용으로 재사용한다.
- 새 AI 그림·외부 그림·화살·화면 횡단 투사체를 쓰지 않았다.

머리와 몸통은 원본 도트, 팔·손·다리는 정수 관절 좌표다. 완성 캐릭터 전체를 회전하거나 기울이지 않는다.
시전 지팡이는 시전 손이나 보조 손에 남고, 검은 보조 손으로 들어 빈손 시전을 보여준다.
기사 방패는 시전 중 등 뒤 끈으로 건다. 2차 검토에서 얼굴을 가리던 칼날은 보조 손 위치부터 고쳤다.

## 마법 구분

`cb_lib.CAST_TYPES` 순서 7행, 단계 1→2→3은 각 행의 3열이다.

| 마법 | 관절 동작 | 빛 |
|---|---|---|
| fire | 허리 뒤 두 손 → 가슴 앞 집중 → 앞발과 함께 밀기 | 원본 주황·빨강 |
| ice | X 교차 → 위아래 크게 벌림 → 머리 위 손과 앞손 | 하늘·흰색 |
| thunder | 무릎 굽혀 뒤로 당김 → 수직으로 올림 → 앞 아래 내려찍기 | 노랑·흰색 |
| heal | 숙여 기도 → 양옆 위로 펼침 → 부드럽게 내밂 | 연두·흰색 |
| dark | 웅크려 얼굴 앞 손 → 뒤로 휘감기 → 세 갈래 갈퀴 | 보라·검정 |
| arcane | 앞에 세워 집중 → 머리 위 원 → 앞으로 겨누기 | 청록·흰색 |
| support | 손목 올림 → 옆으로 쓸기 → 입 앞 손바닥 | 분홍·보라 |

추가색은 캐릭터당 전투·시전을 합쳐 여섯 개다. 원본에 없는 연두·보라·분홍·청록·하늘·노랑만 추가한다.
광점은 손 또는 시전 지팡이 끝의 3→5→9픽셀이고, 다른 위치에 떠다니는 이펙트는 없다.

## 재생성

저장소 루트에서 실행한다. 인자 생략 시 담당 6명만 쓴다.

```bash
python3 scripts/asset-gen/charset-battler/art2/rpg-zzu-cb2-art1/draw.py
python3 scripts/asset-gen/charset-battler/build.py actor3-0 actor1-0 actor1-1 actor1-2 actor1-3 actor1-4
python3 scripts/asset-gen/charset-battler/build_cast.py actor3-0 actor1-0 actor1-1 actor1-2 actor1-3 actor1-4
python3 scripts/asset-gen/charset-battler/art2/rpg-zzu-cb2-art1/verify.py
```

공용 도구와 매니페스트는 수정하지 않는다. 배포 그림은 `public/assets/generated/charset-battlers/`의 담당 6장 및 `cast/`의 담당 6장이다.

## 확인 근거

- 원본 전투 144칸·시전 126칸: 48×48, 발의 마지막 불투명 행 44, 알파 0/255, 원본 팔레트+최대 6색.
- 두 빌더 모두 담당 6명 통과. 저장된 270칸과 배포 시트 셀의 RGBA 바이트가 일치한다.
- 캐릭터별 21개 시전 알파 실루엣이 서로 다르다. 이 수치는 시각 판독을 대체하지 않는다.
- `_board.png`와 `_cast_board.png`를 6명 모두 직접 열어 확인했다. 걷기 장비, 지팡이 공격 네 칸, 검이 얼굴을 가리는 칸을 검토하고 수정했다.
- `_cast_board.png`는 마법별 세 칸을 가로 한 줄씩 배열한 확인판이다.
- `_cast.gif`는 같은 7개 행에서 단계 1→2→3이 함께 진행된다. 칸당 160ms, 캐릭터는 4배 최근접 확대, 고정 GIF 팔레트다. 저장 후 각 GIF 프레임을 PNG 원본과 픽셀 단위 비교했다.
- `_motion.gif`, `_motion.png`, `_motion-review.png`는 변경된 걷기·공격·공통 시전 근거다. 기존 `_motion_review.png`가 있던 actor3-0도 함께 갱신한다.
- 수치 근거는 `audit.json`, 저장·패킹·GIF 확인은 `verification.json`.
- 지정된 타입 검사 `NODE_OPTIONS=--max-old-space-size=12288 npx tsc -p tsconfig.app.json --noEmit`를 한 번 실행했고 파이프 없이 exit 0을 확인했다. 전체 테스트·게이트는 실행하지 않았다.

런타임의 좌우 반전·접근 거리·속성별 시전 선택·투사체 제거는 이 작가의 쓰기 범위 밖이다.
게임 실행 녹화와 프로젝트 정본 저장은 이 작업에서 수행하지 않았다. 이 변경은 공용 배포용 도트 자산이다.
