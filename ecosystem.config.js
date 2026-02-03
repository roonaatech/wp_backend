module.exports = {
  apps: [
    {
      name: 'workpulse-prod',
      script: 'server-prod.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '100M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
