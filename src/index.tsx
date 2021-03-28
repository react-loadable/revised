import {
	ComponentType,
	createContext,
	ReactElement,
	ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState
} from 'react'

type LoaderType<T, P> = () => Promise<LoadableComponent<T, P>>

const ALL_INITIALIZERS: Array<LoaderType<any, any>> = []
const READY_INITIALIZERS: Array<LoaderType<any, any>> = []
const CaptureContext = createContext<((moduleId: string) => any) | undefined>(undefined)
CaptureContext.displayName = 'Capture'

export function Capture({report, children}: {
	report(moduleId: string): any
	children: ReactNode
}) {
	return <CaptureContext.Provider value={report}>
		{children}
	</CaptureContext.Provider>
}
Capture.displayName = 'Capture'

type LoadableOptions<T, P> = {
	loading: ComponentType<{
		isLoading: boolean
		pastDelay: boolean
		timedOut: boolean
		error?: Error
		retry(): any
	}>
	delay?: number
	timeout?: number
	webpack?(): string[]
	loader(): Promise<T>
	render?(loaded: T, props: P): ReactElement
}

type LoadableComponent<T, P> = ComponentType<
	T extends {default: ComponentType<infer Props>}
		? Props
		: P // this conditional branch is not 100% correct. It should be never if render property is not provided
	>

declare const __webpack_modules__: any
const isWebpackReady = (getModuleIds: () => string[]) => typeof __webpack_modules__ === 'object'
	&& getModuleIds().every(moduleId => typeof moduleId !== 'undefined' && typeof __webpack_modules__[moduleId] !== 'undefined')

interface LoadState<T, P> {
	promise: Promise<LoadableComponent<T, P>>
	loading: boolean
	loaded?: LoadableComponent<T, P>
	error?: Error
}
const load = <T, P>(loader: LoaderType<T, P>) => {
	const state = {
		loading: true,
		loaded: undefined,
		error: undefined,
	} as LoadState<T, P>
	state.promise = new Promise<LoadableComponent<T, P>>(async (resolve, reject) => {
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

type LoadComponent<P> = {
	// __esModule: true
	default: ComponentType<P>
} | ComponentType<P>

const resolve = <P,>(obj: LoadComponent<P>): ComponentType<P> => (obj as any)?.__esModule ? (obj as any).default : obj
const defaultRenderer = <P, T extends {default: ComponentType<P>}>(
	loaded: T,
	props: T extends {default: ComponentType<infer P>} ? P : never
) => {
	const Loaded = resolve(loaded)
	return <Loaded {...props}/>
}

type LoadableState<T, P,> = {
	error?: Error
	pastDelay: boolean
	timedOut: boolean
	loading: boolean
	loaded?: LoadableComponent<T, P>
}

function createLoadableComponent<T, P>(
	{
		delay = 200,
		loading: Loading,
		loader,
		webpack,
		timeout,
		...opts
	}: LoadableOptions<T, P>
): LoadableComponent<T, P> & {
	displayName: string
	preload: LoaderType<T, P>
} {
	if (!Loading) throw new Error('react-loadable requires a `loading` component')
	const render = 'render' in opts ? opts['render'] : defaultRenderer

	let loadState: LoadState<T, P>
	const init = () => {
		if (!loadState) loadState = load(loader as any)
		return loadState.promise
	}
	ALL_INITIALIZERS.push(init)

	if (typeof webpack === 'function') READY_INITIALIZERS.push(() => {
		if (isWebpackReady(webpack)) return init()
	})

	const LoadableComponent = props => {
		const report = useContext(CaptureContext)
		const delayRef = useRef<ReturnType<typeof setTimeout>>()
		const timeoutRef = useRef<ReturnType<typeof setTimeout>>()
		init()
		const [state, setState] = useState<LoadableState<T, P>>({
			error: loadState.error,
			pastDelay: false,
			timedOut: false,
			loading: loadState.loading,
			loaded: loadState.loaded
		})
		const firstStateRef = useRef<LoadableState<T, P> | undefined>(state)
		const mountedRef = useRef<boolean>(false)
		useEffect(() => {
		}, [])
		//must be called asynchronously
		const setStateWithMountCheck = useCallback((newState: Partial<LoadableState<T, P>>) => {
			if (!mountedRef.current) return
			setState(cur => ({...cur, ...newState}))
		}, [])
		const clearTimeouts = useCallback(() => {
			if (delayRef.current) {
				clearTimeout(delayRef.current)
				delayRef.current = undefined
			}
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
				timeoutRef.current = undefined
			}
		}, [])
		const loadModule = useCallback(async () => {
			if (report && Array.isArray(opts['modules'])) for (const moduleName of opts['modules']) report(moduleName)
			if (!loadState.loading) return
			if (typeof delay === 'number') {
				if (delay === 0) {
					if (mountedRef.current) setState(cur => ({ ...cur, pastDelay: true }))
					else if (firstStateRef.current) firstStateRef.current.pastDelay = true
				} else {
					delayRef.current = setTimeout(() => {
						setStateWithMountCheck({ pastDelay: true })
					}, delay)
				}
			}
			if (typeof timeout === 'number') {
				timeoutRef.current = setTimeout(() => {
					setStateWithMountCheck({ timedOut: true })
				}, timeout)
			}
			try { await loadState.promise } catch {} finally {
				clearTimeouts()
				setStateWithMountCheck({
					error: loadState.error,
					loaded: loadState.loaded,
					loading: loadState.loading
				})
			}
		}, [report, setStateWithMountCheck, clearTimeouts])
		const retry = useCallback(async () => {
			if (!mountedRef.current) return
			setState(cur => ({ ...cur, error: undefined, loading: true, timedOut: false }))
			loadState = load(loader as any)
			await loadModule()
		}, [loadModule])
		useEffect(() => {
			mountedRef.current = true
			return () => {
				mountedRef.current = false
				clearTimeouts()
			}
		}, [clearTimeouts])
		if (firstStateRef.current) {
			firstStateRef.current = undefined
			loadModule()
		}
		return state.loading || state.error
			? <Loading
				isLoading={state.loading}
				pastDelay={state.pastDelay}
				timedOut={state.timedOut}
				error={state.error}
				retry={retry}
			/>
			: state.loaded || null
				? render(state.loaded as any, props)
				: null
	}

	LoadableComponent.preload = init
	LoadableComponent.displayName = `LoadableComponent(${Array.isArray(opts['modules']) ? opts['modules'].join('-') : ''})`
	return LoadableComponent as any
}

const flushInitializers = async <T, P>(initializers: Array<LoaderType<T, P>>): Promise<void> => {
	const promises = []
	while (initializers.length) promises.push(initializers.pop()!())
	await Promise.all(promises)
	if (initializers.length) return flushInitializers(initializers)
}
export const preloadAll = () => flushInitializers(ALL_INITIALIZERS)
export const preloadReady = () => flushInitializers(READY_INITIALIZERS)

const loadable = <T, P>(opts: LoadableOptions<T, P>) => createLoadableComponent(opts)
export default loadable
