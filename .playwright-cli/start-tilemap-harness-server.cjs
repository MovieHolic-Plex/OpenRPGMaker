const { spawn } = require("node:child_process");
const child = spawn(process.execPath, [
  "node_modules/vite/bin/vite.js",
  "--configLoader", "runner",
  "--host", "127.0.0.1",
  "--strictPort",
  "--port", "9805",
], {
  cwd: "C:\\Users\\USER\\Downloads\\rpg-zzu-tilemap-harness-overhaul",
  detached: true,
  stdio: "ignore",
});
child.unref();
console.log(child.pid);
