const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const blocked = [
  /\.local[\\/].*/,
  /\.git[\\/].*/,
];

config.resolver.blockList = config.resolver.blockList
  ? [].concat(config.resolver.blockList, blocked)
  : blocked;

module.exports = config;
