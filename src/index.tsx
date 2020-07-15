import React, {ComponentType, createContext, ReactNode, StrictMode} from 'react'

const ALL_INITIALIZERS: Array<() => any> = []
const READY_INITIALIZERS: Array<() => any> = []
const CaptureContext = createContext<((moduleId: string) => any) | undefined>(undefined)

declare const __webpack_modules__: any
export type LoadComponent<T> = {
	default: ComponentType<T>
	__esModule: true
} | (ComponentType<T> & {__esModule: undefined})
export type LoaderType<T> = () => Promise<LoadComponent<T>>
export type LoadableOptions<T, V extends boolean> = {
	loading: ComponentType<{
		isLoading: boolean
		pastDelay: boolean
		timedOut: boolean
		error: Error | null
		retry: () => any
	}>
	delay?: number
	timeout?: number
	render?: typeof render
	loader: V extends true ? LoaderType<T> : Record<string, LoaderType<T>>
}

const isWebpackReady = (getModuleIds: () => string[]) => typeof __webpack_modules__ === 'object'
	&& getModuleIds().every(
		moduleId => typeof moduleId !== 'undefined'
			&& typeof __webpack_modules__[moduleId] !== 'undefined'
	)

const load = <T,>(loader: LoaderType<T>) => {
	const state = {
		loading: true,
		loaded: null,
		error: null,
	} as {
		promise: Promise<LoadComponent<T>>
		loading: boolean
		loaded: LoadComponent<T> | null
		error: Error | null
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

const loadMap = <T,>(obj: Record<string, LoaderType<T>>) => {
	const state = {
		loading: false,
		loaded: {},
		error: null
	} as {
		loading: boolean
		loaded: Record<string, LoadComponent<T> | null>
		error: Error | null
		promise: Promise<Array<LoadComponent<T>>>
	}
	const promises: Array<Promise<LoadComponent<T>>> = []
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

const resolve = <T,>(obj: LoadComponent<T>) => obj?.__esModule ? obj.default : obj
const render = <T, >(
	loaded: LoadComponent<T>,
	props: T
) => React.createElement(resolve(loaded), props)

type StateType<T, V> = {
	error: Error | null
	pastDelay: boolean
	timedOut: boolean
	loading: boolean
	loaded: unknown
}
const createLoadableComponent = <T, V extends boolean>(
	loadFn: V extends true ? typeof load : typeof loadMap,
	options: LoadableOptions<T, V>
) => {
	if (!options.loading) throw new Error('react-loadable requires a `loading` component')
	const opts = {
		delay: 200,
		timeout: null,
		render,
		...(options as unknown as LoadableOptions<T, V> & {
			webpack: () => string[]
			modules: string[]
		})
	}
	let res!: V extends true ? ReturnType<typeof load> : ReturnType<typeof loadFn>

	const init = () => {
		if (!res) res = (loadFn as typeof load)(opts.loader as LoaderType<T>) as V extends true ? ReturnType<typeof load> : ReturnType<typeof loadFn>
		return res.promise
	}
	ALL_INITIALIZERS.push(init)

	if (typeof opts.webpack === 'function')
		READY_INITIALIZERS.push(() => {
			if (isWebpackReady(opts.webpack)) return init()
		})

	class LoadableComponent extends React.Component<T & {report: ((moduleId: string) => any) | undefined}> {
		private _mounted?: boolean
		state: StateType<T, V>
		private _delay!: ReturnType<typeof setTimeout>
		private _timeout!: ReturnType<typeof setTimeout>
		constructor(props: T & {report: ((moduleId: string) => any) | undefined}) {
			super(props)
			init()
			this.state = {
				error: res.error,
				pastDelay: false,
				timedOut: false,
				loading: res!.loading,
				loaded: res!.loaded
			}
			this._loadModule()
		}
		public componentDidMount() { this._mounted = true }
		private async _loadModule() {
			if (this.props.report && Array.isArray(opts.modules))
			for (const moduleName of opts.modules) this.props.report!(moduleName)
			if (!res.loading) return
			const setStateWithMountCheck = (newState: Partial<StateType<T, V>>) => {
				if (!this._mounted) return
				this.setState(newState)
			}
			if (typeof opts.delay === 'number') {
				if (opts.delay === 0) {
					if (this._mounted) this.setState({ pastDelay: true })
					else this.state.pastDelay = true
				} else {
					this._delay = setTimeout(() => {
						setStateWithMountCheck({ pastDelay: true })
					}, opts.delay)
				}
			}
			if (typeof opts.timeout === 'number') {
				this._timeout = setTimeout(() => {
					setStateWithMountCheck({ timedOut: true })
				}, opts.timeout)
			}
			try { await res.promise } finally {
				setStateWithMountCheck({
					error: res.error,
					loaded: res.loaded,
					loading: res.loading
				})
				this._clearTimeouts()
			}
		}
		public componentWillUnmount() {
			this._mounted = false
			this._clearTimeouts()
		}
		private _clearTimeouts() {
			clearTimeout(this._delay)
			clearTimeout(this._timeout)
		}
		retry() {
			this.setState({ error: null, loading: true, timedOut: false })
			res = (loadFn as typeof load)(opts.loader as LoaderType<T>) as V extends true ? ReturnType<typeof load> : ReturnType<typeof loadFn>
			this._loadModule()
		}
		public render() {
			return <StrictMode>
				{
					this.state.loading || this.state.error
						? <opts.loading
							isLoading={this.state.loading}
							pastDelay={this.state.pastDelay}
							timedOut={this.state.timedOut}
							error={this.state.error}
							retry={this.retry}
						/>
						: this.state.loaded
						? opts.render(this.state.loaded, this.props)
						: null
				}
			</StrictMode>
		}
	}
	const ContextWrapper = (props: T) => <CaptureContext.Consumer>
		{report => <LoadableComponent {...props} report={report}/>}
	</CaptureContext.Consumer>
	ContextWrapper.preload = init
	ContextWrapper.displayName = 'CaptureContextWrapper'
	return ContextWrapper
}

const Loadable = <T,>(opts: LoadableOptions<T, true>) => createLoadableComponent(load, opts)
Loadable.Map = <T, >(opts: LoadableOptions<T, false>) => {
	if (typeof opts.render !== 'function')
		throw new Error('LoadableMap requires a `render(loaded, props)` function')
	return createLoadableComponent(loadMap, opts)
}

const Capture = ({children, report}: {
	children: ReactNode
	report: (moduleId: string) => any
}) => <CaptureContext.Provider value={report}>
	{children}
</CaptureContext.Provider>
Capture.displayName = 'Capture'
Loadable.Capture = Capture

const flushInitializers = async (initializers: typeof ALL_INITIALIZERS): Promise<void> => {
	const promises = []
	while (initializers.length) promises.push(initializers.pop()!())
	await Promise.all(promises)
	if (initializers.length) return flushInitializers(initializers)
}
Loadable.preloadAll = () => flushInitializers(ALL_INITIALIZERS)
Loadable.preloadReady = () => flushInitializers(READY_INITIALIZERS)

export default Loadable
