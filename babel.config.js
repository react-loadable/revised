module.exports = api => {
	api.cache.never()
	return {
		presets: [
			[
				'@babel/preset-env',
				{
					loose: true
				}
			],
			'@babel/preset-react'
		],
		plugins: [
			'@babel/plugin-proposal-class-properties',
			'@babel/plugin-transform-object-assign'
		]
	}
}
