# 2차 시전 도트 · 담당 4

담당: `actor2-6`, `actor2-7`, `actor3-1`, `actor3-2`, `actor3-3`.
각 24개 전투 포즈와 21개 시전 포즈, 합계 225칸이다.

원본 `Actor2.png`, `Actor3.png`와 `charsetSemantics.ts` 라벨을 함께 확인했다.
두 엘프는 활, 동양풍 검객은 칼, 두 닌자는 단검을 유지한다. 담당 중 마법사/로브 직업은 없다.
머리·몸통 원본과 1차 작가의 부위 분해를 재사용하고 관절·손·발·무기를 정수 좌표로 찍는다.
몸 전체를 회전하거나 늘여서 새 동작으로 대체하지 않는다.

## 이번 수정

- 마법 7종은 `cb_lib.CAST_TYPES` 순서와 준비→영창→방출 설명을 따른다.
  화염의 뒤쪽 모으기/양손 밀기, 냉기의 교차/위아래 벌리기,
  번개의 웅크리기/치켜들기/내려찍기, 치유의 기도/펼치기/건네기,
  어둠의 움켜쥐기/뒤로 휘감기/갈퀴, 비전의 세우기/머리 위 원/겨누기,
  보조의 손목/옆으로 쓸기/입 앞 손바닥을 각각 저작했다.
- 시전 105칸 모두 무기를 반대 손에 쥔다. 양손을 모을 때는 무기 손등에 빈 손을 포갠다.
  기존 `cast_charge/raise/release` 15칸도 무기가 남는 비전 3칸으로 교체했다.
- 여성 엘프의 맨손 걷기에 활을 추가했다. 다섯 명 모두 걷기 3칸에서 장비를 유지한다.
- 두 엘프의 기본 공격 4칸은 활 몸체를 뒤로 당기기→위에서 내리기→왼쪽 타격→아래 여운이다.
  몬스터 앞으로 이동하는 동작은 런타임 담당이다. 기존 특기 칸의 활 쏘기는 유지한다.
- 아이템 사용 중에도 반대 손에 무기를 보인다.
- 시전 빛은 손 주변 3/5/9픽셀뿐이며 시전 시트에는 화살·투사체·멀리 떨어진 입자가 없다.
  무기 색을 원본 팔레트에 맞춰, 전투+시전 45칸 전체의 추가색 합집합도 캐릭터당 6색으로 제한했다.
  화염은 원본 주황/적갈색, 나머지는 하늘·노랑·연두·보라·청록·분홍과 원본 흰색을 쓴다.

## 재현

저장소 루트에서 실행한다. 각 명령의 종료 코드를 개별 확인한다.

```bash
python3 scripts/asset-gen/charset-battler/art2/rpg-zzu-cb2-art4/draw.py
python3 scripts/asset-gen/charset-battler/build_cast.py actor2-6 actor2-7 actor3-1 actor3-2 actor3-3
python3 scripts/asset-gen/charset-battler/build.py actor2-6 actor2-7 actor3-1 actor3-2 actor3-3
python3 scripts/asset-gen/charset-battler/art2/rpg-zzu-cb2-art4/audit.py
```

공용 도구와 다른 캐릭터에는 쓰지 않는다. `draw.py`는 담당 id 인자를 받을 수 있다.
1차 작가의 `art/rpg-zzu-cb-art4/draw.py`, `art/rpg-zzu-cb-art3/paint.py`는 읽어서 재사용한다.

각 캐릭터 폴더의 `_cast_board.png`는 7행×3열 확인판이다.
`_cast.gif`는 7종을 가로로 나란히 놓고 3단계를 160ms마다 재생한다(4배 nearest, 1344×210).
기존 `_motion.*`, `_motion_review.png`, `_validation.json`도 현재 그림으로 갱신한다.

## 검토와 범위

원본 칩·무기 시트와 다섯 명의 `_board.png`, `_cast_board.png`를 직접 열어 검토했다.
치켜든 팔이 길었던 초안을 줄였고, 검객의 화염/냉기 시전 칼끝이 셀 경계에 닿던 부분을 보정했다.
`audit.json`은 저장한 이미지와 시트를 다시 읽어 검사한 결과다.
빛을 제외한 실루엣도 단계별 7종이 서로 다르며, 각 종류의 3칸은 단순 이동 복제가 아니다.
가장 비슷한 실루엣도 58픽셀 이상 다르다. 시트 빌드 10건과 225칸 재읽기 검사는 모두 통과했다.
요청한 `NODE_OPTIONS=--max-old-space-size=12288 npx tsc -p tsconfig.app.json --noEmit`을
마지막에 한 번 실행했고 파이프 없이 종료 코드 0을 확인했다. 전체 테스트·게이트는 실행하지 않았다.

아군/적 위치 반전, 시전 종류 선택, 투사체 런타임 제거, 이동 거리, 게임 녹화 및
프로젝트 저장소 적용은 이 도트 담당의 쓰기 범위 밖이며 통합 담당이 확인해야 한다.
이 작업은 공용 자산 파일만 수정했고 게임 프로젝트 DB는 수정하지 않았다.

## 출처

- `public/assets/easyrpg/charset/Actor2.png`, `Actor3.png`: VictorSena, 2023, CC BY 4.0.
- 무기 모양 참고 `public/assets/easyrpg/battle-weapon/Weapon.png`: russidan (Alephman), 2010, CC-BY.
- 저작자/라이선스 정본: `public/assets/easyrpg/AUTHORS.md`.
- 원본의 머리·옷은 보존하며 팔·다리·무기·시전 동작을 다시 그린 파생물이다.
- AI 생성 영웅 그림은 사용하지 않았다.
