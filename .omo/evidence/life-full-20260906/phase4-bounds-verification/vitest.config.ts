import base from "../../../../vitest.config";
import { fileURLToPath } from "node:url";
export default { ...base, cacheDir: fileURLToPath(new URL("./cache/vitest", import.meta.url)) };
