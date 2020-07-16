import React from 'react'

globalThis.descendantLoaded = true
export default () => <h3>I am a descendant</h3>
export const getSibling = () => import(
	/*
	 webpackChunkName: 'sibling',
	 webpackPreload: true
	 */ './Sibling'
	//try remove the webpackPreload comment, the assertion will fail
	)
