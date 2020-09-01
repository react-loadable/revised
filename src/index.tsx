import React, {ComponentType, createContext, ReactNode} from 'react'

const ALL_INITIALIZERS: Array<() => any> = []
const READY_INITIALIZERS: Array<() => any> = []
const CaptureContext = createContext<((moduleId: string) => any) | undefined>(undefined)
CaptureContext.displayName = 'Capture'

declare const __webpack_modules__: any
export type LoadComponent<ComponentProps> = {
	default: ComponentType<ComponentProps>
}
export type LoaderType<ComponentProps> = () => Promise<LoadComponent<ComponentProps>>
export type LoadableOptions<InputProps, IsSingle extends boolean, ComponentProps> = {
	loading: ComponentType<{
		isLoading: boolean
		pastDelay: boolean
		timedOut: boolean
		error?: Error
		retry: () => any
	}>
	delay?: number
	timeout?: number
	render?: IsSingle extends true
		? ((loaded: LoadComponent<ComponentProps>, props: InputProps) => ReactNode)
		: ((loaded: Record<string, LoadComponent<ComponentProps>>, props: InputProps) => ReactNode)
	loader: IsSingle extends true ? LoaderType<ComponentProps> : Record<string, LoaderType<ComponentProps>>
}

const isWebpackReady = (getModuleIds: () => string[]) => typeof __webpack_modules__ === 'object'
	&& getModuleIds().every(
		moduleId => typeof moduleId !== 'undefined'
			&& typeof __webpack_modules__[moduleId] !== 'undefined'
	)

const load = <ComponentProps,>(loader: LoaderType<ComponentProps>) => {
	const state = {
		loading: true,
		loaded: undefined,
		error: undefined,
	} as {
		promise: Promise<LoadComponent<ComponentProps>>
		loading: boolean
		loaded?: LoadComponent<ComponentProps>
		error?: Error
	}
	state.promise = new Promise(async (resolve, reject) => {
		try {
			const loaded = await loader()
			state.loading = false
			state.loaded = loaded
			resolve(loaded)
		} catch (e){
			state.loading = false
			state.error = e
			reject(e)
		}
	})
	return state
}

const loadMap = <ComponentProps,>(obj: Record<string, LoaderType<ComponentProps>>) => {
	const state = {
		loading: false,
		loaded: {},
		error: undefined
	} as {
		loading: boolean
		loaded: Record<string, LoadComponent<ComponentProps> | undefined>
		error?: Error
		promise: Promise<Array<LoadComponent<ComponentProps>>>
	}
	const promises: Array<Promise<LoadComponent<ComponentProps>>> = []
	try {
		for (const key of Object.keys(obj)) {
			let result = load(obj[key])
			if (!result.loading) {
				state.loaded[key] = result.loaded
				state.error = result.error
			} else state.loading = true
			promises.push(result.promise)
			;(async () => {
				try {
					state.loaded[key] = await result.promise
				} catch (e){
					state.error = e
				}
			})()
		}
	} catch (err) {
		state.error = err
	}
	state.promise = new Promise(async (resolve, reject) => {
		try {
			const res = await Promise.all(promises)
			state.loading = false
			resolve(res)
		} catch (e){
			state.loading = false
			reject(e)
		}
	})
	return state
}

const resolve = <ComponentProps,>(obj: LoadComponent<ComponentProps>): ComponentType<ComponentProps> => (obj as any)?.__esModule ? (obj as any).default : obj
const render = <ComponentProps, >(
	loaded: LoadComponent<ComponentProps>,
	props: ComponentProps
) => React.createElement(resolve(loaded), props)

