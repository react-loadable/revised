import {Compilation, Compiler, ChunkGroup } from 'webpack'

const isOriginDynamicImported = (origin: {request: string}, chunkGroup: any) => {
	// check if origin is imported via import()
	// for (const chunk of chunkGroup.chunks)
	// 	for (const md of chunk.getModules())
	// 		for (const {type, userRequest} of md.reasons)
	// 			if (userRequest === origin.request && type === 'import()') return true
	// return false
	return !!origin.request
}

export interface LoadableManifest {
	publicPath?: string
	originToChunkGroups: Record<string, string[]>
	chunkGroupAssets: Record<string, string[]>
	preloadAssets: Record<string, string[] | undefined>
	prefetchAssets: Record<string, string[] | undefined>
	runtimeAssets: Record<string, string[] | undefined>
	entryToId: Record<string, string>
}
const getAssetsOfChunkGroups = (chunkGroups?: ChunkGroup[]) => {
	if (!chunkGroups) return
	const assets = new Set<string>()
	for (const chunkGroup of chunkGroups)
		for (const asset of (chunkGroup as any).getFiles())
			assets.add(asset)
	return [...assets.values()]
}
const buildManifest = (compilation: Compilation, includeHotUpdate?: boolean, includeSourceMaps?: boolean) => {
	const entryToId: Record<string, string> = {}
	const runtimeAssets: Record<string, string[]> = {}
	const includedChunkGroups = new Set<string>()
	//always add entries
	for (const chunkGroup of compilation.chunkGroups)
		if (chunkGroup.isInitial()) {
			entryToId[chunkGroup.name] = chunkGroup.id
			includedChunkGroups.add(chunkGroup.id)
			// TODO: correct typing
			// @ts-ignore
			runtimeAssets[chunkGroup.id] = chunkGroup.getRuntimeChunk()?.files
		}

	// get map of origin to chunk groups
	const originToChunkGroups: Record<string, string[]> = {}
	for (const chunkGroup of compilation.chunkGroups)
		for (const origin of chunkGroup.origins)
			if (isOriginDynamicImported(origin, chunkGroup)) {
				includedChunkGroups.add(chunkGroup.id)
				if (!originToChunkGroups[origin.request]) originToChunkGroups[origin.request] = []
				if (!originToChunkGroups[origin.request].includes(chunkGroup.id))
					originToChunkGroups[origin.request].push(chunkGroup.id)
			}

	const chunkGroupAssets: Record<string, string[]> = {}
	const preloadAssets: Record<string, string[]> = {}
	const prefetchAssets: Record<string, string[]> = {}
	const chunkGroupSizes: Record<string, number> = {}
	for (const chunkGroup of compilation.chunkGroups)
		if (includedChunkGroups.has(chunkGroup.id)) {
			//get map of chunk group to assets
			chunkGroupAssets[chunkGroup.id] = chunkGroup.getFiles()

			//get chunk group size
			let size = 0
			for (const chunk of chunkGroup.chunks) size += chunk.size()
			chunkGroupSizes[chunkGroup.id] = size

			// TODO: correct typing
			// @ts-ignore
			//child assets
			const {prefetch, preload} = chunkGroup.getChildrenByOrders()
			preloadAssets[chunkGroup.id] = getAssetsOfChunkGroups(preload)
			prefetchAssets[chunkGroup.id] = getAssetsOfChunkGroups(prefetch)
		}

	//sort for the greedy cover set algorithm
	for (const chunkGroups of Object.values(originToChunkGroups))
		chunkGroups.sort(
			(cg1, cg2) => chunkGroupSizes[cg1] - chunkGroupSizes[cg2]
		)
	return {
		publicPath: compilation.outputOptions.publicPath,
		originToChunkGroups,
		chunkGroupAssets,
		preloadAssets,
		prefetchAssets,
		runtimeAssets,
		entryToId,
	}
}


export class ReactLoadablePlugin {
	constructor(private options: {
		filename: string
		includeHotUpdate?: boolean
		includeSourceMap?: boolean
	}) {}

	apply(compiler: Compiler) {
		const emit = (compilation: Compilation, callback?: () => any) => {
			const manifest = buildManifest(compilation, this.options.includeHotUpdate, this.options.includeSourceMap)
			const json = JSON.stringify(manifest, null, 2)
			compilation.emitAsset(
				this.options.filename,
				// TODO: correct typing
				// @ts-ignore
				{
					source() { return json },
					size() { return json.length }
				}
			)
			/**
			 *
	constructor();
	map(options: MapOptions): Object;
	sourceAndMap(options: MapOptions): { source: string | Buffer; map: Object };
	updateHash(hash: Hash): void;
	buffer(): Buffer;
			 */
			callback?.()
		}
		if (compiler.hooks) compiler.hooks.emit.tap('@react-loadable/revised', emit)
		else (compiler as any).plugin('emit', emit)
	}
}

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
	) => (includeHotUpdate || !/\.hot-update\.js$/.test(file))
		&& (file.endsWith('.js') || file.endsWith('.css') || (includeSourceMap && file.endsWith('.map')))
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
					([as1, index1], [as2, index2]) => {
						const order1 = getOrder(as1)
						const order2 = getOrder(as2)
						if (order1 === order2) return index1 - index2
						return order1 - order2
					}
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
