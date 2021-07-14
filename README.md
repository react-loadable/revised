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
- Filter hot update assets by default. This can be changed by options.
- Simpler stats file format.
- Rewritten in Typescript.
- Converted to ES6 module.
- Assets aer sorted in output.
- Support short hand definition of loadable component definition.
- Remove `LoadableMap`.

# API changes

Most of APIs are the same as the original `react-loadable`, except the `getBundles` function.
The new API interface are as follows.

1. `getBundles(stats, modules, options)`
 
- returns `{assets, preload, prefetch}`.
 Where `assets`, `preload`, `prefetch` are the main assets, preload assets, prefetch assets, respectively.
- `options` is an optional parameter with the following keys.
    * `entries`: `string[]` (default: `['main']`). Name of the entries in webpack.
    * `includeHotUpdate`: `boolean` (default: `false`). Specify whether hot update assets are included. 
    * `includeSourceMap`: `boolean` (default: `false`). Specify whether source maps are included. 
    * `publicPath`: `string` (default: `output.publicPath` value in the webpack config). Overwrite the `output.publicPath` config.
    * `preserveEntriesOrder`: `boolean` (default: `false`). If `true` the javascript assets of the entry chunks will not be moved to the end of the returned arrays.
    
Note: if `preserveEntriesOrder` is set (`true`), to prevent the dynamically imported components (lodable components) from being loaded twice, the entry should be executed after everything is loaded.

Check this example, the main logic of the entry is placed in a global function, and executed after all.

```javascript
import {preloadReady} from '@react-loadable/revised'
import {hydrate} from 'react-dom'

window.main = async () => {
    await preloadReady()
    hydrate(<App/>, document.getElementById('#root'))
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
import loadable, {preloadAll, preloadReady} from '@react-loadable/revised'
```

3. `LoadableMap` was removed.

4. (Advanced) The output assets are returned in the following orders unless the `preserveEntriesOrder` option is set.
- Highest order (first elements): javascript assets which belong to at least one of the input entries (specified via the `options` parameter).
- Lower order (last elements): javascript assets which belong to at least one of the input entries, but are not runtime assets.
- All other assets' orders are kept unchnaged.

5. Support short-hand definition of loadable component definition.

Old: only support this pattern.

```javascript
import loadable from '@react-loadable/revised'

const LoadableContact = loadable({
  loader: () => import('./pages/Contact'),
  loading: Loading
})
```

New: support the existing pattern and this new pattern.

```javascript
import loadable from '@react-loadable/revised'

const LoadableContact = loadable({
  loader() { return import('./pages/Contact') },
  loading: Loading
})
```

6. Simplify the `Loading` component.

New: the `Loading` component should accept only 2 props:
- `error?: Error`: when error is null, the component is being loaded.
- `retry(): any`

Rational: showing the loading/timed out states after a delay can be done trivially within the Loading component's implementation.
While this hugely reduces burden for maintaining this project.

7. (From version 1.1.0)
- New option to the Webpack plugin:

  - `absPath?: boolean`: convert the imported module name to absolute based on the context of the importer.
  - `moduleNameTransform?: (moduleName: string) => string`: optional transformer to transform the module name.
    If `absPath` is `true`, the absolute path will be passed to this function.
    This becomes useful when you want to make the module name relative.
    For example: convert `/home/my-project/src/Example` to `~/src/Example`.
    
- New option to the Babel plugin:
  
  - `absPath?: boolean`: similar to the webpack plugin, when this option is enabled.
    The `modules: string[]` which is added to the `loader()` calls (used to identify which module to load in SSR) is added by absolute path of the imported module.
  - `shortenPath?: string`: if truthy, the plugin will truncate the module name with `shortenPath`.
  
These options are all optional, if they are not specified, the behavior of the plugin keeps unchanged.
They are added for these purposes:
- Previously, if the imported module have the same literal names. Even if they point to different modules, we can not distinguish them from the plugin's output.
Now, with the `absPath` option, all modules are separated.
- The `shortendPath` option helps to create a consistent webpack output in different environments (e.g.: host machine build versus docker build).
  Currently, it requires a counterpart option specified in the webpack plugin via `moduleNameTransform` (to truncate the root dir prefix).
