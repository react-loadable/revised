import React from 'react'
import Loadable from 'react-loadable'
import Loading from './Loading'

const LoadableExample = Loadable({
	loader: () => import(/* webpackChunkName: 'example' */'./Example'),
	loading: Loading,
})

export default function App() {
	return <>
		<p><strong>Check the console for more log</strong></p>
		<LoadableExample/>
	</>
}
