# FF6 조사 후 주인공 마법 5종 재저작 · 2026-10-05

**후속 사용자 평가 “너무 허접하다 ..”로 이 판은 반려됐다.** 당시 원본/PNG/생성기 사본은
`rejected-release/`에 보존한다. 아래는 당시 작업 기록이며 현재 승인된 품질 기준이 아니다.
현재 공용 그림과 재현 근거는 [후속 재수정](../hero-magic-rework-20261005/README.md)을 따른다.

사용자의 “그럼 좀 수정해봐” 요청에 따라 기존 공용 프리셋 다섯 개를 다시 그렸다.
당시에는 후속 사용자 검토 대기였다. 반려된 공용 24종을 재등록한 작업은 아니다.
SNES 참고 관찰과 출처는 [앞선 조사](../ff6-reference-study-20261005/README.md)에 있다.
FF6 ROM·스프라이트·소리를 추출하거나 게임 에셋으로 가져오지 않았다.

## 변경 범위

| 기존 스킬 | 현재 층 | 직접 찍은 변화 |
|---|---|---|
| skill_mage_fireball | mage_fire_burst 64px × 8 | 발밑 점화 → 상승 → 갈래 → 찢김 → 잔불 |
| skill_mage_blizzard | mage_blizzard 64px × 8 | 결정 성장 → 면의 균열 → 큰 파편 → 낙하 |
| skill_mage_chain_lightning | mage_chain_bolt 64px × 7 | 얇은 경로 → 굵은 흰/금/푸른 낙뢰 → 끊김 → 두 번째 낙뢰 |
| skill_cleric_holy_smite | 배경 2칸 + 뒤/앞 구슬 각 12칸 + 착탄 6칸 | 푸른 물결, 세 구슬의 앞뒤 하강, 별도 큰 빛 |
| skill_monk_dragon_fist | 원화 1칸 + 배경 2칸 + 착탄 6칸 | 연결된 목/가슴/사지, 날개 뼈/막, 원화 유지 뒤 착탄 |

소환은 원화 한 장을 1,400ms 유지한다. 몸통의 중간 포즈를 자동 보간하거나 같은 원화를
여러 그림으로 세지 않는다. 전체 10장/64칸 중 반복 부품과 유지 셀이 포함돼 있다.
배경은 직접 찍은 32px 물결 타일을 명시 좌표에 반복 조립한 128px 두 칸이다.
FF6 바하무트의 확장 원형 파동이나 입에서 시작하는 브레스까지 만든 판은 아니다.
용권의 기존 단일 적 피해 규칙은 유지하며 실제 소환 개체를 생성하지 않는다.

## 픽셀 원본과 재현

`scripts/asset-gen/pixel-fx/snes_study_redraw.py`의 팔레트 문자 행과 명시 픽셀 배치가 저작 원본이다.
출력/패킹은 도형·노이즈·트레이싱·스프라이트 보간을 하지 않는다.
`scripts/asset-gen/pixel-fx/hand-authored/<key>.study.px.json`에는 모든 셀의 완전한 격자가 있다.
첫 판 `*.hand.json`과 반려된 소환/24종은 역사다. `draft-revisions.py`는 이번에 다시 고친 원화 초안이다.
`before/`는 설치 직전 공용 PNG이며, 대화 비교판의 홀리/소환 왼쪽은 사용자가 반려한 판을 사용한다.

```bash
python3 scripts/asset-gen/pixel-fx/snes_study_redraw.py --install
```

공용 출력은 `public/assets/generated/pixel-fx/`; 배경은 가로 스트립과 `*-f0/1.png` 셀 사본을 함께 쓴다.
`manifest.json`에 원본/PNG 해시·칸 수·노출 시간·검토 상태를 기록한다.
같은 명령의 PNG 바이트 재현과 기존 개별 생성기 다섯 개의 전체 RGBA 일치를 확인했다.
형식은 native64/128, 이진 알파, 층별 실제 불투명색 3~13색이다.
개별 폴더의 native 접촉 시트와 어두운/밝은/체커 GIF는 픽셀 원본 검토용이다.

## 공용 코드 연결

- `retroClassSkills.ts`: 기존 다섯 프리셋의 층/크기/노출 시간/착탄 셀을 등록한다.
- `retroSkillTimeline.ts`: 셀별 시간과 접촉을 계산한다. 배경/구슬/원화의 ambient 층은 명중 사건을 만들지 않는다.
- `retroChoreographyHandles.ts`: 캐릭터 동작을 적용해도 새 효과의 노출 시간과 마지막 셀이 잘리지 않게 한다.
- `retroSkillCatalog.ts`: 복제 연출에도 공용 시트의 노출 시간/앞뒤 층을 전달한다.
- 플레이어와 자료집 미리보기: 뒤 구슬/배경을 배틀러 뒤에, 앞 구슬/착탄을 앞에 그린다.
- 배경은 화면 전체로 늘리지 않고 고정 도트 크기로 반복한다. PWA 자산 캐시는 v10이다.

새 프로젝트와 공용 프리셋을 사용하는 기존 프로젝트가 같은 정의를 읽는다.
기본 `anim_px_*` 17종 전체나 별도 사용자 연출을 모두 재저작한 것은 아니다.
프로젝트 저장 스키마를 추가하지 않았으며 사용자 정본 SQLite와 외부 저장소는 수정하지 않았다.

## 실제 표시 확인

먼저 [확인 요약](../../../verify-shots/snes-study-redraw-20261005/SUMMARY.md)을 읽는다.
실제 전투는 `player.html` + 내보내기 shim + 키보드 입력을 사용하는 기존 녹화 하네스다.
GIF는 무음이고 효과음은 재생 사건 로그다. 소리를 녹음한 영상으로 보고하지 않는다.
무도가 파티의 시작 화면 시간 초과는 별도 실패로 보존한다.

```bash
node scripts/qa/runtime/retro2003-skills-gif.mjs --set class \
  --skills mage_fireball,mage_blizzard,mage_chain_lightning,cleric_holy_smite,monk_dragon_fist \
  --out verify-shots/snes-study-redraw-20261005/runtime-confirmed --impact-audit
node scripts/qa/runtime/retro2003-skills-gif.mjs --set custom \
  --custom docs/experiments/snes-study-redraw-20261005/summon-runtime-fixture.json \
  --out verify-shots/snes-study-redraw-20261005/runtime-summon-displayed --impact-audit
node docs/experiments/snes-study-redraw-20261005/inspect-editor.mjs
node docs/experiments/snes-study-redraw-20261005/inspect-preview.mjs
```

실제 자료집 미리보기 다섯 개를 직접 마운트해 대표 시각·표시 셀·배경 크기를 확인했다.
대화 비교판은 원본 격자의 별도 무음 합성이다. 효과 앞의 준비 시간을 줄인 검토판이므로
실제 전투 전체 시간과 같다고 보고하지 않는다. 수정 전은 대표 셀, 수정 후는 재생/시간 이동을 제공한다.
단회 재생 종료, 다섯 선택, 736/320px 폭, 어두운 테마에서 오류/가로 넘침을 확인했다.

세션 지침에 따라 gates/vitest/전체 typecheck는 실행하지 않았다.
편집한 TypeScript 7개는 esbuild로 구문을 읽었고 `git diff --check`를 확인했다.
