# 2차 시전 도트 — 정찰병·궁수·전사·도적

담당: `actor4-0`, `actor2-2`, `actor2-3`, `actor2-4`, `actor2-5`.
각 7종 × 3단계 시전 21칸, 합계 105칸을 저작했다. 전투 24칸도 함께 재빌드했다.
공용 도구, 런타임, 카탈로그, 다른 캐릭터는 수정하지 않는다.

## 무기와 보행

| 캐릭터 | 원본/라벨 판단 | 유지 무기와 수정 |
|---|---|---|
| actor4-0 | 보라 머리 청년, 데모 정찰병 | 기존 짧은 검을 단검으로 교정; 전투 전체 재작화 |
| actor2-2 | 녹색 망토 레인저 | 활 유지 |
| actor2-3 | 녹색 후드 궁수 | 활 유지 |
| actor2-4 | 붉은 머리 중년 전사 | 검 유지 |
| actor2-5 | 젊은 여성 도적 | 단검 유지 |

원본 걷기 칩과 1차 `_board.png` 다섯 장을 직접 확인했다. 담당에는 마법사/로브 캐릭터가 없다.
기존 다섯 명 모두 보행 시 무기가 사라졌으므로, 원본 0/1/2 패턴의 다리·발 위에
무기를 든 팔을 다시 찍었다. 궁수의 근접 공격은 활몸을 뒤로 준비 → 위에서 앞쪽 → 앞 타격 → 아래 회수하는
4칸이다. 검·단검은 기존 관절별 준비/휘두름/타격/회수 흐름을 보존했다.
기존 공용 시전 3칸도 새 비전 동작으로 교체하여 시전 중 무기가 사라지지 않게 했다.
아이템/정면에서도 다른 손에 같은 무기를 쥐며, 전투 불능은 떨어진 같은 무기를 둔다.

## 마법별 동작

`cb_lib.CAST_TYPES` 순서와 문장을 따른다. 머리/얼굴/의복은 원본 1:1 도트를 보존하고,
팔꿈치/손/무릎/발 관절과 손가락을 각 칸에 다시 그린다. 인물 통짜 이동·기울이기·회전으로 대체하지 않는다.

| 속성 | 세 단계 |
|---|---|
| fire | 두 손을 뒤 허리로 당김 → 가슴 앞에 겹침 → 앞발 내딛고 양팔 밀기 |
| ice | 팔 X 교차 → 위/아래로 벌림 → 한 손 머리 위, 무기손 앞으로 |
| thunder | 무릎 굽히고 한 팔 뒤 → 하늘로 직선 들기 → 앞 아래로 내려찍기 |
| heal | 눈 감고 가슴 앞 모음 → 양옆 위로 벌림 → 앞에 손바닥 내밀기 |
| dark | 웅크리고 얼굴 앞 손가락 굽힘 → 뒤로 휘감기 → 낮은 자세로 갈퀴 찌르기 |
| arcane | 몸 앞 손 집중 → 머리 위를 돌아 치켜듦 → 앞 위쪽 겨누기 |
| support | 손목 들기 → 뒤쪽으로 넓게 쓸기 → 입 앞 손바닥 펼치기 |

활·검·단검은 다른 손에 계속 쥔다. 허리보다 낮은 활은 가로로 들어 끝이 기준선을 넘지 않게 한다.
불빛은 빈손 가까이 3/6/9픽셀, 손에서 최대 6픽셀 거리이며 투사체는 없다.
무기색은 캐릭터 원본 팔레트로 재매핑하고 부족한 속성색만 추가하여 **전투+시전 45칸 전체 합집합**에서
추가색이 6/6/6/5/4색이다. 48×48 셀, 알파 0/255, 마지막 불투명 행 y=44를 유지했다.

## 원본과 저작권

- 인물 원본: `public/assets/easyrpg/charset/Actor2.png`, `Actor4.png`.
- Actor2 #2/#3/#5, Actor4 #0: VictorSena (2023), CC BY 4.0.
- Actor2 #4: Garakuta + VictorSena (2023), CC BY 4.0.
- 무기 도트 형태 참고: `public/assets/easyrpg/battle-weapon/Weapon.png`, russidan (Alephman, 2010), CC BY 4.0.
- 원저자 정본: `public/assets/easyrpg/AUTHORS.md`.
- 출처: https://vashmaker.blogspot.com/p/works.html · http://garakutamaker.blog.fc2.com/
- 라이선스: https://creativecommons.org/licenses/by/4.0/

1차 작가 `art/rpg-zzu-cb-art3/paint.py`, `art/rpg-zzu-cb-art5/draw.py`의 부위 분해·관절 도트 함수를
읽기 전용으로 재사용한다. 입력 이미지는 위 도트 원본뿐이며 AI 생성 그림을 읽지 않는다.
`source.png`는 담당 원본의 정면/측면 보행을 4배 최근접으로 나란히 놓은 대조판이다.

## 재현과 증거

```sh
python3 scripts/asset-gen/charset-battler/art2/rpg-zzu-cb2-art3/paint.py
python3 scripts/asset-gen/charset-battler/build_cast.py actor4-0 actor2-2 actor2-3 actor2-4 actor2-5
python3 scripts/asset-gen/charset-battler/build.py actor4-0 actor2-2 actor2-3 actor2-4 actor2-5
python3 scripts/asset-gen/charset-battler/art2/rpg-zzu-cb2-art3/audit.py
```

- 두 공용 빌드: 다섯 명 모두 `통과`.
- `_cast_board.png`, `_board.png`: 다섯 명 모두 `view_image`로 직접 열어 확인.
- `_cast.gif`: 7속성을 가로 한 줄에 두고 각각의 1→2→3칸을 동시에 재생, 160ms, 최근접4배.
  크기 1344×212이며 위 20px는 이름표다. RGB를 정확한 팔레트 인덱스로 대응시켜 유사색 양자화 손실을 없앴다.
- `_armed_motion.gif`: 보행 3칸과 제자리 공격 4칸을 이어 확인하는 160ms GIF.
- 1차 `_motion.gif`/`_motion.png`/동작 확인판도 현재 원화로 갱신했다.
- `_cast_art.json`: 무기 종류, 추가색, 손과 빛 픽셀 좌표.
- `verification.json`: 디스크에서 다시 읽은 225칸의 크기/알파/발 기준선/색 수,
  시트와 원화 일치, 캐릭터별 시전 21개 고유 실루엣, GIF의 모든 프레임 픽셀·160ms 검증 결과.

아군/적 위치, 실제 접근 이동, 런타임 투사체 제거, 프로젝트 저장 및 게임 녹화 QA는 감독자의 통합 범위다.
이 작업은 해당 경로를 실행하거나 수정하지 않았다. npm test/vitest/gates/stash는 실행하지 않았다.
앱 타입 검사 결과는 `typecheck.txt`에 기록한다.
