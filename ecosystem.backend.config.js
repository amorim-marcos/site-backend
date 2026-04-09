const heapMb = parseInt(process.env.NODE_MAX_OLD_SPACE_SIZE_MB || '4096', 10);
const pm2MaxMemoryRestart = process.env.PM2_MAX_MEMORY_RESTART || '3800M';
const pm2CronRestart = process.env.PM2_CRON_RESTART || '0 7 * * *'; // 04:00 BRT (UTC-3)

module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: '/home/admin/html/backend',
      script: 'yarn',
      args: 'start',
      interpreter: '/home/admin/.nvm/versions/node/v14.21.3/bin/node',
      node_args: `--max-old-space-size=${heapMb}`,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: pm2MaxMemoryRestart,
      cron_restart: pm2CronRestart,
      kill_timeout: 10000,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};