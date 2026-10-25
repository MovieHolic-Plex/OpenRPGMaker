// 조수 도구가 스토어를 읽는 길. 도구는 Pi 워커(Bun)에서 돌아서 편집기 창의 데스크톱 다리(window.oprn.store)가 없다.
// 그래서 편집기가 실행 요청에 스토어 주소를 실어 보내고(PiAgentRequest.store), 워커가 같은 주소로 읽기 전용 클라이언트를 만든다
// (scripts/lib/workerStore.ts — 데스크톱 메인 프로세스와 같은 AssetStoreClient, 로그인 없음). 편집기 창 안에서 도는 경로는 다리를 쓴다.
// 공개 상품 목록·매니페스트·파일만 읽는다. 올리기·숨기기는 이 길이 없다(카드에서 사용자가 누를 때만).
import type { StoreCatalogPage, StoreItemDetail, StorePackManifest } from "./format";

/** 편집기가 실행 요청에 싣는 스토어 정보. */
export interface StoreRunHint {
  /** 지금 편집기가 쓰는 스토어 주소(스토어 창 설정). */
  readonly url: string;
  /** 사용자가 「묻지 않고 바로 넣기」를 켰는가(음악 카드의 확인란, localStorage STORE_AUTO_INSTALL_KEY). */
  readonly autoInstall: boolean;
}

export const STORE_AUTO_INSTALL_KEY = "oprn:store-auto-install";

export interface StoreReadAccess {
  readonly url: string;
  readonly autoInstall: boolean;
  catalog(input: { q?: string; kind?: string; page?: number; lang?: string }): Promise<StoreCatalogPage>;
  item(slug: string): Promise<StoreItemDetail>;
  manifest(slug: string, version: number): Promise<StorePackManifest>;
  /** 해시를 확인한 파일 바이트. */
  blob(sha256: string): Promise<Uint8Array>;
}

let workerAccess: StoreReadAccess | null = null;

/** 워커가 실행마다 부른다(요청에 스토어 정보가 없으면 null 로 지운다). */
export function setWorkerStoreAccess(access: StoreReadAccess | null): void {
  workerAccess = access;
}

export function workerStoreAccess(): StoreReadAccess | null {
  return workerAccess;
}
