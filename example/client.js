import React from 'react';
import ReactDOM from 'react-dom';
import Loadable from 'react-loadable';
import App from './components/App';

window.main = () => {
  Loadable.preloadReady().then(() => {
  	console.log('assert begins')
    console.assert(globalThis.exampleLoaded, 'first level component loaded')
		console.assert(globalThis.nestedExampleLoaded, 'nested level component loaded')
		console.log('assert ends')
		ReactDOM.hydrate(<App/>, document.getElementById('app'));
  });
};
