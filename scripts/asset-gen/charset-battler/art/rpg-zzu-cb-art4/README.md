# 걷기 칩 기반 아군 도트 — cb-art4

담당: `actor3-0`, `actor2-7`, `actor3-1`, `actor3-2`, `actor3-3`.

사무라이부터 작업해 머리와 갑주 몸통의 원본 픽셀을 유지하는 부위 합성 방법을 만들었다.
왼쪽 걷기 칩에서 머리·몸통·머리카락/스카프를 추출하고 어깨·팔꿈치·손,
골반·무릎·발을 별도 정수 좌표로 저작한다. 팔·다리·무기는 `putpixel`로 찍는다.
전체 캐릭터를 확대하거나 통째로 기울인 기준선 포즈는 사용하지 않는다.
걷기 3칸은 원본을 그대로 놓고 손/무기를 추가하며, 정면은 원본 down 패턴 1이다.

## 원본과 라이선스

- `public/assets/easyrpg/charset/Actor3.png`: VictorSena, 2023, CC BY 4.0.
- `public/assets/easyrpg/charset/Actor2.png`의 8번째 캐릭터: VictorSena, 2023, CC BY 4.0.
- 작가: https://vashmaker.blogspot.com/p/works.html
- 무기 형태 참고: `public/assets/easyrpg/battle-weapon/Weapon.png`, russidan (Alephman), 2010, CC-BY.
- 저장소의 출처 정본: `public/assets/easyrpg/AUTHORS.md`.
- 라이선스: https://creativecommons.org/licenses/by/4.0/

수정 내용: 위 원본의 왼쪽 프레임을 분해·재배치하고 팔·다리·무기를 다시 그린 24포즈 파생물.
무기는 참고 시트를 직접 확대/축소해서 붙이지 않고 같은 크기감으로 새로 찍었다.
AI 생성 캐릭터 이미지는 읽거나 사용하지 않았다. `sources.png`는 해당 원본 5명의 비교판이다.

## 재현

저장소 루트에서 실행한다.

```bash
python3 scripts/asset-gen/charset-battler/art/rpg-zzu-cb-art4/draw.py
python3 scripts/asset-gen/charset-battler/build.py actor3-0 actor2-7 actor3-1 actor3-2 actor3-3
```

캐릭터 id를 `draw.py` 인자로 지정하면 해당 인물만 다시 만든다.
공용 도구와 `manifest.json`에는 쓰지 않는다.

## 포즈와 검토

- 사무라이·검객: 뒤 위 준비 → 위쪽 베기 → 왼쪽 끝 착탄 → 아래 여운.
- 엘프: 시위 당김 → 끝까지 당겨 조준 → 발사와 손 반동 → 활 유지.
- 닌자 2명: 짧은 단검 공격과 뒤로 뺀 반대 손. 여자 닌자의 스카프를 별도로 보존.
- 마법: 가슴 앞 3픽셀 빛 → 머리 위 손 → 전방 방출.
- 방어·방어 피격·빈사·부활·쓰러짐은 무릎과 팔을 별도로 다시 그린다.
- 전투 불능은 왼쪽 원본 머리와 몸통을 각각 옆으로 눕히고, 팔과 다리를 접어 다시 그린다.
  머리는 오른쪽이며 무기는 바닥에 별도로 떨어진다.
- 승리 2칸은 머리·몸통 높이, 무기 손, 반대 손을 움직이고 발은 y=44에 둔다.

각 캐릭터 폴더의 `_motion.png`는 요청 순서 16칸을 4배 nearest로 붙인 가로 띠다.
`_motion.gif`는 같은 16칸을 120ms 간격으로 재생한다.
`_motion_review.png`는 확대 배율을 유지하며 판독할 수 있는 5행 동작 확인판이다.
`_validation.json`은 24칸의 바운드·새 색 수·픽셀 해시를 기록한다.

검토하며 고친 부분: 영창 손의 얼굴 가림, 두꺼운 화살대, 닌자 단검과 어긋난 궤적,
가려진 보라 스카프, 무릎 꿇은 엘프의 활 하단 잘림, 바닥 단검의 길이.
전 캐릭터의 `_board.png`와 동작 확인판을 눈으로 확인한다.

형식 조건: 48×48 원본, 144×384 빌드 시트, 모든 칸의 최하단 불투명 y=44,
알파 0/255, 원본 캐릭터 팔레트 + 공통 금속/빛 최대 6색.

## 통합 담당자에게

이미지 자산과 이 스크립트만 바꿨다. 매니페스트 갱신, 데모/프로젝트 저장소 반영,
런타임 재생 검증은 통합 담당자의 후속 작업이다. 타입스크립트·전체 테스트·게이트는 실행하지 않았다.
