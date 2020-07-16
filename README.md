# A bug-free and actively maintained version of react-loadable

Check the old readme [here](https://github.com/react-loadable/revised/blob/master/README-old.md).

The new package name: `@react-loadable/revised`.

# Background

There are several bugs in the original `react-loadable` package. The author also discontinued it for a long time ago.

This is a revised and actively maintained version of the original `react-loadable` package.

There are several changes in this package compared to the origin.

- Support newer webpack by loading assets from chunk groups, instead of from chunks.
- Support preload, prefetch assets.
- Filter hot update assets by default. This can be changed by setting the options.
- Simpler stats file format.
- Rewritten in Typescript.
- Converted to ES6 module.

# API changes

Almost APIs are the same as the original `react-loadable`, except the `getBundles` function.
The new API interface is as follows.

1. `getBundles(stats, modules, options)`
 
- return `{assets, preload, prefetch}`.
 Where `assets`, `preload`, `prefetch` are the main assets, preload assets, prefetch assets, respectively.
- `options` is an optional parameter with the following keys.
    * `entries`: `string[]` (default: `['main']`). Name of the entries in webpack.
    * `includeHotUpdate`: `boolean` (default: `false`). Specify whether hot update assets are included. 
    * `includeSourceMap`: `boolean` (default: `false`). Specify whether source maps are included. 
    * `publicPath`: `string` (default: `publicPath` value in the webpack config). Overwrite the `publicPath` config.

2. The `filename` option in the webpack plugin now is relative to the output path regardless of whether the `filename` value is absolute or relative.

Usually the output directory of the bundles for the client build is public.
Therefore, to prevent exposing the build information, it is highly recommended to specify another directory by prefixing this config with `..`.

3. All exported modules are in ES6.

Old:

```javascript
const loadable = require('react-loadable')
//loadable.Map
//loadable.preloadAll
//loadable.preloadReady
```

New:

```javascript
import loadable, {LoadableMap, preloadAll, preloadReady} from '@react-loadable/revised'
```

3. `Map` is renamed to `LoadableMap` to avoid conflicting with the ES6 Map.
