# A bug-free and actively maintained version of react-loadable

Check the old readme [here](https://github.com/react-loadable/revised/blob/master/README-old.md).

The new package name: `@react-loadable/revised`.

# Background

There are several bugs in the original `react-loadable` package. The author abandoned it a long time ago.

This is a revised and actively maintained version of the original `react-loadable` package.

There are several changes in this package compared to the origin.

- Support webpack 4 and webpack 5.
- Support newer webpack's structure by loading assets from chunk groups, instead of from chunks.
- Support preload, prefetch assets.
- Filter hot update assets by default. This can be changed by the options.
- Simpler stats file format.
- Rewritten in Typescript.
- Converted to ES6 module.
- Sort assets in output.

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
    * `publicPath`: `string` (default: `output.publicPath` value in the webpack config). Overwrite the `output.publicPath` config.
    * `preserveEntriesOrder`: `boolean` (default: `false`). If `true` the javascript assets of the entry chunks will nott be moved to the end of the returned arrays.
    
Note: if `preserveEntriesOrder` is set (`true`), to prevent the dynamically imported components (lodable components) being loaded twice, the entry should be executed after everything is loaded.

Check this example, the main logic of the entry is placed in a global function, and executed after all.

```javascript
import {preloadReady} from '@react-loadable/revised'
import React from 'react'

window.main = async () => {
    try {
      await preloadReady()
    } catch (e){
      console.error(e)
    } finally {
      React.hydrate(<App/>, document.getElementById('#root'))
    }
}
```

In the server side:

```javascript
{assets.filter(url => url.endsWith('.css')).map(url => <link rel="stylesheet" href={url} key={url}/>)}
{assets.filter(url => url.endsWith('.js')).map(url => <script src={url} key={url}/>)}
<script>window.main()</script>
```

2. The `filename` option in the webpack plugin now is relative to the output path regardless of whether the `filename` value is absolute or relative.

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

4. (Advanced) The output assets are returned in the following orders unless the `preserveEntriesOrder` option is set.
- Highest order (first elements): javascript assets which belong to at least one of the input entries (specified via the `options` parameter).
- Lower order (last elements): javascript assets which belong to at least one of the input entries, but are not runtime assets.
- All other assets' orders are kept unchnaged.
