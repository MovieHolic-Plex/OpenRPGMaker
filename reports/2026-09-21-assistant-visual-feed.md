# 조수 이미지 작업 피드

실행 당시 대상 사본을 기반으로 맵 비교, NPC 그래픽/위치, 아이템/장비/몬스터 수치, 소재 검색 갤러리를 표시한다.
기본 피드와 오른쪽 팀에 실제 소재가 보이고 클릭하면 비교 dialog로 확대한다. `초안`은 적용 성공을 뜻하지 않는다.

## 검증

- `npm run build:app`: 최신 main 통합 후 통과(39.77초, 기존 청크 크기 경고).
- `bun build scripts/lib/piAgentRuntime.ts --target=bun --packages=external --outfile=/tmp/oprn-visual-worker.js`: 통과.
- `node scripts/qa/ai-visual-feed.mjs`: 실제 편집기 + 실제 도구 어댑터, 모델 전송과 검수 응답만 결정적으로 재생. **12/12 통과**, 브라우저 런타임 오류 0건.
- `node scripts/qa/ai-activity-levels.mjs`: 기존 수준 선택·큰 창·초점·검토·기록/레인 브라우저 확인 36/36 통과.
- Vitest/gates/전체 typecheck는 저장소 세션 규칙에 따라 실행하지 않았다.
- 원격 프로젝트 저장은 차단했다. 라이브 모델 품질 또는 실제 게임 플레이를 검증한 화면이 아니다.

## 화면

- `.omo/evidence/assistant-visual-feed/brief.png`: 기본 이미지 피드와 팀, 몬스터 수치 변경 전/초안.
- `comparison.png`: 실제 도구로 놓은 길의 전/후 확대.
- `assets.png`: 실제 소재 검색 결과, 실패 시점 이미지.
- `trace.png`: 도구 입력과 구조화 결과를 펼친 로그.
- `compact.png`: 1024px 큰 창에서 이미지 피드.

최종 내구성 검증은 같은 출처의 별도 문서를 실제로 새로고침해 기존 IDB Blob을 읽었다. 개발 서버에서
편집기 셸 전체를 재부팅하면 `editor.ts` 동적 import가 간헐적으로 실패해, 이미지 저장 계약과 분리했다.
이 실행에서 편집기 전체 새로고침 성공을 주장하지 않는다.

## 보존과 제한

텍스트 기록에는 이미지 참조만 저장한다. PNG와 렌더 재료는 별도 기기 IDB 7일/64MB 상한이다.
맵 크롭 최대 32×24, 갤러리 최대 6개, 수치 최대 6개. 맵의 NPC는 위치 마커이며 캐릭터 모습은 별도 카드다.
새로 기록된 작업만 지원하고, 옛 실행에 없는 이미지·없거나 읽을 수 없는 소재는 누락 안내로 남긴다.
