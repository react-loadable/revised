import 'regenerator-runtime'
import React from 'react'
import renderer from 'react-test-renderer'
import Loadable, {preloadAll, preloadReady} from '../src'

function waitFor(delay) {
	return new Promise(resolve => {
		setTimeout(resolve, delay)
	})
}

function createLoader(delay, loader, error) {
	return () => {
		return waitFor(delay).then(() => {
			if (loader) {
				return loader()
			} else {
				throw error
			}
		})
	}
}

function MyLoadingComponent(props) {
	return <div>MyLoadingComponent {JSON.stringify(props)}</div>
}

function MyComponent(props) {
	return <div>MyComponent {JSON.stringify(props)}</div>
}

describe('LoadableComponent', () => {
	afterEach(async () => {
		try {
			await preloadAll()
		} catch (err) {}
	})

	test('loading success', async () => {
		let LoadableMyComponent = Loadable({
			loader: createLoader(400, () => MyComponent),
			loading: MyLoadingComponent
		})

		let component1 = renderer.create(<LoadableMyComponent prop="foo" />)

		expect(component1.toJSON()).toMatchSnapshot() // initial
		await renderer.act(() => waitFor(200))
		expect(component1.toJSON()).toMatchSnapshot() // loading
		await renderer.act(() => waitFor(200))
		expect(component1.toJSON()).toMatchSnapshot() // loaded

		let component2 = renderer.create(<LoadableMyComponent prop="bar" />)

		expect(component2.toJSON()).toMatchSnapshot() // reload
	})

	test('loading error', async () => {
		let LoadableMyComponent = Loadable({
			loader: createLoader(400, null, new Error('test error')),
			loading: MyLoadingComponent
		})

		let component = renderer.create(<LoadableMyComponent prop="baz" />)

		expect(component.toJSON()).toMatchSnapshot() // initial
		await renderer.act(() => waitFor(200))
		expect(component.toJSON()).toMatchSnapshot() // loading
		await renderer.act(() => waitFor(200))
		expect(component.toJSON()).toMatchSnapshot() // errored
	})

	test('server side rendering', async () => {
		let LoadableMyComponent = Loadable({
			loader: createLoader(400, () => require('../__fixtures__/component')),
			loading: MyLoadingComponent,
		})

		await preloadAll()

		let component = renderer.create(<LoadableMyComponent prop="baz" />)

		expect(component.toJSON()).toMatchSnapshot() // serverside
	})

	test('server side rendering es6', async () => {
		let LoadableMyComponent = Loadable({
			loader: createLoader(400, () => require('../__fixtures__/component.es6')),
			loading: MyLoadingComponent,
		})

		await preloadAll()

		let component = renderer.create(<LoadableMyComponent prop="baz" />)

		expect(component.toJSON()).toMatchSnapshot() // serverside
	})

	test('preload', async () => {
		let LoadableMyComponent = Loadable({
			loader: createLoader(400, () => MyComponent),
			loading: MyLoadingComponent
		})

		let promise = LoadableMyComponent.preload()
		await renderer.act(() => waitFor(200))

		let component1 = renderer.create(<LoadableMyComponent prop="baz" />)

		expect(component1.toJSON()).toMatchSnapshot() // still loading...
		await renderer.act(() => promise)
		expect(component1.toJSON()).toMatchSnapshot() // success

		let component2 = renderer.create(<LoadableMyComponent prop="baz" />)
		expect(component2.toJSON()).toMatchSnapshot() // success
	})

	test('render', async () => {
		let LoadableMyComponent = Loadable({
			loader: createLoader(400, () => ({ MyComponent })),
			loading: MyLoadingComponent,
			render(loaded, props) {
				return <loaded.MyComponent {...props}/>
			}
		})
		let component = renderer.create(<LoadableMyComponent prop="baz" />)
		expect(component.toJSON()).toMatchSnapshot() // initial
		await renderer.act(() => waitFor(200))
		expect(component.toJSON()).toMatchSnapshot() // loading
		await renderer.act(() => waitFor(200))
		expect(component.toJSON()).toMatchSnapshot() // success
	})

	describe('preloadReady', () => {
		beforeEach(() => {
			global.__webpack_modules__ = { 1: true, 2: true }
		})

		afterEach(() => {
			delete global.__webpack_modules__
		})

		test('undefined', async () => {
			let LoadableMyComponent = Loadable({
				loader: createLoader(200, () => MyComponent),
				loading: MyLoadingComponent,
			})

			await preloadReady()

			let component = renderer.create(<LoadableMyComponent prop="baz" />)

			expect(component.toJSON()).toMatchSnapshot()

			await renderer.act(() => waitFor(200))
		})

		test('one', async () => {
			let LoadableMyComponent = Loadable({
				loader: createLoader(200, () => MyComponent),
				loading: MyLoadingComponent,
				webpack: () => [1],
			})

			await preloadReady()

			let component = renderer.create(<LoadableMyComponent prop="baz" />)

			expect(component.toJSON()).toMatchSnapshot()
		})

		test('many', async () => {
			let LoadableMyComponent = Loadable({
				loader: createLoader(200, () => MyComponent),
				loading: MyLoadingComponent,
				webpack: () => [1, 2],
			})

			await preloadReady()

			let component = renderer.create(<LoadableMyComponent prop="baz" />)

			expect(component.toJSON()).toMatchSnapshot()
		})

		test('missing', async () => {
			let LoadableMyComponent = Loadable({
				loader: createLoader(200, () => MyComponent),
				loading: MyLoadingComponent,
				webpack: () => [1, 42],
			})

			await preloadReady()

			let component = renderer.create(<LoadableMyComponent prop="baz" />)

			expect(component.toJSON()).toMatchSnapshot()

			await renderer.act(() => waitFor(200))
		})

	})
})
