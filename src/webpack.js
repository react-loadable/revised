'use strict';
const url = require('url');

function buildManifest(compiler, compilation) {
  // var context = compiler.options.context;
  var manifest = {};
  compilation.chunkGroups.forEach(function (chunkGroup) {
    chunkGroup.chunks.forEach(function (chunk) {
      chunk.files.forEach(function (file) {
        chunkGroup.origins.forEach(function (origin) {
          var publicPath = url.resolve(compilation.outputOptions.publicPath || '', file);
          if (!manifest[origin.request]) manifest[origin.request] = [];
          if (!manifest[origin.request].find(function(value){
            return value.file === file
          })) manifest[origin.request].push({file, publicPath});
        });
      });
    });
  });
  return manifest;
}


class ReactLoadablePlugin {
  constructor(opts = {}) {
    this.filename = opts.filename;
  }

  apply(compiler) {
    compiler.plugin('emit', (compilation, callback) => {
      const manifest = buildManifest(compiler, compilation);
      var json = JSON.stringify(manifest, null, 2);
      compilation.assets[this.filename] = {
        source() {
          return json;
        },
        size() {
          return json.length
        }
      }
      callback();
    });
  }
}

function getBundles(manifest, moduleIds) {
  return moduleIds.reduce((bundles, moduleId) => {
    return bundles.concat(manifest[moduleId]);
  }, []);
}

exports.ReactLoadablePlugin = ReactLoadablePlugin;
exports.getBundles = getBundles;
