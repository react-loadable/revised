import path from 'node:path'
import type {Chunk, Compiler, Compilation} from 'webpack'
import webpack from 'webpack'

type ChunkGroup = Parameters<typeof Chunk.prototype.addGroup>[0]
// type Entrypoint = Parameters<typeof ChunkGraph.prototype.connectChunkAndEntryModule>[2]

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
const buildManifest = (
	compilation: Compilation,
	{
		moduleNameTransform,
		absPath,
	}: {
		moduleNameTransform?(moduleName: string): string
		absPath?: boolean
	}
	): LoadableManifest => {
	const entryToId: Record<string, string> = {}
	const runtimeAssets: Record<string, string[]> = {}
	const includedChunkGroups = new Set<string>()
	// always add entries
	for (const chunkGroup of compilation.chunkGroups)
		if (chunkGroup.isInitial()) {
			entryToId[chunkGroup.name] = chunkGroup.id
			includedChunkGroups.add(chunkGroup.id)
			runtimeAssets[chunkGroup.id] = [...(chunkGroup as any).getRuntimeChunk().files.values()]
		}

	// get map of origin to chunk groups
	const originToChunkGroups: Record<string, string[]> = {}
	for (const chunkGroup of compilation.chunkGroups)
		for (const origin of chunkGroup.origins)
			if (isOriginDynamicImported(origin, chunkGroup)) {
				includedChunkGroups.add(chunkGroup.id)

				const absModuleName = absPath && origin.request?.startsWith('./') && origin.module?.context
					? path.resolve(origin.module.context, origin.request)
					: origin.request
				const moduleName = moduleNameTransform ? moduleNameTransform(absModuleName) : absModuleName

				if (!originToChunkGroups[moduleName]) originToChunkGroups[moduleName] = []
				if (!originToChunkGroups[moduleName].includes(chunkGroup.id))
					originToChunkGroups[moduleName].push(chunkGroup.id)
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
		publicPath: compilation.outputOptions.publicPath as string,
		originToChunkGroups,
		chunkGroupAssets,
		preloadAssets,
		prefetchAssets,
		runtimeAssets,
		entryToId,
	}
}

const pluginName = '@react-loadable/revised'
export class ReactLoadablePlugin {
	constructor(private options: {
		callback(manifest: LoadableManifest): any
		moduleNameTransform?(moduleName: string): string
		absPath?: boolean
	}) {}

	apply(compiler: Compiler) {
		const emit = async (compilation: Compilation) => {
			try {
				const manifest = buildManifest(compilation, {
					moduleNameTransform: this.options.moduleNameTransform,
					absPath: this.options.absPath,
				})
				await this.options.callback(manifest)
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
						stage: webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
					},
					() => emit(compilation)
				)
			})
			compiler.hooks.emit.tap(pluginName, emit)
		} else (compiler as any).plugin('emit', emit)
	}
}
