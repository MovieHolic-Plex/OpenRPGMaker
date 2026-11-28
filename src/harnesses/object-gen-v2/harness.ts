import { defineHarness } from "../_core/manifest";

export const OBJECT_GEN_V2_HARNESS = defineHarness({
  id: "object-gen-v2",
  title: "Carbon Medium 1-Pass 3/4 오브젝트 대량 제작 (서브레포)",
  summary:
    "비공개 서브레포 MovieHolic-Plex/object-gen-v2 (모노레포 사본 harness/object-gen-v2/)를 통해 "
    + "Gemini 4 Carbon (thought_level: medium) 순수 1-Pass 병렬 배치로 16px 격자 3/4 픽셀아트 기물·가구·건물·차량을 제작하고, "
    + "잠금 팔레트(fable-city.json pv=0)·이진 알파(av=0)·순흑 0px 기계 검증(verify), 4배율 검수판(sheet), "
    + "oprn-store-pack/1 컴파일(pack) 및 서브레포 양방향 동기화(sync)를 수행한다.",
  scope: {},
  triggers: [
    "새 16px 3/4 픽셀아트 오브젝트·실내 가구·상점/시설 기물·차량을 Carbon Medium(gemini-4-carbon, medium) 1-Pass 배치로 대량 제작하거나 기존 평면 기물을 재작화할 때",
    "제작한 PNG 묶음에 잠금 팔레트(fable-city.json)·이진 알파·#000000 금지 검사를 돌리거나 4배율 검수 시트·oprn-store-pack/1 패키지를 뽑을 때",
    "harness/object-gen-v2/ 와 비공개 원격 저장소 MovieHolic-Plex/object-gen-v2 의 동기화 상태(sync)를 확인·반영할 때",
  ],
  seed: "harness-data/object-gen-v2/seed.json",
  doc: "openwiki/harnesses/object-gen-v2.md",
  stages: [
    { id: "status", title: "현황", summary: "서브레포(harness/object-gen-v2) 팔레트·앵커 레퍼런스·배치 목록·원격 동기화 상태를 출력한다." },
    { id: "init-batch", title: "배치 초기화", summary: "새 배치 폴더(<dir>/pieces, spec.json)를 기본 잠금 팔레트(fable-city.json)와 함께 생성한다." },
    { id: "verify", title: "기계 관문", summary: "1배율 PNG 들의 16px 배수 크기, 잠금 팔레트 위반(pv=0), 이진 알파(av=0), 순흑(#000000) 유무를 검사한다." },
    { id: "sheet", title: "4배율 검수판", summary: "4× 최근접 확대 라벨 검수 시트(qa-sheet-*.png)와 전/후 비교 HTML 갤러리를 생성한다." },
    { id: "pack", title: "스토어 팩 컴파일", summary: "검증 통과한 조각과 spec.json 을 표준 oprn-store-pack/1 폴더(manifest.json + blobs/)로 컴파일한다." },
    { id: "test", title: "자체 시험", summary: "서브레포(harness/object-gen-v2/tests) 파이썬 파이프라인 단위 시험을 실행한다." },
    { id: "sync", title: "서브레포 동기화", summary: "harness/object-gen-v2/ 와 개별 저장소 MovieHolic-Plex/object-gen-v2 의 바이트 동기화(status|export|import)를 실행한다." },
  ],
  entrypoints: { cli: true, editorUi: false, assistantTool: false },
});
