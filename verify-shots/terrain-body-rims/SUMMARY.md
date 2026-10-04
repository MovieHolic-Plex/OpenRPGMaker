# 하반신 가림 · 절벽 위쪽 외곽 수정 (2026-10-04)

## 원인과 수정

- 실제 바닥 띠는 칸의 남쪽 끝 depth를 썼고, 캐릭터는 이동 중 연속 발 y depth를 썼다. 같은 바닥이 캐릭터 앞에 그려져 하반신을 덮었다. 렌더 동안만 발이 속한 줄의 바닥/벽 위로 정렬하며 논리 y/depth는 매 프레임 복원한다. 더 남쪽의 높은 지형은 계속 가린다.
- 실제 하층 타일을 투영하는 마지막 패스가 북·동·서 외곽선과 뒤 둑까지 덮었다. 원본 재질에 외곽 명암을 적용하고, 바깥 흙 둑은 벽으로 분리했다. 기본 흙벽에도 북쪽 뒤 둑/안쪽 밝은 턱을 그린다. 지도 여백의 둑에도 윗단 주인 줄을 준다.
- 재질 없이 계산하는 클릭 판정도 같은 기본 뒤 둑을 사용한다. 화면과 다른 윗면/벽 판정으로 회귀하지 않도록 비교했다.

앞선 `terrain-seams` QA는 발 좌표 오차 0과 접점 그림을 근거로 삼아 실제 몸 가림과 북쪽 외곽선 소실을 놓쳤다. 이 기록은 그 누락을 바로잡는다.

## 실제 출하 플레이어

`capture-terrain-body-rims.mjs`는 편집기 play 모드가 아닌 `dist/export-player/player.html`을 사용한다. 순간 이동은 시나리오 초기화에만 사용한다. 통과/through 없이 실제 키보드 한 걸음마다 이동 중인 WebGL 프레임을 읽는다.

| 방향 | 왕복 이동 중 프레임 | 수정 후 하반신 원본 화소 색 일치 최솟값 |
|---|---:|---:|
| 북 | 14 | 100% |
| 남 | 16 | 100% |
| 동 | 16 | 99.25% |
| 서 | 16 | 100% |

총 62개 이동 중 프레임. RGB 차이 12 이하, 화면 1px 이웃 허용으로 해당 애니메이션 프레임의 불투명 하반신 화소를 비교한다. 이는 전체 시간의 모든 프레임을 증명하는 수치가 아니다. 실제 왕복 영상과 샘플 PNG도 함께 확인했다. 별도 높은 앞 지형 뒤 장면은 계속 가려진다. 브라우저 오류 0.

`before/n-up-9-13.png`는 수정 전 실제 몸이 바닥에 덮이는 장면이다. `body-before-after.png`는 같은 걸음의 독립 녹화 샘플을 나란히 놓았다. Image.onload가 다음 프레임 뒤에 호출될 수 있어 카메라 좌표를 카메라 postrender에서 고정한다. 카메라가 진행한 뒤의 좌표로 이미지를 비교하면 온전한 몸도 누락으로 오판한다.

### 저장/재로드 대상과 범위

- 원본 QA SQLite: `.vite-cache/terrain-seams/project/project.sqlite`, project id `9f70cb93-c831-4ab9-a6fe-d46a3634beff`. 이번 에디터 QA 후 revision 28. 세 맵은 QA 시작 전과 SHA가 같다.
- 출하 플레이어용 별도 SQLite: `.vite-cache/terrain-body-rims/runtime-project/project.sqlite`, project id `449391fe-2448-49f2-9fa9-8ac46b9ccd87`, revision 2. 저장 후 다시 열어 맵 데이터가 원본 revision 21과 완전히 같음을 확인했다. 이후 원본 에디터 QA에서도 세 맵이 복원됐다.
- 플레이어용 사본은 세 저작 맵과 런타임 데이터를 유지하고, 실제 참조한 버들항 아틀라스 하나를 남긴다. 에디터가 등록한 356개 미사용 타일셋을 모두 로드하는 검증은 아니다. 전체 타일셋 사본의 브라우저 부팅이 종료되는 현상은 별도 범위다. 원본 QA SQLite와 사용자 프로젝트에 타일셋 제거를 적용하지 않았다.
- 사용자 정본 `c779e278-8cec-4da4-9c2f-df423460b60d` / `/home/main/.local/share/oprn/web-workspace/project.sqlite`는 QA 쓰기 대상이 아니다. 설치 전 121개 맵 SHA `e0b8826e83503a5de1371f94144af4b49b6cf047f9669d870edc5052e348f05a`. 설치 후 읽기 근거는 `installed-editor.json`.

