import React from 'react'
import ReactDOM from 'react-dom'
import {preloadReady} from '~react-loadable/revised'
import App from './components/App'

preloadReady().then(() => {
	console.log('assert begins')
	console.assert(globalThis.exampleLoaded, 'first level component loaded')
	console.assert(globalThis.nestedExampleLoaded, 'nested level component loaded')
	console.assert(globalThis.descendantLoaded, 'descendant component loaded')
	setTimeout(() => {
		import('./components/Sibling') // note: await is avoid by purpose
		setTimeout(() => {
			console.assert(globalThis.siblingLoaded, 'sibling module loaded')
			console.log('assert ends')
		})
	}, 1000)
	ReactDOM.hydrate(<App/>, document.getElementById('app'))
})
