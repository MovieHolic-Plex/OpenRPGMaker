import { getGame, getPool } from "./db";
import { createReleaseLoader } from "./releaseStore";
import { createReleaseDownloadHandler, createReleasePlayHandler } from "./releaseRoutes";

const loadRelease = createReleaseLoader(getPool());
export const handleReleasePlay = createReleasePlayHandler({ loadListing: getGame, loadRelease });
export const handleReleaseDownload = createReleaseDownloadHandler({ loadRelease });