### 설치본 확인

`http://mdc-server:9888/`의 실제 에디터가 준비된 뒤 버들항 원본 집 계열 5개가 표시됨을 확인했다. 사용자 정본 revision 338, 121개 맵의 SHA가 확인 전후 같고 브라우저 오류는 0이다. 설치 체크아웃 `902f98edba6e7948bb4c774f74a5b89d30022a6a`는 본 수정의 커밋을 포함하며 두 렌더 소스가 동일하다.

설치된 출하 플레이어 파일은 `--build-root /home/main/z-project/rpg-zzu-host/dist/export-player --public-root /home/main/z-project/rpg-zzu-host/public`로 정적 하네스에서 연다. 편집기 셸이나 사용자 DB를 통과하지 않고, 위의 저장/재로드한 별도 QA 프로젝트를 로드한다. 이 방식은 서버의 편집기용 `/assets` 경로와 출하물의 경로를 섞지 않는다. 관측 결과는 `installed-runtime/observations.json`.

설치된 파일의 재확인에서는 북 14 / 남·동·서 각 16개, 총 62개 이동 중 프레임의 하반신 색 일치가 모두 100%였다. 높은 앞 지형의 가림은 유지되며 브라우저 오류는 0이다. 최종 2배속 영상의 수정 후 이동 구간은 이 설치된 출하 파일로 녹화했다.

## 절벽 외곽 시각 QA

- 실제 저장/재로드한 세 맵의 높이 접점 1,186곳 중 북쪽·동쪽·서쪽 접점 **774곳**, 8개 시트를 확인했다. 가려진 접점도 포함하며 모두 독립적으로 보인다는 뜻은 아니다. h=houses_native 227, r=ramps_four 348, t=terrain_ai 199.
- 잔디·흙·돌, 2/3/6/14 높이, 대각 모서리·오목/볼록 외곽·지도 위 여백을 전체 그림과 확대 시트에서 확인했다.
- `surfaces/observations.json`: 기본 + 이름 있는 27개 양식. 부분/전체 RGBA·주인 줄·띠 일치. 재질 유무에 따른 전체 윗면/벽/주인 칸 판정 일치. 뒤 둑 클릭 표본 8개 × 28양식=224개는 실제 `reliefPickPoint`가 올바른 벽/주인 칸을 반환했다.
- `editor/observations.json`: 실제 패키지 에디터/SQLite 브리지. 늪·눈 양식 선택/저장/Undo, 북쪽 윗단 바닥 붓, 부분 화면과 전체 재생성 화소 일치, 새로고침 후 세 맵 SHA 복원, 브라우저 오류 0.

## 재현

```bash
bun scripts/capture/inspect-terrain-rim-surfaces.mts
bun scripts/capture/inspect-terrain-seams.mts --out verify-shots/terrain-body-rims/edges-after
python3 scripts/capture/terrain-rim-sheets.py verify-shots/terrain-body-rims/edges-after
node scripts/capture/capture-terrain-body-rims.mjs --label after
node scripts/capture/capture-terrain-rims-editor.mjs
```

별도 QA 프로젝트 호스트(9854)와 패키지/플레이어/호스트 빌드가 필요하다. 직접 SQLite를 여는 inspection은 QA 호스트를 멈춘 뒤 실행한다. 본문 PNG/관측 JSON은 실제 결과이며 MP4는 실제 Chromium 프레임과 경과 시간으로 만든 2배속 녹화다. 로컬 Vitest/전체 typecheck/gates는 AGENTS의 제한에 따라 실행하지 않았다.
