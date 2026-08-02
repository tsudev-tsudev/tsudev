/**
 * New Relic config skeleton. Set NEW_RELIC_LICENSE_KEY and NEW_RELIC_APP_NAME
 * in environment to enable Node agent. This file is intentionally minimal and
 * safe if New Relic agent is not installed.
 */
exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME || 'tsudev'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY || '',
  logging: {
    level: process.env.NEW_RELIC_LOG_LEVEL || 'info',
  },
};
