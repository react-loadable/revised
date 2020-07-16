# A bug-free and actively maintained version of react-loadable

Check the old readme [here](/README-old.md).

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

# API changes

Almost APIs are the same as the original `react-loadable`, except the `getBundles` function.
The new API interface is as follows.

`getBundles(stats, modules, options)`
 
- return `{assets, preload, prefetch}`.
 Where `assets`, `preload`, `prefetch` are the main assets, preload assets, prefetch assets, respectively.
- `options` is an optional parameter with the following keys.
    * `entries`: `string[]` (default: `['main']`). Name of the entries in webpack.
    * `includeHotUpdate`: `boolean` (default: `false`). Specify whether hot update assets are included. 
    * `includeSourceMap`: `boolean` (default: `false`). Specify whether source maps are included. 
