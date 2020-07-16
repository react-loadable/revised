import express from 'express'
import path from 'path'
import React from 'react'
import ReactDOMServer from 'react-dom/server'
import {Capture, preloadAll} from '~react-loadable/revised'
import {getBundles} from '~react-loadable/revised/webpack'
import App from './components/App'
import fs from 'fs'

const getStats = () => JSON.parse(fs.readFileSync(path.resolve(__dirname, 'dist/react-loadable.json'), 'utf8'))
const app = express()

const Links = ({assets, prefetch}) => {
	const urls = assets.filter(file => file.endsWith('.css')).map(file => `/dist/${file}`)
	return prefetch
		? urls.map((url, index) => <link rel={prefetch} as="style" href={url} key={index}/>)
		: urls.map((url, index) => <link rel="stylesheet" href={url} key={index}/>)
}
const Scripts = ({assets, prefetch}) => {
	const urls = assets.filter(file => file.endsWith('.js')).map(file => `/dist/${file}`)
	return prefetch
		? urls.map((url, index) => <link rel={prefetch} as="script" href={url} key={index}/>)
		: urls.map((url, index) => <script src={url} key={index}/>)
}

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
		</head>
		<body>
		<div id="app" dangerouslySetInnerHTML={{__html: body}}/>
		<Scripts assets={assets}/>
		<script>window.main()</script>
		<Scripts assets={preload} prefetch="preload"/>
		<Scripts assets={prefetch} prefetch="prefetch"/>
		</body>
	</html>
}

app.get('/', (req, res) => {
	const modules = []
	const body = ReactDOMServer.renderToString(
		<Capture report={moduleName => modules.push(moduleName)}>
			<App/>
		</Capture>
	)
	const {assets, preload, prefetch} = getBundles(getStats(), modules)

	res.send(`<!doctype html>
${ReactDOMServer.renderToStaticMarkup(<Html
		assets={assets}
		body={body}
		preload={preload}
		prefetch={prefetch}
	/>)}`)
})

app.use('/dist', express.static(path.join(__dirname, 'dist', 'client')))

preloadAll().then(() => {
	app.listen(3000, () => {
		console.log('Running on http://localhost:3000/')
	})
}).catch(console.error)
