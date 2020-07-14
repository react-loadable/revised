import express from 'express'
import path from 'path'
import React from 'react'
import ReactDOMServer from 'react-dom/server'
import Loadable from 'react-loadable'
import {getBundles} from 'react-loadable-webpack'
import App from './components/App'
import fs from 'fs'

const getStats = () => JSON.parse(fs.readFileSync(path.resolve(__dirname, 'dist/server/react-loadable.json'), 'utf8'));
const app = express();

const mainJsPublicPath = '/dist/main.js'
const Html = ({styles, scripts, body}) => {
  return <html lang="en">
    <head>
      <meta charSet="UTF-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <meta httpEquiv="X-UA-Compatible" content="ie=edge"/>
      <title>My App</title>
      {
        styles.map((style, index) => {
          return <link href={`/dist/${style.file}`} rel="stylesheet" key={index}/>;
        })
      }
    </head>
    <body>
    <div id="app" dangerouslySetInnerHTML={{__html: body}}/>
    <script src={mainJsPublicPath}/>
    {
      scripts.map((script, index) => {
        return <script src={script.publicPath} key={index}/>
      })
    }
    <script>window.main();</script>
    </body>
  </html>
}

app.get('/', (req, res) => {
  let modules = [];
  let body = ReactDOMServer.renderToString(
    <Loadable.Capture report={moduleName => modules.push(moduleName)}>
      <App/>
    </Loadable.Capture>
  );
  let bundles = getBundles(getStats(), modules);

  let styles = bundles.filter(bundle => bundle.file.endsWith('.css'));
  let scripts = bundles
    .filter(bundle => bundle.file.endsWith('.js'))
    .filter(
      (bundle, index, arr) => bundle.publicPath !== mainJsPublicPath
      && !arr.slice(0, index).find(({file}) => file === bundle.file)
    );

  res.send(`<!doctype html>
${ReactDOMServer.renderToStaticMarkup(<Html styles={styles} scripts={scripts} body={body}/>)}`)
});

app.use('/dist', express.static(path.join(__dirname, 'dist', 'client')));

Loadable.preloadAll().then(() => {
  app.listen(3000, () => {
    console.log('Running on http://localhost:3000/');
  });
}).catch(err => {
  console.log(err);
});
