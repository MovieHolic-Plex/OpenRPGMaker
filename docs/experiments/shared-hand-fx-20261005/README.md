# 공용 손 도트 효과 24종 · 소환 v2 (2026-10-05)

**사용자 반려.** 후속 평가: “왜케 병신같다 느껴지지 하 시발 ..”.
24종 기본값/카탈로그/대체 배선을 철회하고 공개 PNG를 제거했다. 소환 PNG/생성기는 작업 전 HEAD로 복원했다.
`rejected-release/`는 반려 시점의 PNG 25장·소환 격자·저작 원본·배선 사본과 해시다.
아래는 반려 전 제작/기술 확인 기록이다. 현재 설치 상태나 미감 승인으로 해석하지 않는다.
전체 배선 사본과 전투 중간 캡처는 로컬 작업 기록이다. 승인된 변경의 Git 기록에는
반려 원화의 저작 원본/PNG와 해시, 확인 요약/사건 로그를 보존한다.

사용자는 이전 소환의 형상을 반려하고, 여러 스킬 효과를 에디터 기본값으로 요청했다.
`rejected-summon/`은 반려된 v1의 문자 원본과 PNG 사본이다. 승인작으로 취급하지 않는다.
새 그림도 사용자 승인 여부는 별도다.

## 그림과 재현

- 24종: 64×64, 8칸씩, 60ms/칸. 합계 192개의 직접 쓴 프레임.
- 용 소환 v2: 128×128, 12칸. 실제 런타임 72ms/칸, 검토 GIF는 70ms.
- 직접 저작 원본: `scripts/asset-gen/pixel-fx/shared_hand_cels.py`, `dragon_hand_cels.py`.
  최종 색 기호 행과 좌표를 직접 적었다. 도형 생성·회전·자동 보간·색 치환은 없다.
- `hand-authored/*.hand.json`은 저작 행의 직렬화 사본, `*.px.json`은 1:1로 펼친 전체 격자다.
- 런타임 PNG: `public/assets/generated/pixel-fx/hand_*.png`, `monk_dragon_aura.png`.
- 각 키의 하위 폴더에는 원본 크기 시트, 접촉 시트, 어두운/밝은/체커 GIF와 형식 보고서가 있다.
- `all-keyframes.png`는 24종의 접촉 프레임 비교판이다. `manifest.json`은 등록 PNG의 파일 해시와
  색 수/칸 수/격자 일치를 기록한다. 픽셀 변경 수는 미감 점수가 아니다.

```sh
python3 scripts/asset-gen/pixel-fx/build_shared_hand_fx.py
python3 scripts/asset-gen/pixel-fx/dragon_hand_cels.py
python3 scripts/asset-gen/pixel-fx/monk_dragon_aura.py
python3 assistant-skills/pixel-dot-authoring/scripts/pixelgrid.py render \
  scripts/asset-gen/pixel-fx/hand-authored/hand_guard_crystal.px.json \
  --out docs/experiments/shared-hand-fx-20261005/hand_guard_crystal --scale 2
```

## 공용 기본값 배선

`handPixelFxCatalog.ts`가 24종 이름·효과음·앵커·모션·스킬 예제를 소유한다.
기본 도트 애니메이션은 기존 17종 + 새 24종 = **41종**이다.
각 새 시트는 `pixel-fx-hand_*` 리소스와 `anim_px_hand_*` 애니메이션으로 등록된다.
기본 스킬 예제는 `skill_fx_*` 24행이며 배우에게 배정해 사용한다.

`retroSkillCatalog.ts` 공용 조회에 24개의 기본 연출 계약도 함께 넣었다.
스킬 연출 피커, 도트 연출 목록, 시트 갤러리, 실제 플레이어가 같은 그림을 쓴다.
도트 측면 전투의 기본 생성 효과 대체 표도 타격·발톱·회복·정화·보호·부활·혜성 등에 새 그림을 사용한다.

새 프로젝트는 기본 DB 생성기에서 받는다. 기존 프로젝트는 `ensureRetroRosterRecords`와
`ensureBundledBattleAnimations`에서 빠진 행과 참조 의존성만 받는다. 같은 ID의 저자 수정은 보존한다.
시작 파티나 배우의 습득 스킬에 24개를 강제 배정하지 않는다.

## 확인 범위

등록 PNG 25장, 204칸을 전체 격자와 픽셀 단위로 비교했다. 알파 0/255, 시트별 불투명 색 ≤16.
브라우저 기본값 조회·기존 행 보존·멱등성·상태 의존성 복원은
`verify-shots/shared-hand-fx-20261005/defaults.json`에 있다.
편집기와 전투의 화면 확인 범위/한계는 같은 디렉터리의 `SUMMARY.md`를 먼저 읽는다.
전투 GIF는 무음이며 소리는 재생 이벤트만 관찰했다.

공용 코드·에셋·기본 DB 변경이다. 녹화용 메모리 fixture는 사용자 프로젝트의 정본이 아니다.
사용자 SQLite와 원격 DB를 수정하지 않았다. gates/vitest/전체 typecheck는 실행하지 않았다.
