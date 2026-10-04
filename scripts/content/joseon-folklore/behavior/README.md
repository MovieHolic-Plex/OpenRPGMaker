# Behavior 전용 저작과 집중 검사

이 폴더의 세션 저작 코드로 4종 행동 데이터와 실제 엔진 행동 검토판을 재생성한다. 명령과 의미는 `content-packs/joseon-folklore/behavior/README.md` 참조.

- `author-pilot.py`: 고정 ids.json을 읽고 data/design을 behavior 폴더에만 쓴다.
- `run-smoke.mjs` + `smoke.mts`: esbuild를 이용해 단일 메모리 프로브를 `/tmp`에 번들·실행·삭제한다. prototype은 읽기만 하고 스토어/호스트/DB 클라이언트를 호출하지 않는다.
- `render-review.py`: 저장된 실제 실행 기록과 기존 원본 PNG를 조합한다. 원본 픽셀 변경이나 새 몬스터 그림 저작은 없다. SHA-256을 provenance에 저장한다.

```bash
python3 scripts/content/joseon-folklore/behavior/author-pilot.py
node scripts/content/joseon-folklore/behavior/run-smoke.mjs
python3 scripts/content/joseon-folklore/behavior/render-review.py
```

첫 Vite-node 시도는 공유 node_modules의 읽기 전용 `.vite-temp`에서 실패했으므로 이 실행기는 공유 캐시에 접근하지 않는다. full gates/vitest/전체 typecheck는 실행하지 않는다. ready 상태는 파일 생성과 직접 이미지 검토 뒤 마지막으로 저장한다.
