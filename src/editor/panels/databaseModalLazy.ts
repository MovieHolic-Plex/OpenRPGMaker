import type { DatabaseTab } from "@/editor/panels/database";

/**
 * The database workspace is a multi-megabyte editor surface. Keep its entry
 * point out of the cold editor graph; opening a database action is an explicit
 * user request, so fetching the chunk at that point is safe.
 */
export function openDatabaseModalLazy(
  initialTab?: DatabaseTab,
  options?: { readonly onClose: () => void },
): void {
  void import("@/editor/panels/databaseModal").then(({ openDatabaseModal }) => {
    openDatabaseModal(initialTab, options);
  });
}
