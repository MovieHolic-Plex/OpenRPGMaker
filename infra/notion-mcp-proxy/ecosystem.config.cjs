module.exports = {
  apps: [
    {
      name: "notion-mcp-proxy",
      script: "server.mjs",
      cwd: "/home/main/notion-mcp-proxy",
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      time: true,
    },
  ],
};
