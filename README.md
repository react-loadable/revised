# A bug-free and actively maintained version of react-loadable

Check the old readme [here](https://github.com/react-loadable/revised/blob/master/README-old.md).

The new package name: `@react-loadable/revised`.

# Background

There are several bugs in the original `react-loadable` package. The author abandoned it a long time ago. This is a
revised and actively maintained version of the original `react-loadable` package.

# How

The library exports the following APIs:

```javascript
import babelPlugin from '@react-loadable/revised/babel' // the babel plugin
import {ReactLoadablePlugin} from '@react-loadable/revised/webpack' // the webpack plugin
import loadable from '@react-loadable/revised' // the main component to wrap your component
import {preloadReady} from '@react-loadable/revised' // to load the pre-loaded components, used in client
import {preloadAll} from '@react-loadable/revised' // to load all, used in server
import {getBundles} from '@react-loadable/revised/lib' // determine which bundles are required
import {Capture} from '@react-loadable/revised' // the wrapper context, used in server, to capture the pre-loaded components
```

## Babel config

Include `'@react-loadable/revised/babel'` in your babel plugin list. This is required for both client and server builds.

The babel plugin finds all calls to `loadable({loader() {}, ...})`. It scans for all `import()` call in the `loader`
body, and inject the module identifiers for later uses.

Before:

```javascript
loadable({
	loader() {
		return import('./ExampleNested')
	},
	loading: Loading,
})
```

After:

```javascript
loadable({
	loader() {
		return import('./ExampleNested')
	},
	modules: ['./ExampleNested'],
	webpack: function webpack() {
		return ['./example/components/ExampleNested.js'] // or exactly require.resolveWeak('./ExampleNested')
	},
	loading: Loading,
})
```

## Webpack config

Webpack plugin is required **only** in your client build. Include the webpack plugin in the webpack plugin list.

[See example](https://github.com/react-loadable/revised/blob/93f97770cc2825ae7cd6c443ab59641ee1b5a146/webpack.config.js#L47)

```javascript
new ReactLoadablePlugin({
	async callback(manifest) {
		// save the manifest somewhere to be read by the server
		await writeFile(path.join(__dirname, 'example', 'dist/manifest.json'), JSON.stringify(manifest, null, 2))
	},
	absPath: true,
})
```

## In react code

Wrap your split component with `loadable({loader() {}, ...})` to get the `loadable` component.
[For example](https://github.com/react-loadable/revised/blob/1add49804cc246dd91f9600f0ad5bc49a276b791/example/components/Example.js#L5):

```javascript
const LoadableNested = loadable({
	loader() {
		return import('./ExampleNested')
	},
	loading: Loading
})
```

**Note**: you must call `loadable({...})` at the top-level of the module. Otherwise, make sure to call them all before
calling `preloadAll()` or `preloadReady()`.

## In server side

- Call and await for `preloadAll()` once in the server side to pre-load all the components. For
	example: [when the server starts serving](https://github.com/react-loadable/revised/blob/fbccbfed39a1e8dbf799e69311c7366c78649b01/example/server.js#L66)
	.

- Load the exported manifest.json file.

```javascript
// in production, this should be cached in the memory to reduce IO calls.
const getStats = () => JSON.parse(fs.readFileSync(path.resolve(__dirname, 'dist/react-loadable.json'), 'utf8'))
 ```

- Wrap the rendered component with `Capture` to capture the pre-loaded components.

[See example](https://github.com/react-loadable/revised/blob/fbccbfed39a1e8dbf799e69311c7366c78649b01/example/server.js#L49)

```javascript
const modules = [] // one list for one request, don't share
const body = ReactDOMServer.renderToString(
	<Capture report={moduleName => modules.push(moduleName)}>
		<App/>
	</Capture>
)
```

- After rendering the component, use `getBundles()` to determine which bundles are required.

```javascript
const {assets, preload, prefetch} = getBundles(getStats(), modules)
 ```

- Injected the required bundles and the rendered `body` to the html document and returns to the client.

```javascript
const Html = ({assets, body, preload, prefetch}) => {
	return <html lang="en">
		<head>
			<meta charSet="UTF-8"/>
			<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
			<meta httpEquiv="X-UA-Compatible" content="ie=edge"/>
			<title>My App</title>
			<Links assets={assets}/>
			<Links assets={preload} prefetch="preload"/>
			<Links assets={prefetch} prefetch="prefetch"/>
			<Scripts assets={preload} prefetch="preload"/>
			<Scripts assets={prefetch} prefetch="prefetch"/>
		</head>
		<body>
			<div id="app" dangerouslySetInnerHTML={{__html: body}}/>
			<Scripts assets={assets}/>
		</body>
	</html>
}

res.send(`<!doctype html>
// note: NOT renderToString()
${ReactDOMServer.renderToStaticMarkup(<Html
	assets={assets}
	body={body}
	preload={preload}
	prefetch={prefetch}
/>)}`)
```

## In client side

- Call and await for `preloadReady()` before hydration.
	[Example](https://github.com/react-loadable/revised/blob/1add49804cc246dd91f9600f0ad5bc49a276b791/example/client.js#L6)

# API

## Babel plugin

- Default import from `@react-loadable/revised/babel`
- Option: `{ shortenPath?: string, absPath?: boolean}`

For example: the project root dir is '/home/my-project'. In `example/Example.js`, there
is `import(./nested/ExampleNested)`.

- `{absPath: false}`: `shortenPath` option is ignored. Module identifier is `'./nested/ExampleNested''`.

Note: the server will not be able to distinguish if two modules have the same relative import path. It will load both of
them.

- `{absPath: true, shortenPath: undefined}`: Module identifier is `'/home/my-project/example/nested/ExampleNested''`.

Note: this will make your build less portable because the module identifier will be different in different environments.

- `{absPath: true, shortenPath: ''}`: Module identifier is `'/example/nested/ExampleNested''`.
- `{absPath: true, shortenPath: '~'}`: Module identifier is `'~/example/nested/ExampleNested''`.

Note: this requires the accompanied from the webpack plugin configuration.

## Webpack plugin

The webpack plugin `ReactLoadablePlugin` has the following options:

```typescript
class ReactLoadablePlugin {
	constructor(options: {
		callback(manifest: LoadableManifest): any
		moduleNameTransform?(moduleName: string): string
		absPath?: boolean
	})
}
```

- `absPath`: should be true if `absPath` is true in the babel plugin option.
- `moduleNameTransform?(moduleName: string): string`: take the module name (absolute path if `absPath` is true) and
	return the transformed path. If `shortenPath` is `'~'` in the babel plugin option. Use the following implementation:

```javascript
{
	moduleNameTransform(moduleName)
	{
		return moduleName?.startsWith(rootDir)
			? `~${moduleName.slice(rootDir.length)}`
			: moduleName
	}
}
```

- `callback(manifest: LoadableManifest): any`: this callback should store the manifest somewhere for the server to use.

## `loadable({loader(): Promise<Component<{}>>, loading: Component<{error?: Error, retry(): any}>})`

New: the `Loading` component should accept only 2 props:

- `error?: Error`: when error is null, the component is being loaded. Otherwise, there is an error. If the data is
	ready, this component will not be rendered.
- `retry(): any`: to retry if there is an error.

## Other APIs

I recommend use the default option as mentioned in the How section.

- `getBundles(stats, modules, options)`
	- returns `{assets, preload, prefetch}`. Where `assets`, `preload`, `prefetch` are the main assets, preload assets,
		prefetch assets, respectively.
	- `options` is an optional parameter with the following keys.
		* `entries`: `string[]` (default: `['main']`). Name of the entries in webpack.
		* `includeHotUpdate`: `boolean` (default: `false`). Specify whether hot update assets are included.
		* `includeSourceMap`: `boolean` (default: `false`). Specify whether source maps are included.
		* `publicPath`: `string` (default: `output.publicPath` value in the webpack config). Overwrite
			the `output.publicPath` config.
		* `preserveEntriesOrder`: `boolean` (default: `false`). If `true` the javascript assets of the entry chunks will not
			be moved to the end of the returned arrays.

Note: if `preserveEntriesOrder` is set (`true`), to prevent the dynamically imported components (lodable components)
from being loaded twice, the entry should be executed after everything is loaded.

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
{
	assets.filter(url => url.endsWith('.css')).map(url => <link rel="stylesheet" href={url} key={url}/>)
}
{
	assets.filter(url => url.endsWith('.js')).map(url => <script src={url} key={url}/>)
}
<script>window.main()</script>
```

The output assets are returned in the following orders unless the `preserveEntriesOrder` option is set.

- Highest order (first elements): javascript assets which belong to at least one of the input entries (specified via
	the `options` parameter).
- Lower order (last elements): javascript assets which belong to at least one of the input entries, but are not runtime
	assets.
- All other assets' orders are kept unchnaged.

# Improved features from the original `react-loadable`

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
- And many more...

