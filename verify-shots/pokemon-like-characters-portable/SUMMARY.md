# 독립 캐릭터 하네스 — 실행 검증

## 결과

- 독립 실행본: `/home/main/z-project/harness/pokemon-like-characters`
- 소스 보관: `harness/pokemon-like-characters/` (이 저장소)
- 실행 화면: http://mdc-server:18326/?wave=full-cast-v1
- 저장소: 독립 폴더의 `.data/casting.sqlite` + `candidates/` + `receipts/` + `waves/`
- Node24.11.1, Python3.12.3, Pillow12.1.1에서 검증.
- 최종 실행본에는 node_modules가 없고 에디터/게임 프로젝트/API 키를 참조하지 않는다.
- 배포 파일 88개가 소스와 SHA-256 일치. 16역할/192포즈, 모든 후보 pending, 실제 판정 0건.

## 증거 파일

- `verification.json`: 36개 격리 실행/보존/실패 검사 통과.
- `browser.json`: 57개 실제 브라우저 검사 통과, 브라우저 오류 0건.
- `distribution-check.json`: 독립 위치/파일 해시/후보 재로드.
- `live-independent.png`: 실제 독립 실행본의 18326 화면.
- `desktop.png`, `mobile.png`: 복사된 QA 저장소에서 조작한 검토 UI.

## 확인한 흐름

1. 도구를 저장소 밖의 공백 포함 임시 경로로 복사, node_modules 없이 doctor/prepare 실행.
2. 16종 렌더 및 등록, prepare 반복 시 같은 후보 ID 유지.
3. 원본 판형 해시와 수정 행 재현, PNG/GIF 각 프레임의 픽셀·순서·130ms 검사.
4. 새 초안 생성 → 실제 팔레트 수정 → render → 미결정 등록.
5. 보호된 발 수정, 원본 SHA 불일치 차단. `PYTHONOPTIMIZE=2`에서도 검사는 꺼지지 않음.
6. CSRF 누락, 외부 Origin, 관찰 항목 미완료, 잘못된 후보 SHA, 반려 이유 누락 차단.
7. 임시 저장소에서만 합성 Allow/Deny → 엔진 중립 PNG/GIF/메타데이터/ZIP 내보내기.
8. 서버 재시작 후 Allow/Deny 유지, 저장소 경로를 이동해도 승인된 내보내기 가능.
9. 승인 후 PNG 변조 시 stale, export/verify 차단. pending/denied export 차단.
10. 16종 실제 GIF/비교 이미지, 프레임 이동, 역할 필터, 5항목 확인, Allow 버튼, 재로드, 다운로드, Deny 후 다운로드 철회.
11. 320px 화면 가로 넘침 없음. 라이브 독립 서버도 별도 읽기 전용 캡처.

합성 판정은 테스트가 만든 임시 디렉토리에서만 수행 후 삭제했다. 기존 에디터의 사용자 승인 기록은 변경하지 않았다.
이 검증은 도구의 실행·형식·출처·승인 경계를 증명한다. 미감의 최종 승인이나 실제 게임 배치 검증이 아니다.

## 재실행

독립 폴더에서:

```bash
node tests/verify.mjs --out /path/to/evidence
```

브라우저 검증 개발 의존성 설치 후:

```bash
npm ci
npx playwright install chromium
node tests/browser.mjs --data /path/to/store --out /path/to/browser-evidence
```

다음 AI는 독립 폴더의 `AGENTS.md`, `README.md`, `docs/AUTHORING.md`를 읽는다.
