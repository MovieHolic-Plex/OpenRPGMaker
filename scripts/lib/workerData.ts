// 데스크톱 조수 워커가 실행 파일 밖에 둔 큰 JSON 을 읽는다. scripts/build-ai-worker.ts 가 그런 JSON 의 import 를 이 함수 호출로 바꾼다.
// 소스로 띄우는 워커(bun scripts/oh-my-pi-worker.ts)는 JSON 을 그대로 import 하므로 이 파일을 쓰지 않는다.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const WORKER_DATA_DIR_ENV = "OPRN_WORKER_DATA_DIR";

/** 워커 실행 파일 옆 worker-data. 설치 폴더·portable 임시 폴더·AppImage 마운트 어디서든 실행 파일과 같이 움직인다. */
export function workerDataDir(): string {
  return process.env[WORKER_DATA_DIR_ENV] || join(dirname(process.execPath), "worker-data");
}

export function readWorkerJson(relativePath: string): unknown {
  const file = join(workerDataDir(), ...relativePath.split("/"));
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    const reason = (error as NodeJS.ErrnoException).code === "ENOENT" ? "파일이 없습니다" : (error as Error).message;
    // 모듈을 읽는 중이라 던지면 bun 이 소스 조각과 스택을 길게 찍어, 호스트가 보여 주는 끝 800자에서 이 문장이 밀려난다. 한 줄 남기고 끝낸다.
    console.error(`조수 워커 자료를 읽지 못했습니다(${reason}): ${file}. 앱 설치가 깨졌을 수 있습니다. 앱을 다시 설치하거나 업데이트하세요. 자료 폴더는 워커 실행 파일 옆 worker-data 이고 ${WORKER_DATA_DIR_ENV} 로 바꿀 수 있습니다.`);
    process.exit(78);
  }
}
