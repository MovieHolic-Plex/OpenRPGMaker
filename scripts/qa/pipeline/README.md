# QA 파이프라인 — 싼 모델이 대량으로 보고, 고급 모델이 보고서를 검토한다

출하된 데모 게임을 **한 명령**으로 QA 한다. 브라우저 플레이와 1차 시각 관찰은 QA VM(신기루 `am3685-1`)에서
싼 모델(`oc/deepseek-v4.1-flash-free`, effort max)이 하고, 최종 판정은 이 상자에서 Anthropic Opus 가 증거를 직접
보고 내린다. 게임 파일은 **VM 의 로컬 미러에서만** 읽는다 — 운영 게임 호스트에 요청을 보내지 않는다.

```
plan ─▶ play ─▶ detect ─▶ observe ─▶ cluster ─▶ pull ─▶ review ─▶ report
(VM)     (VM)     (VM)       (VM)        (VM)      (scp)   (Opus)    (HTML)
```

| 단계 | 파일 | 하는 일 |
|---|---|---|
| plan | `vm/plan-run.mjs`, `lib/plan.mjs` | `project.json` → 작업표. 맵마다 입장·네 방향 걷기, 대사/선택지/상점/엔딩 이벤트마다 `qaCheckpoint.startEventId` 로 직행, 부대마다 `startTroopId` 전투, 타이틀·메뉴. 입력을 키보드/마우스/터치로, 화면을 1440×900·1280×720·844×390·390×844 로 돌려 배정. 브라우저 없이 잡는 **정적 검사**(없는 맵/맵 밖 좌표 이동, 없는 자원, 상점의 없는 품목, 빠져나갈 수 없는 반복, 어디서도 안 가는 맵, **대사 초상에 얼굴이 아닌 자원**(`changeFace` 의 자원 종류 ≠ faceset), **NPC 그림칸 번호가 시트 칸 수 밖**)도 여기서 낸다. |
| play | `vm/play.mjs`, `vm/player.mjs` | cgroup 메모리(`/sys/fs/cgroup/memory.current`)를 보며 세션을 풀로 돌린다. 매 단계 **정착 프레임**(전환 오버레이가 끝나고 300 ms 간격 두 장이 같을 때, 검은 화면은 3.5초까지 기다림)만 찍고, 같은 순간의 화면 DOM 글자, DOM 으로 잰 글자 잘림·화면 밖 UI, 콘솔/페이지 오류, 실패한 요청, 누락 텍스처를 남긴다. 127.0.0.1 밖으로 가는 요청은 막고 기록한다. |
| detect | `vm/triage.mjs --phase detect`, `lib/detect.mjs` | 모델 없이 결정: 오류, 404, 누락 자원, **멈춤**(입력 6번에 상태 불변 — 터치·마우스 세션은 먼저 Enter 로 다시 시도해, 그걸로 풀리면 「입력 방식 무시」로 따로 낸다), 3.5초 넘는 암전, 이벤트 무반응, 움직일 수 없는 입장 지점, DOM 잘림·말줄임·화면 밖 UI, **대사 글자**(모지바케·대체 문자, TODO·자리표시, 내부 id 노출 — 출하 3데모 대사 2,417줄에서 오탐 0). 같은 것은 묶는다. 관찰 모델에는 정착·비암전·지각 해시(dHash) 중복 제거된 프레임만 보낸다(대사가 다르면 해시가 비슷해도 보낸다). |
| observe | `vm/observe.mjs` | deepseek 이 프레임 한 장씩 체크리스트로 본다. **그 순간의 DOM 글자를 정답으로 같이 준다** — 도트 글꼴 오독(이리스→미리스 등)을 출처에서 막는다. |
| cluster | `vm/triage.mjs --phase cluster`, `lib/cluster.mjs` | 관찰 이슈를 (점검 항목, 화면/맵, 위치)로 군집하고, 결정적·정적 결과와 합쳐 후보를 만든다. 후보마다 대표 프레임 + **바로 다음 프레임**(전환인지 지속인지 보이게) + 다른 세션 프레임, DOM 글자, 직전 입력. |
| review | `review.mjs` | Opus 가 후보마다 증거를 보고 `real / misread / transition / by_design / not_visible / environment` 로 판정하고 심각도·담당(게임 데이터/엔진/에디터/AI 조수)·재현·고칠 곳을 쓴다. 이어서 남은 것 전체를 한 번 더 읽고 같은 결함을 병합·순위 매긴다 → `final.json`, `fix-queue.json`. **측정된 결함**(DOM 잘림·404·페이지 오류·멈춤·대사 글자·정적 데이터 검사)은 검토가 그림만 보고 기각하지 못한다 — `environment`(QA 하네스 탓)만 뺄 수 있고, 다른 판정은 `reviewerVerdict` 로 남기고 `real`(신뢰도 ≤0.6)로 둔다. 「글자가 칸을 넘치는 것은 전환이 아니다」, 「타자 효과는 다음 프레임이 같은 상자에 더 긴 글자를 보일 때만 전환」을 검토 지시에 넣었다. |
| report | `report.mjs`, `lib/measure.mjs` | 한국어 보고서(이미지 포함). 심은 결함이 있으면 검토 전/후 포착률. 단계별 시간과 모델별 토큰. |

