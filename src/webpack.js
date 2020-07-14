import url from 'url'

function buildManifest(compiler, compilation) {
  var manifest = {}
  compilation.chunkGroups.forEach(function (chunkGroup) {
    chunkGroup.chunks.forEach(function (chunk) {
      chunk.files.forEach(function (file) {
        chunkGroup.origins.forEach(function (origin) {
          var publicPath = url.resolve(compilation.outputOptions.publicPath || '', file)
          if (!manifest[origin.request]) manifest[origin.request] = []
          if (!manifest[origin.request].find(function(value){
            return value.file === file
          })) manifest[origin.request].push({file, publicPath})
        })
      })
    })
  })
  return manifest
}


export class ReactLoadablePlugin {
  constructor(opts = {}) {
    this.filename = opts.filename
    this.statsFilename = opts.statsFilename
  }

  apply(compiler) {
  	const emit = (compilation, callback) => {
      const manifest = buildManifest(compiler, compilation)
      var json = JSON.stringify(manifest, null, 2)
      compilation.assets[this.filename] = {
        source() {
          return json
        },
        size() {
          return json.length
        }
      }
      if (this.statsFilename) {
        const stats = JSON.stringify(compilation.getStats().toJson({
          all: 'none',
          chunkGroups: true,
          excludeModules: /\/node_modules\//
        }), null, 2)
        compilation.assets[this.statsFilename] = {
          source() {
            return stats
          },
          size() {
            return stats.length
          }
        }
      }
      if (callback) callback()
    }
    if (compiler.hooks) compiler.hooks.emit.tap('react-loadable', emit)
    else coompile.plugin('emit', emit)
  }
}

export function getBundles(manifest, moduleIds) {
  return moduleIds.reduce((bundles, moduleId) => {
    return bundles.concat(manifest[moduleId])
  }, [])
}