type LoadedType<ComponentProps, IsSingle> = IsSingle extends true ? (LoadComponent<ComponentProps> | undefined) : Record<string, ComponentProps>
type StateType<ComponentProps, IsSingle> = {
	error?: Error
	pastDelay: boolean
	timedOut: boolean
	loading: boolean
	loaded: LoadedType<ComponentProps, IsSingle>
}
const createLoadableComponent = <InputProps, IsSingle extends boolean, ComponentProps>(
	loadFn: IsSingle extends true ? typeof load : typeof loadMap,
	options: LoadableOptions<InputProps, IsSingle, ComponentProps>
) => {
	if (!options.loading) throw new Error('react-loadable requires a `loading` component')
	const opts = {
		delay: 200,
		render,
		...(options as unknown as LoadableOptions<ComponentProps, IsSingle, InputProps> & {
			webpack: () => string[]
			modules: string[]
		})
	}
	let res!: IsSingle extends true ? ReturnType<typeof load> : ReturnType<typeof loadFn>

	const init = () => {
		if (!res) res = (loadFn as typeof load)(opts.loader as unknown as LoaderType<ComponentProps>) as IsSingle extends true ? ReturnType<typeof load> : ReturnType<typeof loadFn>
		return res.promise
	}
	ALL_INITIALIZERS.push(init)

	if (typeof opts.webpack === 'function')
		READY_INITIALIZERS.push(() => {
			if (isWebpackReady(opts.webpack)) return init()
		})

	class LoadableComponent extends React.Component<{
		props: ComponentProps
		report: ((moduleId: string) => any) | undefined
	}> {
		public static displayName = 'LoadableComponent'
		state: StateType<ComponentProps, IsSingle>
		private _mounted?: boolean
		private _delay!: ReturnType<typeof setTimeout>
		private _timeout!: ReturnType<typeof setTimeout>

		constructor(props: {
			props: ComponentProps
			report: ((moduleId: string) => any) | undefined
		}) {
			super(props)
			init()
			this.state = {
				error: res.error,
				pastDelay: false,
				timedOut: false,
				loading: res!.loading,
				loaded: res!.loaded as any
			}
			this._loadModule()
		}
		public componentDidMount() { this._mounted = true }
		public componentWillUnmount() {
			this._mounted = false
			this._clearTimeouts()
		}
		public render() {
			return this.state.loading || this.state.error
				? <opts.loading
					isLoading={this.state.loading}
					pastDelay={this.state.pastDelay}
					timedOut={this.state.timedOut}
					error={this.state.error}
					retry={this._retry}
				/>
				: this.state.loaded || null
					? opts.render(this.state.loaded as any, this.props.props)
					: null
		}
		private async _retry() {
			super.setState({ error: undefined, loading: true, timedOut: false })
			res = (loadFn as any)(opts.loader)
			await this._loadModule()
		}
		private _setStateWithMountCheck(newState: Partial<StateType<ComponentProps, IsSingle>>) {
			if (!this._mounted) return
			super.setState(newState)
		}
		private async _loadModule() {
			if (
				this.props.report && Array.isArray(opts.modules)
			) for (
				const moduleName of opts.modules
			) this.props.report(moduleName)
			if (!res.loading) return
			if (typeof opts.delay === 'number') {
				if (opts.delay === 0) {
					if (this._mounted) super.setState({ pastDelay: true })
					else this.state.pastDelay = true
				} else {
					this._delay = setTimeout(() => {
						this._setStateWithMountCheck({ pastDelay: true })
					}, opts.delay)
				}
			}
			if (typeof opts.timeout === 'number') {
				this._timeout = setTimeout(() => {
					this._setStateWithMountCheck({ timedOut: true })
				}, opts.timeout)
			}
			try { await res.promise } catch {} finally {
				this._clearTimeouts()
				this._setStateWithMountCheck({
					error: res.error,
					loaded: res.loaded as any,
					loading: res.loading
				})
			}
		}
		private _clearTimeouts() {
			clearTimeout(this._delay)
			clearTimeout(this._timeout)
		}
	}
	const ContextWrapper = (props: ComponentProps) => <CaptureContext.Consumer>
		{report => <LoadableComponent props={props} report={report}/>}
	</CaptureContext.Consumer>
	ContextWrapper.preload = init
	ContextWrapper.displayName = 'CaptureContextWrapper'
	return ContextWrapper
}

export default <InputProps, ComponentProps>(opts: LoadableOptions<InputProps, true, ComponentProps>) => createLoadableComponent(load, opts)
export const LoadableMap = <InputProps, ComponentProps>(opts: LoadableOptions<InputProps, false, ComponentProps>) => {
	if (typeof opts.render !== 'function')
		throw new Error('LoadableMap requires a `render(loaded, props)` function')
	return createLoadableComponent(loadMap, opts)
}

export const Capture = ({children, report}: {
	children: ReactNode
	report: (moduleId: string) => any
}) => <CaptureContext.Provider value={report}>
	{children}
</CaptureContext.Provider>
Capture.displayName = 'Capture'

const flushInitializers = async (initializers: typeof ALL_INITIALIZERS): Promise<void> => {
	const promises = []
	while (initializers.length) promises.push(initializers.pop()!())
	await Promise.all(promises)
	if (initializers.length) return flushInitializers(initializers)
}
export const preloadAll = () => flushInitializers(ALL_INITIALIZERS)
export const preloadReady = () => flushInitializers(READY_INITIALIZERS)
