import React from 'react'
import loadable from '@react-loadable/revised'
import Loading from './Loading'

const LoadableExample = loadable({
	loader() {
		return import(/* webpackChunkName: 'example' */'./Example')
	},
	loading: Loading,
})

loadable({
	loader() {
		return import('react') // to test context console.log
	},
	loading: Loading
})

export default function App() {
	return <>
		<p><strong>Check the console for more log.</strong></p>
		<p><strong>Also, try disable javascript and reload the page.</strong></p>
		<LoadableExample/>
	</>
}
