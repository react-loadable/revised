import React from 'react'
import ReactDOM from 'react-dom'
import Loadable from 'react-loadable'
import App from './components/App'

window.main = () => {
	Loadable.preloadReady().then(() => {
		console.log('assert begins')
		console.assert(globalThis.exampleLoaded, 'first level component loaded')
		console.assert(globalThis.nestedExampleLoaded, 'nested level component loaded')
		console.assert(globalThis.descendantLoaded, 'descendant component loaded')
		setTimeout(() => {
			import('./components/Sibling') // note: await is avoid by purpose
			setTimeout(() => console.assert(globalThis.siblingLoaded, 'sibling module loaded'))
		}, 1000)
		console.log('assert ends')
		ReactDOM.hydrate(<App/>, document.getElementById('app'))
	})
}
