module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: '/home/admin/html/backend',
      script: 'yarn',
      args: 'start',
      interpreter: '/home/admin/.nvm/versions/node/v14.21.3/bin/node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};