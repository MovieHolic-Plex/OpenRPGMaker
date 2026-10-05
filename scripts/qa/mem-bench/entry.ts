// 편집기 턴 시작 경로의 캐시 메모리·시간 측정용 진입점(scripts/qa/mem-bench/run.mjs 가 번들해 node --expose-gc 로 돈다).
export { createNewProjectSeed } from "@/editor/genrePacks";
export { cloneProjectSharingSharedDictionaries } from "@/project/projectClone";
export { projectIdentityDigest } from "@/project/authoredProjectBaseline";
export { projectLint, warmRoundtripCheck } from "@/project/lint/projectLint";
export { planHeavyWire, resetHeavyWireForTests, withHeavyBlobs } from "@/ai/piAgent/heavyWire";
export { serializeReusingSharedDictionaries } from "@/project/io/sharedDictionaryJson";
export { sharedEntryDigest, jsonContentDigest } from "@/project/persistence/core/contentDigest";
export { serialize } from "@/project/io";
export { serializeForRoundtripCheck, stringifySharedDictionary, stringifyAssets } from "@/project/io/sharedDictionaryJson";
export { deserialize } from "@/project/io";
