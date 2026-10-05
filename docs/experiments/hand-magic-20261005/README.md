> 후속 검토: 이 판의 소환은 사용자에게 반려됐습니다. 현재 공용 소환 v2와 추가 효과 24종은 `docs/experiments/shared-hand-fx-20261005/`에 있습니다. 나머지 세 마법의 기록은 그대로 보존합니다.

# 화염·빙결·번개·소환 — 프레임별 직접 도트

사용자가 반려한 앞선 수식/도형 시안 뒤에 새로 찍은 4종이다. 총40칸.
이 폴더의 그림은 사용자 검토를 기다리는 새 판이며, 승인된 기준작으로 표시하지 않는다.

## 픽셀 원본과 공용 반영

| 속성 | 공용 키 / 연결 스킬 | 원본 크기 × 칸 | 불투명 색 | 시간 |
|---|---|---|---|---|
| 화염 | mage_fire_burst / skill_mage_fireball | 64×64 × 10 | 8 | 60ms |
| 빙결 | mage_blizzard / skill_mage_blizzard | 64×64 × 10 | 6 | 60ms |
| 번개 | mage_chain_bolt / skill_mage_chain_lightning | 64×64 × 8 | 5 | 60ms |
| 소환 | monk_dragon_aura / skill_monk_dragon_fist | 128×128 × 12 | 11 | 런타임72ms / 검토 GIF70ms |

저작 원본은 `scripts/asset-gen/pixel-fx/hand-authored/<key>.hand.json`이다.
`pieces`의 좌표와 가변 길이 행 문자열을 직접 정했다. `.`은 투명이고 알파는0/255다.
소환의 몸통·얼굴은 읽고 정한 동일한 픽셀을 유지하고, 날개/턱/브레스/붕괴 구간은 별도 행으로 찍었다.
자동 형태 생성, 이동 보간, 확대된 프레임 재사용으로 중간 그림을 만들지 않았다.
`hand_pixels.py`는 빈 격자에 그 행을 1:1 배치해 완전한 `<key>.px.json`으로 펼친다.
개별 생성기와 클래스 일괄 생성기 모두 이 원본을 읽는다.

각 폴더 `fire/ice/thunder/summon`에는 원본 PNG 시트, native/확대 접촉 시트,
어두운/밝은/체커 GIF와 소스/파일 해시를 가진 보고서가 있다.
`before/`는 수정 전 **공용 런타임 시트**다. 앞서 반려된 FF6 참고 실험 시트와 구분한다.
`manifest.json`은 공용 PNG와 문자 격자의 RGBA 전체 일치 결과와 해시를 기록한다.
그 일치는 형식 확인이며 그림 승인을 뜻하지 않는다.

그림 검토에서 수정한 점: 화염 내부에 휘는 명암 면을 추가했고, 용의 머리와 목 사이의 빈 곳을
연결했다. 몸통 뒤에 가려졌던 내린 날개를 다시 찍고, 펼친 날개에 막/뼈와 몸통 비늘을 보강했다.

공용 PNG: `public/assets/generated/pixel-fx/<key>.png`.
새 프로젝트와 기존 프로젝트가 사용하는 같은 카탈로그/내보내기 자산 경로다.
스킬 ID, 프레임 수, 크기, 앵커와 엔진 시간표는 기존 계약이다.
파이어볼 투사체, 눈 층, 용권의 착탄 층은 이번에 교체한 4장 외의 기존 보조 층이다.
원본은 프로젝트가 소유하는 새 픽셀 작품이며 출처 표기는 `public/assets/ATTRIBUTION.md`에 있다.

## 재생성

```bash
python3 scripts/asset-gen/pixel-fx/mage_fire_burst.py
python3 scripts/asset-gen/pixel-fx/mage_blizzard.py
python3 scripts/asset-gen/pixel-fx/mage_chain_bolt.py
python3 scripts/asset-gen/pixel-fx/monk_dragon_aura.py
python3 assistant-skills/pixel-dot-authoring/scripts/pixelgrid.py render \
  scripts/asset-gen/pixel-fx/hand-authored/mage_fire_burst.px.json --out docs/experiments/hand-magic-20261005/fire --scale 3
```

나머지 검토판도 해당 키와 폴더로 같은 `render` 명령을 사용한다.
128px 엔진 간격72ms는 GIF의10ms 단위로 표현할 수 없어 보조 GIF만70ms로 둔다.
대화의 프레임 비교는 엔진의72ms를 사용한다.

## 실제 플레이어 확인

종합 기록은 `verify-shots/hand-magic-20261005/SUMMARY.md`를 먼저 읽는다.
전용 `player.html`과 내보내기 shim을 쓰는 기존 녹화 하네스로 확인했다.
무음 GIF와 효과음 **재생 사건 로그**를 남겼으며 소리를 녹음한 영상으로 보고하지 않는다.

```bash
node scripts/qa/runtime/retro2003-skills-gif.mjs --set class \
  --skills mage_fireball,mage_blizzard,mage_chain_lightning,monk_dragon_fist \
  --fps 20 --out verify-shots/hand-magic-20261005/runtime
node scripts/qa/runtime/retro2003-skills-gif.mjs --set custom \
  --custom docs/experiments/hand-magic-20261005/summon-runtime-fixture.json \
  --fps 20 --out verify-shots/hand-magic-20261005/runtime-summon-hero-confirmed
```

직업 녹화의 마법3종은 정상 완료했다. 원래 무도가 파티는 시작 화면 시간 초과와 페이지 충돌로
녹화하지 못했다. 소환은 주인공이 **동일한 공용 용권 연출 계약을 빌리는** 최소 사본으로 확인했다.
새 시트12칸 전체, 256px pixelated 표시와 브레스가 찍힌다. 원래 무도가 배우의 부팅은 미확인이다.
녹화 사본의 class_hero 습득표에 검토용 스킬을 추가한 것이며 실제 프로젝트 콘텐츠는 바꾸지 않는다.

대화 미리보기는 `inspect-preview.mjs`로 4종 선택/프레임 이동, 단회/반복 재생,
실제/느린 속도, 736/320px 폭과 밝은/어두운 테마에서 관찰했다.
이전 시트가 투명 영역에 남던 문제와 배경 색 요소의 잘못된 조회를 수정한 뒤 오류가 없다.
별도 환경에서 재확인하려면 스크립트의 미리보기 주소를 그 환경의 주소로 맞춘다.

공용 코드/자산과 녹화 fixture 작업으로, 사용자 프로젝트 SQLite 저장은 범위에 없다.
세션 지침에 따라 gates/vitest/전체 typecheck는 실행하지 않았다.
