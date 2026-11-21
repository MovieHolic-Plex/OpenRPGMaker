# 이벤트 명령 AI 패널 검수

기준은 #4848의 `882e5ce32`입니다. 두 화면 크기에서 같은 프로젝트와 요청으로 대기, 생성 중, 초안 검토, 적용 직후를 찍었습니다. 모델 응답을 고정하고 실제 조수 브리지, 명령 작성 도구, 적용 경로를 사용했습니다. 초안은 대사 변경, 대기 삭제, 이벤트 기억 추가를 한 번에 보여 줍니다.

| 화면 | 상태 | 전 | 후 |
| --- | --- | --- | --- |
| 1440×900 | 대기 | [전](before-1440x900-idle.png) | [후](after-1440x900-idle.png) |
| 1440×900 | 생성 중 | [전](before-1440x900-generating.png) | [후](after-1440x900-generating.png) |
| 1440×900 | 초안 | [전](before-1440x900-draft-with-diff.png) | [후](after-1440x900-draft-with-diff.png) |
| 1440×900 | 적용 직후 | [전](before-1440x900-after-apply.png) | [후](after-1440x900-after-apply.png) |
| 1024×768 | 대기 | [전](before-1024x768-idle.png) | [후](after-1024x768-idle.png) |
| 1024×768 | 생성 중 | [전](before-1024x768-generating.png) | [후](after-1024x768-generating.png) |
| 1024×768 | 초안 | [전](before-1024x768-draft-with-diff.png) | [후](after-1024x768-draft-with-diff.png) |
| 1024×768 | 적용 직후 | [전](before-1024x768-after-apply.png) | [후](after-1024x768-after-apply.png) |

개발 서버를 `npm run dev -- --port 9495 --host 127.0.0.1 --strictPort`로 띄운 뒤 `node scripts/capture-event-ai-dock.mjs after <저장 폴더>`를 실행합니다. 기준 화면을 찍을 때는 #4848 체크아웃에서 서버를 띄우고 같은 스크립트에 `before`를 전달합니다.
