# 주인공 마법 재수정 · 표시 확인

이번 판은 사용자가 반영·커밋·PR 머지를 승인했다. `review-decision.json`에 승인된 원본/PNG 해시를 묶었다.
아래 기술적 표시 성공 자체는 미감 점수가 아니다.
직전 반려 판의 현재 교체와 기존 히드라 원화 재사용 범위는
`docs/experiments/hero-magic-rework-20261005/README.md`를 따른다.

## 즉시 확인

아래 PNG는 실제 전투 GIF에서 뽑은 표본이다. GIF의 모든 프레임이나 최고점의 미감 점수는 아니다.

- `actual-mage_fire_burst.png`: 길어진 불기둥과 갈라진 명암.
- `actual-mage_blizzard.png`: 세 적에 표시된 결정 조각.
- `actual-mage_chain_bolt.png`: 굵은 낙뢰 세 줄과 바닥 접촉.
- `actual-cleric_holy_hit.png`: 마지막 물결 배경과 큰 착탄.
- `actual-monk_dragon_aura.png`: 기존 히드라 원화가 전장에 유지되는 순간.

`actual-*-sequence.png`는 앞뒤 두 프레임을 더한 3장 표본이다.
`gif-samples.json`에 GIF 내 시각과 표본 선택 방법을 기록했다.
합성 검토판의 실제 캡처는 `preview/{fire,ice,thunder,holy,summon}.png`다.

## 실제 플레이어

전용 `player.html`과 내보내기 shim, 실제 키보드 입력을 사용했다. 정본 프로젝트는 수정하지 않았다.

| 효과 | 실제 표시 | 층/노드 | 확인 경로 |
|---|---|---|---|
| 화염 | 완료 | 2/2 | `runtime/` |
| 빙결 | 완료 | 1/3 | `runtime/` |
| 번개 | 완료 | 1/3 | `runtime/` |
| 홀리 | 완료, 최종 긴 물결로 재확인 | 4/8 | `runtime-holy-warm/` |
| 히드라 연출 | 완료, 전사에게 공용 연출을 연결한 사본 | 3/5 | `runtime-summon-default-graphics/` |

관측 셀: 화염 0~7, 빙결 0~7, 번개 0~6, 홀리 앞뒤 구슬 각각 0~11,
홀리/소환 착탄 각각 0~5, 배경 0/1, 히드라 본체 0.
성공한 다섯 효과는 모두 완료됐으며 `remainingFx=0`, 표시 오류가 없다.
배경은 전장 뒤에서 256px 물리 크기의 타일을 반복했다. 화염/빙결/번개는 native64를 128px로 표시한다.
무음 GIF와 소리 사건 로그이며 실제 오디오 녹음이 아니다.

보존한 실패:

- `runtime-summon/`: 소프트웨어 그래픽 설정에서 시작 화면 시간 초과, 녹화 0개.
- `runtime-holy-final/`: 새 캐시의 초기 기본 DB 동적 모듈 로드 실패, 녹화 0개.
- `boot/`: 같은 소환 사본의 일반 Chromium 시작 진단. title ready=true, 요청 실패/콘솔 오류 없음.

기본 Chromium 인자와 이미 사용한 캐시에서 소환/홀리 녹화는 완료됐다.
실패의 근본 원인을 확정한 작업은 아니다. 원래 무도가 파티의 시작 실패를 해결한 것으로 보고하지 않는다.

재현 명령:

```bash
VITE_CACHE_DIR="$PWD/.vite-cache/snes-boot-diagnostic" node scripts/qa/runtime/retro2003-skills-gif.mjs \
  --set custom --custom docs/experiments/hero-magic-rework-20261005/summon-runtime-fixture.json \
  --out verify-shots/hero-magic-rework-20261005/runtime-summon-default-graphics \
  --impact-audit --browser-graphics default
VITE_CACHE_DIR="$PWD/.vite-cache/snes-boot-diagnostic" node scripts/qa/runtime/retro2003-skills-gif.mjs \
  --set class --skills cleric_holy_smite \
  --out verify-shots/hero-magic-rework-20261005/runtime-holy-warm \
  --impact-audit --browser-graphics default
```

## 실제 자료집과 대화 비교

`inspect-editor.mjs`로 실제 `renderSkillRetroStage`를 다섯 스킬에 직접 마운트했다.
`editor/observations.json`: 기존 스킬 5개 모두 발견, 대표 시각/셀 위치/배경 반복 크기 확인,
오류/620px 화면 가로 넘침 없음. 전체 편집기 저장 경로를 검증한 것은 아니다.

`inspect-preview.mjs`: 다섯 선택과 시간 이동, 단회 재생 종료, 736/320px 폭,
어두운 테마, 오류/가로 넘침 없음. 왼쪽은 직전 반려 판 대표 셀이다.
오른쪽은 준비 시간을 줄인 별도 원본 합성으로 실제 게임 전체 시계와 다르다.
소환의 기존 히드라 원화 재사용을 비교 화면에도 표시했다.

## 자산과 구문 확인

`assets.json`: 10개 활성 원본과 PNG 픽셀 일치, PNG 바이트 재현, 이진 알파,
불투명색 3~13색, 배경 셀 사본 4개의 정확한 픽셀 일치.
화염/빙결/번개/소환 본체/소환 착탄의 기존 개별 진입점 5개도 같은 RGBA를 재현한다.
스킬 셀/시간표와 공용 메타데이터는 유지하고 화염 노출 시간/설명을 갱신했다.

gates/vitest/전체 typecheck는 세션 지침에 따라 실행하지 않았다.
편집 TypeScript 파일은 esbuild 구문 파싱만 했으며 `git diff --check`를 확인했다.
사용자 정본 SQLite/외부 저장소 쓰기 및 새 스킬 자동 설치는 수행하지 않았다.
