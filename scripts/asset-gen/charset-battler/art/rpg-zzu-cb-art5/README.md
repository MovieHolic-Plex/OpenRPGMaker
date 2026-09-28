# 걷기 칩 기반 전투 도트 — art5

담당: actor4-0, actor3-4, actor3-5, actor3-6, actor3-7, actor4-1.
actor4-0을 먼저 제작하고 4배 확인판으로 수정한 뒤, 관절별 제작법을 다른 다섯 명에게 적용했다.

## 원본과 저작자

- 원본 인물: `public/assets/easyrpg/charset/Actor3.png`, `Actor4.png`.
  VictorSena, 2023, CC-BY. 출처: https://vashmaker.blogspot.com/p/works.html
- 무기 모양 참고: `public/assets/easyrpg/battle-weapon/Weapon.png`.
  russidan (Alephman), 2010, CC-BY.
- 저작자 정본: `public/assets/easyrpg/AUTHORS.md`의 CharSet/BattleWeapon 항목.
- 이 변경은 위 캐릭터의 부위 재배치와 팔·다리·무기 픽셀 재작화 파생물이다.
  무기는 참고 그림의 도트 크기를 보고 직접 그렸다. AI 생성 이미지 입력은 없다.
- `sources.png`: 여섯 명의 원본 왼쪽 방향 가운데 패턴을 nearest 8배로 확대한 대조판.

## 제작

원본 머리/얼굴/머리카락과 몸통의 의복 무늬를 크기 변경 없이 복사했다.
팔은 어깨–팔꿈치–손, 다리는 골반–무릎–발 좌표로 새로 찍었다.
쓰러짐은 머리와 몸통을 각각 90도 돌리고, 다리/팔은 바닥에 접었다.

| id | 개별 구성 |
|---|---|
| actor4-0 | 짧은 검, 녹색 바지, 갈색 신발; 데모 우선 제작 |
| actor3-4 | 잎 지팡이, 긴 머리 조각, 녹색 복장 |
| actor3-5 | 맨팔 정권과 손목 띠; 뒤손 가드 유지 |
| actor3-6 | 단검 공격, 류트 영창/특기 |
| actor3-7 | 단검 공격, 리라 영창/특기 |
| actor4-1 | 짧은 검, 푸른 옷과 청록색 바지 |

각 24칸 중 전투 동작 20칸을 다시 제작했다. 걷기 세 칸과 정면은 원본 그대로다.
미완성 전투 기준선 포즈는 없다. 시트의 포즈 좌표는 공용 POSES 그대로다.

```sh
python3 scripts/asset-gen/charset-battler/art/rpg-zzu-cb-art5/draw.py
python3 scripts/asset-gen/charset-battler/build.py actor4-0 actor3-4 actor3-5 actor3-6 actor3-7 actor4-1
python3 scripts/asset-gen/charset-battler/art/rpg-zzu-cb-art5/audit.py
```

`--manifest`는 사용하지 않는다. `draw.py`는 담당 id만 받는다.
추가색은 캐릭터별 전 포즈의 합집합 기준 6색 이하, 알파 0/255, 마지막 불투명 행은 모두 44다.

## 확인 결과

- 여섯 명 모두 공용 build.py `통과`.
- `_board.png` 여섯 장과 `_motion.png`, `_motion-review.png` 여섯 세트를 직접 열어 확인.
- 공격의 뒤젖힘 → 중간 궤적 → 앞쪽 착탄 → 아래쪽 여운, 마법의 모음 → 올림 → 방출,
  피격의 뒤로 젖힘, 승리의 2픽셀 들썩임을 확인했다.
- 수정: 쓰러질 때 밑단/긴 머리의 바닥 초과, 감은 눈의 남은 흰색, 무도가의 긴 소매처럼 보이는 팔,
  악기를 가리는 팔과 올릴 때의 손 위치를 수정했다.
- `_motion.png`: 요청된 16칸 순서를 가로 한 줄로 저장(3072×216; 위 24px는 이름표).
  `_motion-review.png`는 같은 그림을 동작별 다섯 줄로 접은 확인용이다.
- `_motion.gif`: 같은 16칸, 192×192, nearest 4배, 각 120ms, 반복 재생.
- `audit.json`: 원본 144칸의 크기·알파·추가색·기준선, 시트의 원화 일치,
  GIF 전체 프레임/순서/간격/픽셀과 PNG 일치를 독립적으로 재검사한 결과.

## 통합 범위

이 작업은 지정 원화, 생성 시트, 개인 제작 스크립트만 변경한다.
프로젝트 DB 적용·manifest 통합·런타임 재생 QA는 감독자 작업이다.
전체 테스트/게이트/타입 검사는 실행하지 않았다.
공용 빌드는 원화를 binarize한 뒤 알파를 검사하므로 원본 반투명을 놓칠 수 있다.
공용 도구는 수정하지 않았고, audit.py가 원화를 먼저 열어 알파 0/255를 직접 검사한다.
