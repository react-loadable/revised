import React from 'react'
import Loadable from 'react-loadable'
import Loading from './Loading'

const LoadableNested = Loadable({
  loader: () => import(/* webpackChunkName: 'example-nested' */'./ExampleNested'),
  loading: Loading,
});

globalThis.exampleLoaded = true
export default function Example() {
  return (
    <div>
      <h1>Hello from a loadable component</h1>
      <LoadableNested/>
    </div>
  );
}
