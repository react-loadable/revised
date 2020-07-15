import path from 'path'
import {ReactLoadablePlugin} from './webpack'
import nodeExternals from 'webpack-node-externals'

const client = {
	entry: {
		main: './example/client.tsx',
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
				test: /\.(ts|js|tsx|jsx)$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						babelrc: false,
						presets: [
							['@babel/preset-env', { modules: false }],
							'@babel/preset-react',
							'@babel/preset-typescript',
						],
						plugins: [
							'syntax-dynamic-import',
							'@babel/plugin-proposal-class-properties',
							'@babel/plugin-transform-object-assign',
							require.resolve('./babel'),
						],
					}
				},
			},
		],
	},
	devtool: 'source-map',
	resolve: {
		extensions: ['.js', '.jsx', '.ts', '.tsx'],
		alias: {
			'react-loadable': path.resolve(__dirname, 'lib'),
		},
	},
	plugins: [
		new ReactLoadablePlugin({
			filename: 'react-loadable.json',
		}),
	],
	optimization: {
		runtimeChunk: 'single',
		splitChunks: { // force all chunk split
			chunks: 'all',
			cacheGroups: {
				vendors: {
					test: /\/node_modules\//
				},
			}
		}
	}
}
const server = {
	entry: {
		main: './example/server.tsx',
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
				test: /\.(js|ts|tsx|jsx)$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						babelrc: false,
						presets: [
							['@babel/preset-env', { modules: false }],
							'@babel/preset-react',
							'@babel/preset-typescript',
						],
						plugins: [
							'syntax-dynamic-import',
							'@babel/plugin-proposal-class-properties',
							'@babel/plugin-transform-object-assign',
							require.resolve('./babel'),
						],
					}
				},
			},
		],
	},
	devtool: 'inline-source-map',
	resolve: {
		extensions: ['.js', '.jsx', '.ts', '.tsx'],
		alias: {
			'react-loadable': path.resolve(__dirname, 'lib'),
			'react-loadable/webpack': path.resolve(__dirname, 'webpack'),
		},
	},
}
export default [client, server]
