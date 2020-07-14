const path = require('path');
const { ReactLoadablePlugin } = require('./webpack');
const nodeExternals = require('webpack-node-externals')

const client = {
  entry: {
    main: './example/client',
  },
  output: {
    path: path.join(__dirname, 'example', 'dist', 'client'),
    filename: '[name].js',
    chunkFilename: '[name].js',
    publicPath: '/dist/'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            babelrc: false,
            presets: [
              ['@babel/preset-env', { modules: false }],
              '@babel/preset-react',
            ],
            plugins: [
              'syntax-dynamic-import',
              '@babel/plugin-proposal-class-properties',
              '@babel/plugin-transform-object-assign',
              require.resolve('./lib/babel'),
            ],
          }
        },
      },
    ],
  },
  devtool: 'source-map',
  resolve: {
    alias: {
      'react-loadable': path.resolve(__dirname, 'src'),
    },
  },
};
const server = {
  entry: {
    main: './example/server',
  },
	target: 'node',
  externals: [nodeExternals()],
  node: {__dirname: true},
  output: {
    path: path.join(__dirname, 'example', 'dist/server'),
    filename: '[name].js',
    chunkFilename: '[name].js',
    publicPath: '/dist/'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            babelrc: false,
            presets: [
              ['@babel/preset-env', { modules: false }],
              '@babel/preset-react',
            ],
            plugins: [
              'syntax-dynamic-import',
              '@babel/plugin-proposal-class-properties',
              '@babel/plugin-transform-object-assign',
              require.resolve('./lib/babel'),
            ],
          }
        },
      },
    ],
  },
  devtool: 'inline-source-map',
  resolve: {
    alias: {
      'react-loadable': path.resolve(__dirname, 'src'),
      'react-loadable-webpack': path.resolve(__dirname, 'src/webpack'),
    },
  },
  plugins: [
    new ReactLoadablePlugin({
      filename: 'react-loadable.json'
    }),
  ]
};
module.exports = [client, server]
