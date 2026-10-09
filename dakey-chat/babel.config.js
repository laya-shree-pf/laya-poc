// Babel config for the Expo app.
module.exports = function (api) {
  api.cache(true);
  return {
    // zustand's ESM build reads import.meta.env, which Metro's web bundle can't run as a classic script.
    presets: [['babel-preset-expo', {unstable_transformImportMeta: true}]],
  };
};
