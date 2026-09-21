# Slates v3 — 촘촘한 마을 재저작

새 에이전트는 `openwiki/slates-agent-entry.md` → `openwiki/slates-dense-town.md`를 읽는다. 그림·모듈 원본 연산도 함께 열어야 한다.

GPT 6 Astra medium, fork_context false. 기존 검토 모듈을 문서화된 입력으로 재사용하며, 기존 전체 지도나 생성기는 허용하지 않았다. 공유 파일시스템의 접근을 기술적으로 차단한 실험은 아니다. 감독자의 중간 시각 피드백이 있다.

- 입력: `input-manifest.json`, 요청·피드백: `execution.json`.
- 산출: `layout.json`, `metrics.json`, `AUTHOR-REPORT.md`.
- 결과·저장: `RESULT.md`, `persistence.json`, `local-persistence.json`.
- 재생성: `node scripts/content/build-slates-astra-v3.mjs`.
- 독립 내용 검사: `python3 scripts/content/audit-slates-astra-v3.py`.
- 원본 출처: Ivan Voirol, CC BY 4.0.
