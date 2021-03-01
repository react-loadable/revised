import webpack, {Chunk, ChunkGraph, Compilation, Compiler} from 'webpack'

type ChunkGroup = Parameters<typeof Chunk.prototype.addGroup>[0]
type Entrypoint = Parameters<typeof ChunkGraph.prototype.connectChunkAndEntryModule>[2]

const isOriginDynamicImported = (origin: {request: string}, _chunkGroup: ChunkGroup) => {
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
const buildManifest = (compilation: Compilation, _includeHotUpdate?: boolean, _includeSourceMaps?: boolean) => {
	const entryToId: Record<string, string> = {}
	const runtimeAssets: Record<string, string[]> = {}
	const includedChunkGroups = new Set<string>()
	// always add entries
	for (const chunkGroup of compilation.chunkGroups)
		if (chunkGroup.isInitial()) {
			entryToId[chunkGroup.name] = chunkGroup.id
			includedChunkGroups.add(chunkGroup.id)
			runtimeAssets[chunkGroup.id] = [...(chunkGroup as Entrypoint).getRuntimeChunk().files.values()]
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
			for (const chunk of chunkGroup.chunks) size += compilation.chunkGraph
				? compilation.chunkGraph.getChunkSize(chunk)
				: chunk.size()
			chunkGroupSizes[chunkGroup.id] = size

			//child assets
			const {prefetch, preload} = chunkGroup.getChildrenByOrders(compilation.moduleGraph, compilation.chunkGraph)
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

const pluginName = '@react-loadable/revised'
// https://github.com/webpack/webpack/issues/11425#issuecomment-686607633
const {RawSource} = webpack.sources || require('webpack-sources')
export class ReactLoadablePlugin {
	constructor(private options: {
		filename: string
		includeHotUpdate?: boolean
		includeSourceMap?: boolean
	}) {}

	apply(compiler: Compiler) {
		const emit = (compilation: Compilation) => {
			try {
				const manifest = buildManifest(compilation, this.options.includeHotUpdate, this.options.includeSourceMap)
				const json = JSON.stringify(manifest, null, 2)
				const source = new RawSource(json)
				const assetName = this.options.filename
				if (compilation.getAsset(assetName)) compilation.updateAsset(assetName, source)
				else compilation.emitAsset(assetName, source)
			} catch (e) {
				compilation.errors.push(e)
			}
		}
		if (compiler.hooks) {
			if (
				webpack.version.slice(0, 2) === '4.'
			) compiler.hooks.emit.tap(pluginName, emit)
			// hooks.thisCompilation is recommended over hooks.compilation
			// https://github.com/webpack/webpack/issues/11425#issuecomment-690547848
			else compiler.hooks.thisCompilation.tap(pluginName, compilation => {
				compilation.hooks.processAssets.tap(
					{
						name: pluginName,
						stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
					},
					() => emit(compilation)
				)
			})
			compiler.hooks.emit.tap(pluginName, emit)
		} else (compiler as any).plugin('emit', emit)
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
