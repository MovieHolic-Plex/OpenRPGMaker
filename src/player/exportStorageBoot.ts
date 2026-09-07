import { migrateLegacyStorageKeys } from "../util/appStorage";
import { resolveCommunitySaveScope } from "./exportSaveNamespace";

// Standalone keeps the historical prefix migration. Community must not scan,
// migrate or delete any other listing's (including legacy) storage on startup.
if (resolveCommunitySaveScope(window.location.pathname) === undefined) migrateLegacyStorageKeys();
