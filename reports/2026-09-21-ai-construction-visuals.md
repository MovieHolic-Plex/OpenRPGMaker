# AI 시공 연출 복구

기본 적용 모드가 고스트 이벤트를 차단하고, 변경 256셀을 넘으면 실제 타일 렌더를 없애던 경로를 수정했다.
Pi의 표시 전용 `set_build_spec` 도구와 기존 청사진을 연결하고, 명시 계획 없는 공간 쓰기도 도구 좌표를 표시한다.
checkpoint는 승인 뒤 시공 표시를 거쳐 기존 적용 게이트로 들어간다. 적용 후에는 기준선을 갱신한다.

## 재현과 증거

`BASE=http://127.0.0.1:9854 node scripts/capture-ai-construction.mjs`

- `output/evidence/ai-construction/01-blueprint.png`: 시공 전 구역과 순서.
- `output/evidence/ai-construction/02-building.png`: 초기 복구 버전의 실제 타일 표시(빛 효과는 후속 변경에서 제거).
- `output/evidence/ai-construction/03-complete.png`: 적용 뒤 오버레이 정리.
- `output/evidence/ai-construction/probe.json`: 변경 셀 수, 적용 전 불변, checkpoint ACK, 적용 후 상태.

브라우저는 실제 편집기와 Pi 클라이언트/적용 경로다. 워커는 대본화된 NDJSON을 보내며, 집 그림은
실제 houseKit 스탬퍼로 만든 최소 QA fixture다. 중간 프레임 촬영 중에만 브라우저 시계를 정지한다.
원격 게임 콘텐츠를 저작하거나 DB에 저장하는 작업이 아니다. 화면의 임시 세션/온라인 저장 상태는
이 QA 격리에 따른 것이며 저장 성공 증거로 사용하지 않는다.

앱 타입 검사와 워커 파일 TypeScript 변환을 확인했다. Vitest/전체 gates는 저장소 세션 규칙에 따라
실행하지 않았다. 변경한 단위 테스트는 새 공개 순서와 대규모 실제 타일 표시 계약을 기술한다.
실 LLM이 계획을 제출하는 빈도, 새 맵 자동 이동, 병렬 레인별 청사진은 이번 브라우저 증거의 범위 밖이다.

실측 DEFAULT: 변경 758셀, 시공 표시 중 원본 미변경, checkpoint ACK `ok:true`, 적용 뒤 원본 변경,
고스트 0셀·청사진 0개, 브라우저 pageerror 0건. 밑그림/중간/완료 PNG를 직접 열어 확인했다.

실측 REVIEW: 변경 758셀을 원본 미변경 상태로 표시, 실제 검토 카드의 버리기 버튼으로 폐기,
폐기 뒤 원본 미변경·고스트 0셀·청사진 0개·pageerror 0건.
증거는 `output/evidence/ai-construction-review/probe.json` 및 같은 폴더 PNG다.
브라우저 companion hello 연결 거절과 종료 시 edit-activity 요청 취소는 대본화 QA 환경에서 관찰되었다.

## 후속: 빛 대신 움직임 (사용자 요청)

- 밑그림은 구역별로 순서를 두고 외곽선을 그린다. 완성된 선에는 작은 눈금이 남는다.
- 하위층 4px·상위층 10px 내려앉기, 무광 연필 커서, 소량의 옅은 먼지로 시공을 표시한다.
- 적용 후 작은 `✓ 반영됨` 표식을 띄운다. 빛줄기·불꽃·DOM 테두리 발광은 제거했다.
- 효과음은 추가하지 않았다. 동작 줄이기 설정에서는 선 그리기·내려앉기·커서 이동을 생략한다.
- 앱 타입 검사 exit 0. Vitest와 전체 게이트는 실행하지 않았다.

새 증거는 `output/evidence/ai-construction-motion/`와
`output/evidence/ai-construction-motion-review/`에 있다. Firefox로 촬영했다.
Chromium에서는 호스트의 ERR_NETWORK_CHANGED 때문에 최초 로드가 중단됐다.
Firefox의 companion `/v1/browser/hello` 연결 실패는 관찰됐지만, 두 경로 모두
브라우저 pageerror 및 시공 렌더러 오류는 0건이었다.
재현용 응답은 검수 API에 의도적으로 503을 반환한다. 검토 패널의 해당 문구는
이 격리 설정에 의한 것이며 실제 모델 검수 성공을 주장하지 않는다.

재현:

```bash
BROWSER=firefox BASE=http://127.0.0.1:9854 node scripts/capture-ai-construction.mjs
BROWSER=firefox MODE=review OUT=output/evidence/ai-construction-motion-review node scripts/capture-ai-construction.mjs
```

촬영 시계는 페이지 탐색 전에 설치한다. Phaser 부팅 뒤에 performance.now의 기준을 바꾸면
트윈 시간이 역행해 완료 표식이 멈춰 보인다. 부팅 전 설치로 재촬영해 실제 소멸 화면을 확인했다.
최종 프레임 `12-settled.png`에서는 완료 표식까지 사라진다.

최종 증거: 기본 모드 13장 + 검토 모드 12장 = 25장. 두 모드 모두 758셀,
시공 중 원본 미변경, 종료 후 고스트·밑그림 0, 브라우저 오류 0.
기본 모드는 ACK ok 및 실제 반영, 검토 모드는 버린 뒤 원본 유지.
전체 갤러리: `reports/2026-09-21-ai-construction-gallery.md`.

커밋에 보존한 최종 스크린샷과 probe 기록은 `.superpowers/sdd/qa-shots/ai-construction-motion/` 및
`.superpowers/sdd/qa-shots/ai-construction-motion-review/`에 있다.
