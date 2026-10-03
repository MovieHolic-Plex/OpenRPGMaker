# 지형 도구 실제 작동 GIF

2026-10-03 · `scripts/capture/capture-terrain-gif.mjs`
녹화 제품 코드: `dc463d03c68cc89a7afd7d26193be7ae7d58104b` (실제 배포 호스트와 동일).

## 즉시 확인

- `terrain-operation.gif`: 실제 편집기의 연속 화면 녹화. 경사로, 표면, 강 드래그,
  두 둑 다리, 나무 군집, 군집 이동, 삭제와 Ctrl+Z, 통행 표시를 차례로 조작한다.
- `final.png`: 녹화 마지막 상태.
- `recording.json`: 단계별 시각, 프레임 수, 실제 스토어의 마지막 상태와 JS 오류 목록.

## 재현

이 워크트리에서 `npm run dev:worktree`로 서버를 연 다음:

```bash
node scripts/capture/capture-terrain-gif.mjs
```

다른 포트는 `TERRAIN_CAPTURE_URL`, 다른 출력 폴더는 `TERRAIN_GIF_OUTPUT`으로 지정한다.
Playwright Chromium과 ffmpeg가 필요하다. CDP screencast의 실제 프레임과 시간 간격을
10fps 반복 GIF로 변환한다. 정지 화면을 이어 붙여 동작을 흉내 내지 않는다.
자막과 포인터 원은 녹화용 표시이며 제품 코드에 추가하지 않았다.

## 범위

40×30 Beodeul City 메모리 fixture에 고지만 준비한 뒤, 모든 시연 동작을 실제
도구 버튼·포인터·키보드로 실행한다. 사용자 호스트의 맵에는 쓰지 않는다.
최종 실제 관측은 경사로 18칸, 다리 10칸, 군집 1개, 고지 높이 2단이다.
이 fixture는 순수 편집기 QA 대상이다. 정본 콘텐츠 저장 증거는 기존
`verify-shots/terrain-placement/sqlite-roundtrip.json`을 참조한다.

기능 배포 PR: #1937. 실제 호스트 부팅과 막대 겹침 보정 PR: #1940, #1942.
배포된 `http://mdc-server:9888/`의 도구 노출과 실제 버튼 클릭도 별도로 확인했다.
AGENTS.md 제한에 따라 vitest·전체 typecheck·gates는 실행하지 않았다.
