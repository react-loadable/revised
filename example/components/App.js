import React from 'react'
import Loadable from 'react-loadable'
import Loading from './Loading'
import {childValue} from './child/Child'

const LoadableExample = Loadable({
  loader: () => import(/* webpackChunkName: 'example' */'./Example'),
  loading: Loading,
});

console.log(childValue)
export default function App() {
  return <>
		<p><strong>Check the console for more log</strong></p>
    <LoadableExample/>
  </>
}
