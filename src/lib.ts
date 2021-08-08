import type {LoadableManifest} from './webpack'

export const getBundles = (
	{
		publicPath: defaultPublicPath,
		originToChunkGroups,
		chunkGroupAssets,
		preloadAssets,
		prefetchAssets,
		runtimeAssets,
		entryToId,
	}: LoadableManifest,
	moduleIds: string[],
	{entries, includeSourceMap, includeHotUpdate, publicPath, preserveEntriesOrder}: {
		publicPath?: string
		entries?: string[]
		includeHotUpdate?: boolean
		includeSourceMap?: boolean
		preserveEntriesOrder?: boolean
	} = {}
) => {
	if (typeof publicPath !== 'string') publicPath = defaultPublicPath || ''
	const assetFilter = (
		file: string
	) => {
		const fileWithoutQuery = file.split('?')[0]
		return (includeHotUpdate || !/\.hot-update\.js$/.test(fileWithoutQuery))
			&& (
				fileWithoutQuery.endsWith('.js')
				|| fileWithoutQuery.endsWith('.css')
				|| (includeSourceMap && fileWithoutQuery.endsWith('.map'))
			)
	}
	if (!entries) entries = ['main']
	for (const entry of entries)
		if (!entryToId[entry]) console.warn(`Cannot find chunk group id for entry ${entry}`)
	entries = entries.map(entry => entryToId[entry])

	const chunkGroups = new Set<string>()
	const assets = new Set<string>()
	const preload = new Set<string>()
	const prefetch = new Set<string>()

	const addChunkGroup = (chunkGroup: string) => {
		if (chunkGroups.has(chunkGroup)) return
		chunkGroups.add(chunkGroup)
		if (!chunkGroupAssets[chunkGroup]) {
			console.warn(`Cannot find chunk group ${chunkGroup}`)
			return
		}
		for (const asset of (chunkGroupAssets[chunkGroup] || []).filter(assetFilter)) assets.add(asset)
		for (const asset of (preloadAssets[chunkGroup] || []).filter(assetFilter)) preload.add(asset)
		for (const asset of (prefetchAssets[chunkGroup] || []).filter(assetFilter)) prefetch.add(asset)
	}

	for (const entry of entries) addChunkGroup(entry)
	for (const moduleId of moduleIds) {
		const includingChunkGroups = originToChunkGroups[moduleId]
		if (!includingChunkGroups) {
			console.warn(`Can not determine chunk group for module id ${moduleId}`)
			continue
		}
		if (includingChunkGroups.some(chunkGroup => chunkGroups.has(chunkGroup)))
			continue
		addChunkGroup(includingChunkGroups[0])
	}
	const getOrder = (asset: string) => {
		if (!asset.endsWith('.js')) return 0
		for (const entry of entries)
			if (runtimeAssets[entry]?.includes(asset)) return -1
		for (const entry of entries)
			if (chunkGroupAssets[entry]?.includes(asset)) return 1
		return 0
	}
	const assetToArray = (assets: Set<string>) => (
		values => preserveEntriesOrder
			? values
			: values.map((asset, index) => [asset, index] as [string, number])
				.sort(
					([as1, index1], [as2, index2]) => getOrder(as1) - getOrder(as2) || index1 - index2
				)
				.map(([asset]) => asset)
	)([...assets.values()])
		.map(file => `${publicPath}${file}`)
	return {
		assets: assetToArray(assets),
		preload: assetToArray(preload),
		prefetch: assetToArray(prefetch),
	}
}
