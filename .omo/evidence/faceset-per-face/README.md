# 얼굴 낱장화 증거 (2026-08-27)

한 얼굴 = 한 파일 모델이 **저자가 실제로 쓰는 표면**에서 성립하는지 확인한 기록.
PR #137 이후 사용자 신고: "페이스셋 설정한게 실제 반영이 전혀 안 되어있는데?"

## 재현된 결함

리소스 관리자 → 얼굴 그래픽 목록이 낱장 112장이 아니라 **192×192 시트 5장**만 보여줬다.
`defaultResourceProfiles()` 가 `EASYRPG_RTP_ASSETS` 의 faceset 시트를 등록하고 낱장 112장은
등록하지 않아서다. 피커만 QA 하고 리소스 관리자를 열지 않아 놓친 지점이다.

## 파일

| 파일 | 내용 |
|---|---|
| `EV-resource-manager-per-face.png` | 수정 후 리소스 관리자: "Actor1 얼굴 1…16" 낱장 항목 (112장, 48px 초과 0장) |
| `U1-after-upload.png` | 192×192 Actor2.png 업로드 직후 리소스 관리자 |
| `U2-uploaded-16-entries.png` | 업로드로 생긴 낱장 항목 — "Actor2 얼굴 11..16", 겁각 **48x48px** 표기 · 칸마다 다른 썰네일 |
| `upload-log.txt` | C1 업로드 분할 로그: 낱장 16개, dataUrl 16종(진짜 절단), 시트 자산 0 |
| `P1-picker-open.png` | DB 액터 얼굴 피커: 낱장 목록, 4×4 격자 없음, 인덱스 입력 없음 |
| `runtime-log.txt` | C4 런타임: 상태 메뉴가 `assets/easyrpg/faceset/Actor1/07.png` 를 background-position 0% 0% 로 그림 |

## 실측 수치

- 리소스 관리자 얼굴 목록: 112 항목 / 전부 48×48 / 48px 초과 0
- 업로드 분할: 16 자산 (`…-00`..`-15`), 전부 48×48, **distinctDataUrls 16** (칸마다 다른 픽셀)
- 실제 Supabase 프로젝트 `rpg-zzu-house-template-gallery`: faceset 프로필 112, 시트 프로필 0,
  `actor_hero.faceResourceId = easyrpg-faceset-actor1-07`, 저장본 내 `faceIndex` 0건
- 런타임 상태 메뉴: `background-size: 22px 22px`, `background-position: 0% 0%` — 잘라내기 오프셋 없음

## 주의 (같은 실수 반복 방지)

얼굴 표면은 네 곳이다: **피커 · 이벤트 명령 미리보기 · 리소스 관리자 · 런타임**.
얼굴 모델을 건드리면 네 곳을 모두 확인하라. 피커만 보면 이 결함을 그대로 놓친다.
