# 시전 도트 2차 — art2

담당: `actor2-0`, `actor1-5`, `actor1-6`, `actor1-7`, `actor2-1`.
5명 × 7마법 × 3단계 = 원화 105칸과 배포 시트 5장을 저작했다.

## 원화와 무기

`paint.py`는 1차 `art/rpg-zzu-cb-art2/draw.py`의 부위 분해, 팔·손·다리·무기 도트 함수를 재사용한다.
통짜 스프라이트 변형을 쓰지 않는다. 21칸 각각 몸통 위치·무릎·팔꿈치·손목을 지정하고
원본 머리·옷 무늬와 새로 그린 관절을 조합한다. 캐릭터는 모두 왼쪽을 본다.

- `actor2-0`: 원본 라벨은 회색 머리 도적. 데모 수호자 역할에서도 기존 단검 유지.
- `actor1-5`: 마녀 모자의 여성 마법사, 큰 장식 지팡이 유지.
- `actor1-6`: 로브 마법사, 지팡이 유지.
- `actor1-7`: 파란 모자의 여성 마법사, 데모 성직자 역할. 지팡이 유지.
  치유 준비에서 눈을 감고 고개를 숙여 손을 모은다. 양팔을 펼친 뒤 손바닥을 위로 해서 빛을 건넨다.
- `actor2-1`: 원본은 회색 옷의 젊은 여성으로 직업 미지정. 기존 작은 단검 유지.

기존 무기가 외형과 맞아 무기 종류 교체는 없었다. 전투 24포즈를 동일 소스로 재생성했고,
실제 변경은 무기 없이 걷던 `walk_a/b/c`와 무기가 사라지던 공통 시전 `cast_charge/raise/release`다.
걷기는 원본 세 칸의 머리·하체를 유지하면서 팔을 다시 찍어 무기를 쥐게 했다.
공격 네 칸은 준비→머리 위 호→전방 착탄→아래 마무리 순서로 직접 확인했다.

## 마법별 동작

`cb_lib.CAST_TYPES` 순서와 서술을 따른다.

| 마법 | 준비 | 영창 | 방출 |
|---|---|---|---|
| fire | 양손을 허리 뒤로 | 가슴 앞에 포개기 | 앞발을 내딛으며 두 손 밀기 |
| ice | 두 팔 교차 | 위·아래 벌리기 | 한 손 위, 다른 손 앞으로 |
| thunder | 무릎을 굽히고 뒤로 당기기 | 팔을 수직으로 올리기 | 전방 아래로 내려찍기 |
| heal | 눈 감고 모은 손으로 기도 | 두 팔 펼치기 | 편 손바닥으로 빛 건네기 |
| dark | 웅크려 얼굴 앞에 쥐기 | 뒤로 크게 감기 | 세 갈래 손가락으로 찌르기 |
| arcane | 몸 앞 집중 | 머리 위에서 원 그리기 | 무기·손을 앞으로 겨누기 |
| support | 얼굴 옆에서 손목 흔들기 | 옆으로 넓게 쓸기 | 입 앞 손바닥에서 불기 |

무기는 뒷손에 계속 든다. 단검은 8px 길이를 유지하고 지팡이는 방향을 바꿔 사용한다.
마법빛은 손 주변 3/5/7픽셀과 지팡이 끝 2픽셀(합계 최대 9)이다. 투사체나 긴 빛 궤적은 없다.
지팡이의 넓은 장식은 나무색이며 발광은 끝의 두 점으로 제한한다.
원화 한 칸당 캐릭터 원본 팔레트 밖의 색은 최대 6개다(무기 최대 4 + 마법 2).
마법 사이에는 요청한 속성색에 맞춰 두 빛 색을 교체한다.

## 재현과 검증

저장소 루트에서 실행한다. 담당 외 id는 거절한다. 공유 manifest를 쓰지 않는다.

```sh
python3 -B scripts/asset-gen/charset-battler/art2/rpg-zzu-cb2-art2/paint.py
python3 -B scripts/asset-gen/charset-battler/build_cast.py actor2-0 actor1-5 actor1-6 actor1-7 actor2-1
python3 -B scripts/asset-gen/charset-battler/build.py actor2-0 actor1-5 actor1-6 actor1-7 actor2-1
python3 -B scripts/asset-gen/charset-battler/art2/rpg-zzu-cb2-art2/verify.py
```

검증 보고: 이 폴더의 `verification.json` 및 각 캐릭터 폴더의 `_cast_validation.json`.
225칸 원화(105 시전 + 120 전투)를 다시 읽어 48×48, 알파 0/255, 마지막 행 정확히 y=44,
시트 셀 일치를 확인했다. 시전은 각각 21개의 서로 다른 알파 실루엣과 추가색 상한도 확인한다.
`_board.png`, `_cast_board.png`를 직접 열어 자세·무기·잘림을 검토했다.
공용 빌드가 y=45를 허용하기 때문에 별도 검사는 y=44를 엄격히 확인한다.

각 `_cast.gif`는 7마법을 가로로 병렬 배치해 세 단계를 160ms씩 반복하는 4배 nearest GIF다.
`_cast_board.png`는 마법당 가로 3칸, 전체 7행으로 비교하는 정적 확인판이다.
기존 `_motion.gif`와 PNG도 바뀐 걷기·공통 영창에 맞춰 재생성했다.
기존 `_validation.json`의 걷기 원본 보존 목록·바운딩 박스·전투 시트 해시도 현재 결과로 갱신했다.

최종 타입 검사: `NODE_OPTIONS=--max-old-space-size=12288 npx tsc -p tsconfig.app.json --noEmit`
한 번 실행, 파이프 없이 exit 0. `git diff --check`도 통과했다. vitest/gates는 실행하지 않았다.

이 작업은 에셋 범위만 수정했다. 진영 배치·실제 전진 거리·투사체 제거·시전 시트 선택은
감독의 런타임 통합 범위이며 이 워크트리에서는 브라우저 전투 QA와 프로젝트 DB 저장을 수행하지 않았다.

## 출처와 라이선스

캐릭터 원본은 `public/assets/easyrpg/charset/Actor1.png`, `Actor2.png`이며
출처 목록은 `public/assets/easyrpg/AUTHORS.md`다. 생성형 그림은 사용하지 않았다.

- Actor1: Marina Navarro Travesset (base), VictorSena (edit), 2010/2023.
- Actor2 담당 캐릭터: VictorSena, 2023.
- 무기 도형 참고: `public/assets/easyrpg/battle-weapon/Weapon.png`, russidan (Alephman), 2010.
- 라이선스: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

변경: 원본 부위 조립, 팔·손·무릎 도트 저작, 무기 보유 걷기, 마법별 시전·빛,
전투/시전 시트 및 검토 이미지 제작. 원저자 표기는 1차 자료와 공용 AUTHORS에 함께 보존된다.