## 한 명령

```bash
export ANTHROPIC_BASE_URL=http://127.0.0.1:8318            # claude CLI 와 같은 짝
export ANTHROPIC_AUTH_TOKEN=...                            # ~/.claude/settings.json 의 env 값
node scripts/qa/pipeline/qa.mjs --game fallen-star --version 1.37 \
  --out tmp/qa-pipeline --report-dir ~/claude-viz
# 결함을 심어 측정까지:            --plant p1 [--plant-seed 11]
# 크기 조절:                        --max-jobs 120 --max-events 120 --max-observe 400 --pool 20 --observe-pool 16
# 중간부터 다시:                    --from observe   (plan|play|detect|observe|cluster|pull|review|report)
```

산출물(`tmp/qa-pipeline/<tag>/`): `summary.json`(커버리지·시간·토큰·판정 수), `reviewed.json`(후보 + 판정),
`final.json`(병합된 결함), **`fix-queue.json`**(수정 레인 입력: 순위·심각도·트랙 `game-data` 또는
`engine/editor/assistant`·증거 경로·재현·고칠 곳), `measure.json`(심은 결함), 증거 프레임.

### 연속 녹화 (선택, 기본 꺼짐)

`QA_VIDEO=1` 을 주면 `vm/player.mjs` 가 세션 전체를 CDP screencast 로 받아 세션 폴더에 `video.webm`(VP9, 기본 10fps
`QA_VIDEO_FPS`)을 남긴다. 프레임마다 브라우저의 캡처 시각을 `trace.jsonl` 의 `t` 와 같은 시계(세션 시작 기준 ms)로
적고, 고정 프레임률로 다시 맞춰 굽는다 — 영상 `s` 초 = trace `t = s*1000`. 녹화가 켜지면 trace 행에 `shotT`(저장한
정착 프레임을 실제로 찍은 시각)가 붙고, 영상의 `shotT/1000` 초가 그 샷이다. 인코딩은 브라우저를 닫은 뒤에 하므로
플레이와 CPU 를 다투지 않고, 걸린 시간은 `summary.json` 의 `video.encodeMs` 에 남는다. ffmpeg 는 Playwright 가 받은
것(`~/.cache/ms-playwright/ffmpeg-*/`)이나 시스템 것을 쓴다(`QA_VIDEO_FFMPEG` 로 지정). 끄면 기존 동작과 같다.

### 수정 큐 규칙

QA 로 찾은 결함을 고칠 때는 (a) 게임 데이터 수정과 (b) 엔진·에디터·AI 조수 개선으로 나누고, 둘 다 적용 전에
ultrabrain 동의를 받는다(오너 규칙). `fix-queue.json` 의 `track` 은 첫 분류일 뿐이다 — (b) 는 데이터 결함에도 붙는다.

## VM 준비 (한 번)

- `ssh root@am3685-1`, `export PATH=/opt/node/bin:/opt/bun/bin:$PATH`. 메모리 상한은 cgroup 64 GiB 다(호스트 숫자 250 GB 아님).
- 캐시 미러 `/root/vqa-sinkiru/harness/mirror.mjs`(127.0.0.1:7811)가 떠 있어야 한다. 새 판본은 그 `GAMES` 목록에
  넣고 한 번 채운다. 파이프라인의 `vm/overlay.mjs`(7812)는 캐시에서만 내주고, 없는 파일만 7811 에 묻는다.
- `qa.mjs` 가 매번 코드를 `/root/qa-pipeline/code/pipeline` 으로 보내고 7812 를 띄운다(이미 떠 있으면 그대로).
- deepseek 키는 VM 의 `/root/vqa-sinkiru/oc.json`(`baseUrl`, `apiKey`). 공유 키가 일일 한도에 걸리면 관찰 단계가
  실패로 기록된다 — `--from observe` 로 이어 간다.

## 측정

- `--plant p1` 은 작업표가 실제로 들르는 이벤트·맵에만 결함 7~8종(깨진 글자, 자리표시 대사, 없는 초상, 끝나지 않는
  반복, 맵 밖 이동, 상점 유령 품목, 없는 NPC 그림, 맵 구멍)을 심고 정답을 `*.truth.json` 에 쓴다.
  포착 = 그 위치를 가리키고 그 결함을 설명할 수 있는 점검 항목의 후보가 있음. 검토 후 포착 = 그 후보가 `real`.
- 오독 기각률은 사람이 라벨을 붙인 과거 후보(예: demo-vqa-sinkiru 의 「확정」 29건)를 `review.mjs --candidates` 에 넣어 잰다.

## 왜 이렇게 나눴나 (이전 실행의 실패에서)

- 매 스크린샷 전수 VQA + deepseek 판정자: 확정 29건 중 실제 약 9건. 도트 글꼴 오독 15건, 전환 프레임 4건.
  → DOM 글자를 정답으로 주고, 전환은 정착 프레임과 다음 프레임으로, 최종 판정은 Opus 가.
- 글자 잘림·화면 밖 UI·404·멈춤은 화면을 "보지" 않아도 DOM·네트워크·상태로 확정된다 → 결정적 단계가 먼저.
- 운영 호스트에 96세션을 붙였다가 429 를 냈다 → 미러 전용, 외부 요청은 브라우저에서 차단.
