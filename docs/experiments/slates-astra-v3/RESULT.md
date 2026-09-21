# Slates v3 — 처마맞댄 은실성

**밀도 지침을 필수 조건으로 고쳐 GPT 6 Astra Medium에 다시 저작시켰다.** 50×50, 32px. 최종 건물 40개, 성벽 내부 건축 실루엣 **52.2496%**. 이전 28.46%보다 조밀해졌고, 모든 칸이 통행 가능한 5×5 사각형 위치는 138개에서 0개가 되었다.

## 문서에 바꾼 내용

[밀도 지침](../../../openwiki/slates-dense-town.md): 고정 평가 영역 [3,4,44,42], 건축 알파 50~65%, 비교용 패딩 제거, 작은 공터·정원 제한, 모든 열린 바닥 검사, 17×15 확대 세 곳 제출. 미달을 partial로 완료하지 않는다. [진입 문서](../../../openwiki/slates-agent-entry.md), AGENTS/PROJECT_WIKI/quickstart에도 연결했다. 이전 v2 진입·조립 문서는 v2/frozen-inputs에 보존했다.

## 실행과 수정

- 모델 요청 `gpt-6-astra`, effort `medium`, fork_context false, agent `01a0c11e-a4fb-74a2-bf3b-ff8ee0bf5c95` / Descartes. 도구가 수락한 설정.
- 새 문서와 원본·검토 모듈을 전달했다. 기존 전체 지도/생성기/DB는 저작 입력에서 제외했다. 접근 제한은 프롬프트 수준이다.
- 첫 초안은 52.52%였지만 규칙적인 가로 줄이 강해 반려했다. 굽은 길과 서로 다른 앞선으로 수정했다. 이어 건물 겹침·문 앞 막힘을 반려했다.
- 건물 픽셀 교차 0, 서로 다른 건물 footprint 교차 0, 문 그림 가림 0. 마지막으로 작업장의 반칸 접촉과 동쪽 성벽의 문 테두리 가림을 수정했다.
- 저작 담당이 코드/배치를 작성하는 동안 감독자는 코드 편집을 하지 않았다. 종료 후 감독자가 통합·실제 엔진 검사·저장·보고 페이지를 작성했다. 저장된 map/tileset/asset은 최종 bundle 그대로다.
- 감독자의 시각 피드백과 검토된 모듈 재사용이 있으므로 문서 개정만의 효과를 분리한 통제 실험이 아니다. [정확한 전달 기록](execution.json).

## 독립 확인

감독자가 모듈 원본 사각형을 별도로 합성하여 **52.24957484%**를 재계산했다. 1,892,352px 고정 내부에서 건축 알파 면적 988,745.8745px. 바닥·그림자·성벽·소품·수목은 제외했다. 원본 사각형 연산 9,993개 범위 유효. [독립 검사](supervisor-density-audit.json).

실제 에디터에서 **68/68 접근 목표**, 통행 700칸 연결. 성문 통로 연결, 성문 차단 시 경계 누출 없음. 모든 타일 ID·배열 유효, 페이지 오류 0. [에디터 관측](engine-observation.json).

에디터 3200×3200 렌더를 native 1600×1600과 비교하면 2,560,000픽셀 중 3,236픽셀에 최대 RGB 1/255 차이가 있다. PNGjs 합성과 브라우저 Canvas의 반투명 합성 반올림 차이이며, 1단계를 넘는 차이·배치 이동은 없다. **완전 바이트 일치라고 주장하지 않는다.** [렌더 비교](editor-render-comparison.json).

전용 `player.html`에서 원격 재로드 프로젝트 복사본을 열고 남문 밖 (24,49) → 안쪽 (24,44)로 실제 이동했다. 에디터 play 경로는 사용하지 않았다. 오류 0. [런타임 관측](runtime-observation.json).

## 실제 저장

- Supabase project **rpg-zzu-slates32-38e6**, map **slates_astra_v3_walled_50**.
- 저장 후 root 및 maps/tilesets mirrors 재로드 일치. 총 13 maps / 8 tilesets. SHA `24c4dea267dc50dbfde27b8fc667912fe2148f83d674cf65fd9e2ce3ca3f3af6`.
- 기존 12개 지도와 시작 위치 보존. [통합](integration.json), [원격 재로드](persistence.json).
- 로컬 SQLite project `c8c53479-8d1a-42da-96ee-e493598ef498`, **revision 10**, maps/tilesets/assets/mapTree/startMapId/startPos 재로드 일치. [로컬 근거](local-persistence.json).

## 완성 범위

요청한 밀도 조건과 통행·저장은 충족했다. 구조 모듈의 기존 partial 한계(일부 지붕 텍스처 접합·여관 뒤 능선·얇은 세로 성벽)는 남아 있다. 기본 골목/주거리 폭과 달리 교차점·문 앞에는 국소적으로 더 넓은 여백이 있다. 원본 참고와 같은 건축 다양성이나 완성도를 모두 달성했다고 주장하지 않는다. 실내/NPC/상점 이벤트는 저작하지 않았다.

전체 gates/vitest/typecheck는 실행하지 않았다. 콘텐츠의 형식·원본·렌더·통행·저장만 집중 확인했다. 임시 에디터 화면의 저장 표시는 원격 저장 증거가 아니며, 별도 저장기의 DB 재로드를 근거로 한다.

[그림 비교 페이지](../../../reports/slates-astra-v3/index.html) · [저작 담당 보고](AUTHOR-REPORT.md).

Ivan Voirol, CC BY 4.0. 원본 사각형 선택·분할·합성 및 신규 지도 배치.
