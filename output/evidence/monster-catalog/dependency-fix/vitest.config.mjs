import base from "../../../../vitest.config.ts";
export default {
  ...base,
  envDir: new URL(".", import.meta.url).pathname,
  cacheDir: `${process.env.TMPDIR}/vite-cache`,
  test: { ...base.test, cache: false },
};
