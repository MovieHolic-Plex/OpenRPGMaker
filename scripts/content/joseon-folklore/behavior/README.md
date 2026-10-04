# Full behavior 재생성

author-full.py는 고정ID와 **타 역할 실제 source**를 읽어 15종 행동표/설계/읽기 전용 입력 사본을 behavior에 쓴다. skills 효과를 생성하지 않는다. source가 없으면 missingIds를 기록하고 스모크는 ready 합격을 거부한다.

```bash
python3 scripts/content/joseon-folklore/behavior/author-full.py
node scripts/content/joseon-folklore/behavior/run-smoke.mjs
python3 scripts/content/joseon-folklore/behavior/render-review.py
```

run-smoke.mjs는 실제 엔진을 esbuild로 /tmp에 단일 번들·실행·삭제한다. 공유 node_modules 캐시에 쓰지 않는다. smoke.mts는 입력 사본의 source 해시를 대조하고 strict/gauge 조건 선택/기력비용/대상/예고/HP구간과 원본 능력치 호환을 검사한다. live DB/스토어/호스트 API는 호출하지 않는다. 실제 적MP0 네 종은 양성 검사 MP와 원본MP 실행을 구분한다. 완성 후 검토 PNG를 열고 status를 마지막에 기록한다.

코드/그림 출처·한계·인계 계약은 content-packs/joseon-folklore/behavior/README.md. full gates/vitest/전체typecheck 금지.
