# 현대 실내8개 완성 맵 복사 확인 — 2026-09-25

**이 관찰은 복사 도구의 사용 확인이며, 조수가 새 평면을 설계·배치할 수 있다는 증거가 아니다.**
직접 배치는 별도 [DIRECT-AUTHORING-VERIFICATION](DIRECT-AUTHORING-VERIFICATION.md)에서 다룬다.

범위는 센토, 라멘집, 아파트3평면, 여관, 의원, 탁구장이다.
[조립 지침](MODERN-INTERIORS.md)의 저장 예제를 실제 모델이 검색하고 독립 맵으로 재현하는지 확인했다.
정답 배열을 요청에 넣거나 모델 응답을 모킹하지 않았다. 연결된 앱의
`google-antigravity / gemini-3.7-flash`, 실제 `runPiAgent`·registry·commit 경로를 사용했다.

## DB 확인

정본 `6ae74f7a-23a2-449b-8171-5afb5dff532b`,
`/home/main/.local/share/oprn/paw-city-20260924/project.sqlite`, revision83.
공식 호스트API로 다시 읽어8맵·타일셋 참고문서·그림 bytes가 준비본과 일치함을 확인했다.
SHA256 `335e24d74848d562a6432bfa0df7142a109093b2142bf158f08f456455124aed`.

로컬 공용 `/home/main/.local/share/oprn/shared-content.sqlite`도 재조회했다.
PAW9개 라이브러리86장소/24저장맵/289타일셋이며 장소·타일셋·객체 문서 누락0이다.
주 라이브러리 전체가 직전 게시본과 일치한다.
주 라이브러리 revision `6c8c170a53e0146c9909fc78451264ea50e75750ae0e41f90cc5735f82b8a15d`,
실제 모델이 조회한 전체 공용 snapshot revision `4f25c990dfb2341b759ab15358865947d2b992c8497b49c87e1ce9730ebb017f`.
이미 저장된 같은 콘텐츠를 중복 게시하지 않았다. 원본 추가 다운로드/재배포 없음.

## 실제 실행과 발견한 한계

첫 실행은18턴/60도구 호출/도구 오류0, 약86초였다.
모델이8개 장소를 찾아 inspect하고 각각 문서 첫 페이지와 원본 그림을 읽었다.
`build_shared_scene`8회로 독립 맵8개를 생성하고 `show_map_region`8회로 결과 그림을 받았다.
전체 lower/upper 배열은 원본과 일치했고 기존 빈 맵은 보존되었다.

하지만 **모든 조립 문서가6000자 첫 페이지에서 중단**됐다.
`nextOffset`이 남았는데도 생성했다. 정확한 복사 성공과 지침 완독을 별도로 판정해야 한다.
실행 보고서의 pass는 생성·렌더 범위이며 문서 완독 근거는 `placement-audit.json`을 본다.

추가 지시로 같은 결과를 보존하며 문서 전 페이지를 다시 읽게 했다.
14턴/38도구 호출/오류0, 약42초에8문서20페이지를 끝까지 읽었다.
이 실행에서는 새 결과 그림 요청이 없어서 재시각검토 조건은 실패로 기록했다.
문서만 읽고 그림까지 다시 대조했다고 한 모델의 자기 보고를 그대로 채택하지 않았다.

그림 확인만 별도로 지시한 마지막 실행은3턴/9도구 호출/오류0, 약23초였다.
실제8개 결과 PNG를 다시 전달했고 생성 맵·타일셋·이미지는 바뀌지 않았다.
이 과정은 **감독 추가 지시가 포함된 재검토**이며 처음부터 모든 지침을 자율 준수한 성공이 아니다.

시각 설명도 정답으로 취급하지 않는다. 마지막 모델은 라멘집의2인 테이블을4인으로
설명하고, 여관의 의도적인 천장 덩어리를 빈 공간으로 평가했다.
실제 좌석은 바6+테이블 의자6=12석이며 원본 객체와 배열로 확인한다.
열린 문턱에 문 그림이 없다는 지적은 알려진 미구현 범위다. 그림을 봤다는 사실과
가구 종류/인원/벽 표현을 정확히 이해했다는 주장을 구분한다.

## 조수가 만든 결과 검사

감독 관측기는 조수 출력 배열을 고치지 않고 검사했다.

| 실내 | 크기 | 접근 목표 | 폐쇄 검사 구획 | 배치 오류 |
|---|---:|---:|---:|---:|
| 센토 | 21×32 | 13 | 4 | 0 |
| 라멘집 | 15×19 | 22 | 1 | 0 |
| 아파트 A | 11×21 | 12 | 3 | 0 |
| 아파트 B | 13×21 | 14 | 3 | 0 |
| 아파트 C | 14×18 | 13 | 3 | 0 |
| 여관 | 22×19 | 13 | 3 | 0 |
| 의원 | 17×21 | 20 | 3 | 0 |
| 탁구장 | 20×25 | 13 | 2 | 0 |

실제 `canMove`로 접근120점과 모든 빈 바닥의 도달을 검사했다.
22개 방의 출입구 폐쇄 후 다른 방으로 새는 경로가 없고, 천장 아래 벽 전부,
가구 밑동/벽걸이 지지, 객체 전체 배열, 수납장 조작면, 탁구대 끝 여유가 유지된다.
모델의 검사했다고 하는 문장을 엔진 검사 근거로 사용하지 않았다.

## 조수 결과의 실제 저장

별도 정본 프로젝트에 기본 빈 맵1+조수 생성8맵을 저장하고 저장소를 닫았다가 다시 열었다.
원래 제작 프로젝트를 검증 사본으로 덮지 않았다.

- project id: `8c15434f-6f3c-454f-afd1-7237a4cd2c65`
- 저장 대상: `/home/main/.local/share/oprn/paw-modern-ai-check-20260925/project.sqlite`
- revision1, SHA256 `af0c75152e25b0574eeee5faac612c37b1784bcfe5f4ffd304886c499054d294`
- 전체 프로젝트 JSON 값 및 저장 자산 bytes 재로드 일치. 후속 검토에서도 맵/타일/그림 불변.

## 재현과 증거

```bash
bun scripts/qa/pixel-art-world-modern-interiors-live.mts PRIVATE/ai-live
bun scripts/qa/pixel-art-world-modern-interiors-audit.mts PRIVATE/ai-live
bun scripts/qa/pixel-art-world-modern-interiors-live.mts PRIVATE/ai-reviewed PRIVATE/ai-live
bun scripts/qa/pixel-art-world-modern-interiors-live.mts PRIVATE/ai-image-reviewed PRIVATE/ai-reviewed images
bun scripts/qa/pixel-art-world-modern-interiors-review.mts PRIVATE/ai-live PRIVATE/ai-reviewed PRIVATE/ai-image-reviewed
node scripts/content/save-scene-ai-observation.mjs PRIVATE/ai-live/result-project.json NEW_SQLITE_FOLDER PRIVATE/ai-saved
```

실제 모델 호출은 연결된 제공자의 쿼터를 사용한다. 단순 소스 변경 확인에 자동 실행하지 않는다.
로컬 증거: `output/paw-modern-interiors/ai-verification/`, `ai-live/`, `ai-reviewed/`,
`ai-image-reviewed/`, `ai-saved/storage-proof.json`.
전체 gates/vitest/typecheck는 실행하지 않았다. 게임플레이/도시 전이/문/영업 이벤트는 이번 범위가 아니다.
이 결과는 **저장 예제8개의 정확한 재현**을 확인한다. 임의의 새 평면 설계 능력이나
일반 모델 성공률로 확장하지 않는다.
