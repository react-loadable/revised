import React from 'react';
import ReactDOM from 'react-dom';
import Loadable from 'react-loadable';
import App from './components/App';
import {getSplitValue} from './components/Example'

window.main = () => {
  Loadable.preloadReady().then(() => {
  	console.log('assert begins')
    console.assert(globalThis.exampleLoaded, 'first level component loaded')
		console.assert(globalThis.nestedExampleLoaded, 'nested level component loaded')
		console.log('assert ends')
		console.log('split value = ', getSplitValue())
		ReactDOM.hydrate(<App/>, document.getElementById('app'));
  });
};
