module.exports = {
  apps: [
    {
      name: "exchange-status-api",
      cwd: "./apps/api",
      script: "dist/index.js",
      env: {
        NODE_ENV: "production",
        API_PORT: "4000"
      }
    }
  ]
};
