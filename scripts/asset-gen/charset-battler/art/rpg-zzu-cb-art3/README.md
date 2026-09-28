# Actor2 측면 전투 도트 — cb-art3

담당: `actor2-3`, `actor2-2`, `actor2-4`, `actor2-5`, `actor2-6`.
각 캐릭터의 전투용 20칸을 다시 저작했다. `walk_a/b/c`는 원본 left 패턴 0/1/2,
`front`는 원본 down 패턴1을 그대로 유지했다. 미완성 기준선 전투 칸은 없다.

## 원본과 저작권

유일한 캐릭터 원본: `public/assets/easyrpg/charset/Actor2.png`.
원본 크기 그대로 머리와 몸통을 잘라 붙이고 팔·다리·무기를 정수 픽셀로 다시 찍었다.
생성형 그림과 기존 hero 그림은 입력으로 사용하지 않았다.

- Actor2 characterIndex 2, 3, 5, 6: VictorSena, 2023, CC BY 4.0.
- Actor2 characterIndex 4: Garakuta + VictorSena, 2023, CC BY 4.0.
- 무기 형태 참고: `public/assets/easyrpg/battle-weapon/Weapon.png`, russidan (Alephman), 2010, CC BY 4.0.
  무기 픽셀은 잘라 쓰지 않고 직접 그렸다.
- 원저자/라이선스 정본: `public/assets/easyrpg/AUTHORS.md`의 CharSet/BattleWeapon 절.
- 라이선스: https://creativecommons.org/licenses/by/4.0/
- VictorSena: https://vashmaker.blogspot.com/p/works.html
- Garakuta: http://garakutamaker.blog.fc2.com/

## 부위와 동작

- 머리: left 패턴1의 `(0,0)-(24,19)`를 복사. 피격/방어피격/빈사에는 눈 픽셀만 감는다.
- 몸통: `(0,19)-(24,26)`. 기존 늘어진 팔을 안쪽 복식 색으로 메운 뒤 새 팔을 합성한다.
- 앞뒤 다리와 팔은 서로 다른 관절 좌표로 그린다. 몸통의 기울기도 행별로 따로 조절한다.
- 후드/망토/깃털 궁수는 당김→최대 장력→화살 분리→활을 내리는 4단계.
- 전사는 16px 검, 도적은 10px 단검. 검의 길이는 포즈별로 고정하고 단검 착탄 팔은 더 깊게 뻗는다.
- 레인저의 회색 장화, 전사의 주황 장화, 도적/후드/엘프의 갈색 장화를 캐릭터 팔레트로 구분한다.
- 방어는 머리4px/몸통3px를 낮추고 무릎을 굽힌다. 빈사·부활·쓰러지는 중간은 별도 관절 좌표다.
- 전투불능은 부위를 따로 눕히고 머리를 오른쪽에 두며 떨어진 무기를 별도로 그린다.
- 몸체에는 원본 팔레트만 사용. 무기/마법/병의 추가색은 여섯 색으로 제한한다.

## 재현

저장소 루트에서:

```sh
python3 scripts/asset-gen/charset-battler/art/rpg-zzu-cb-art3/paint.py
python3 scripts/asset-gen/charset-battler/build.py actor2-3 actor2-2 actor2-4 actor2-5 actor2-6
```

`paint.py actor2-3`처럼 담당 ID만 지정할 수도 있다. 공용 manifest는 갱신하지 않는다.

## 확인 기록

모든 `_board.png`와 `_motion.png`, 동작별로 행을 나눈 `_motion_review.png`를 직접 열어 확인했다.
첫 확인 후 과하게 뻗은 영창/승리 팔을 줄이고, 검 길이를 고정하고, 레인저 장화 색을 교정했다.
공격의 무기 방향/활 장력, 마법 손 위치, 피격 반동, 승리의 들썩임이 각 칸에서 구분된다.

`_motion.png`: 지정한 다섯 동작을 차례로 16칸 한 줄, 최근접4배.
`_motion.gif`: 같은16칸/순서, 최근접4배, 칸마다120ms, 무한 반복.
확인판의 글자 행20px는 스프라이트 셀48px×4 바깥이다.

`verification.json`은 저장 파일을 다시 열어 확인한 결과다.
런타임/프로젝트 DB 통합, manifest 생성, npm 테스트·게이트·타입 검사는 이 도트 저작 범위에서 실행하지 않았다.
공용 빌드 도구의 기능상 문제는 발견하지 않았다.
