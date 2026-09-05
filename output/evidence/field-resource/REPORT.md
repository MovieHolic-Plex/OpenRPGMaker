# 생성 몬스터 필드 리소스 수정 검증

판정: 리소스 표시 계약 통과. 이 보고서는 JRPG 전체 콘텐츠 품질을 판정하지 않는다.

- 입력: 감독자의 원격 저장 검토 스냅샷 `output/evidence/jrpg-adversarial-review/project-final.json`.
- 입력 SHA-256: `1d1d970a65405817108664595c8f212b06a17de3680b07f14c887ac2a2b0327b`.
- 게임 콘텐츠와 원격 DB는 수정하지 않았다. 전용 `player.html` 하네스로 이 스냅샷을 읽었다.
- 새 게임 → `map_forest_dungeon` 전이 → 실제 아래 방향 이동으로 플레이어와 카메라를 동기화했다.
- 브라우저: Chromium, 1024×768, 독립 QA Vite 서버. `start`·`dungeon-monsters` 두 비트 모두 통과, 런타임 오류 0.
- `missing-resource-error` 없음. 필드 스폰 3개 모두 `generated-enemy-slime-green`, `__BASE`, alpha 1.
- 시각 확인: `runtime/02-dungeon-monsters.png`에서 녹색 슬라임 세 마리의 전체 형태·눈·입이 식별된다. 원본 384px 이미지를 캐릭터 크기로 그리며 기본 charset으로 치환하지 않는다.
- 일반 자산 URL 해석기의 이름 추측은 필드 카탈로그 판정에 사용하지 않는다. 미등록 생성 ID는 기존 경고와 대체 그림을 유지한다.

검증:

```sh
npm run typecheck:app
npm test -- test/generatedMonsterFieldSprites.test.ts test/runtimeEventPageGraphics.test.ts test/runtimeMoveRouteCommands.test.ts test/houseDoorOpen.test.ts test/companionRules.test.ts
node output/evidence/field-resource/probe.mjs output/evidence/jrpg-adversarial-review/project-final.json
```

타입 검사 exit 0. 관련 5개 파일 36 tests 통과. `renderFootprintCenter.test.ts` 9 tests도 앞선 집중 검증에서 통과했다. 전체 `npm run gates`는 감독자가 통합 후 수행한다.

환경 기록: 첫 직접 Chromium 실행은 리소스 계약을 통과했지만, 재실행 때 호스트 `ERR_NETWORK_CHANGED`가 모듈 요청을 취소했다. `openwiki/testing.md`의 기존 우회대로 소유한 Vite 응답을 Node fetch로 그대로 전달했고, 캡처 Chromium에만 `--disable-features=LocalNetworkAccessChecks`를 적용했다. 엔진 응답·게임 로직·자산 바이트를 모킹하지 않았다. 최종 `runtime/manifest.json`은 이 경로의 오류 없는 결과다.
