import React from 'react'
import loadable from '~react-loadable/revised'
import Loading from './Loading'

const LoadableNested = loadable({
	loader: () => import(/*
		webpackChunkName: 'example-nested'
	*/'./ExampleNested'),
	loading: Loading,
})

globalThis.exampleLoaded = true
export default function Example() {
	return (
		<div>
			<h1>Hello from a loadable component</h1>
			<LoadableNested/>
		</div>
	)
}
