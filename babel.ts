// https://babeljs.io/docs/en/babel-types
// https://doc.esdoc.org/github.com/mason-lang/esast/class/src/ast.js~Property.html
// https://astexplorer.net/
import nodePath from 'node:path'

export default ({types: t, /*template*/}, {shortenPath, absPath}: {
	shortenPath?: string
	absPath?: boolean
} = {}) => {
	return ({
		visitor: {
			ImportDeclaration(path) {
				const source = path.node.source.value
				if (source !== '@react-loadable/revised') return

				const defaultSpecifier = path.get('specifiers').find(specifier => specifier.isImportDefaultSpecifier())
				if (!defaultSpecifier) return

				const bindingName = defaultSpecifier.node.local.name
				const binding = path.scope.getBinding(bindingName)

				refPath:
					for (const refPath of binding.referencePaths) {
						const callExpression = refPath.parentPath
						if (!callExpression.isCallExpression()) continue

						const args = callExpression.get('arguments')
						if (args.length !== 1) throw new Error('react-loadable: must provide exactly 1 argument to loadable()')

						const options = args[0]
						if (!options.isObjectExpression()) continue

						let loader
						for (const property of options.get('properties')) {
							if (property.type !== 'SpreadProperty') {
								const key = property.get('key')
								if (key.node.name === 'webpack') continue refPath
								else if (key.node.name === 'loader') loader = property
							}
						}
						if (!loader) throw new Error('react-loadable: at least loader or webpack properties must be statically provided to the option that is passed to loadable()')

						const loaderValue = loader.get('value')
						const dynamicImports = []

						const body = loader.isFunction()
							? loader.get('body')
							: loaderValue.isArrowFunctionExpression() && loaderValue.get('body')
						if (!body) throw new Error('react-loadable: loader must be function shorthand expression or arrow function expression')

						body.traverse({
							Import(path) {
								dynamicImports.push(path.parentPath)
							}
						})
						if (!dynamicImports.length) continue

						loader.insertAfter(
							t.objectProperty(
								t.identifier('webpack'),
								t.arrowFunctionExpression(
									[],
									t.arrayExpression(
										dynamicImports.map(dynamicImport => t.callExpression(
											t.memberExpression(
												t.identifier('require'),
												t.identifier('resolveWeak'),
											),
											[dynamicImport.get('arguments')[0].node],
										))
									)
								)
							)
						)

						const dir = nodePath.dirname(this.file.opts.filename)
						const rootDir = this.file.opts.root
						loader.insertAfter(
							t.objectProperty(
								t.identifier('modules'),
								t.arrayExpression(
									dynamicImports.map(dynamicImport => {
										const node = dynamicImport.get('arguments')[0].node
										if (absPath && node.type === 'StringLiteral') {
											const {value} = node
											if (typeof value === 'string') {
												const resolvedPath = absPath && value.startsWith('./') ? nodePath.resolve(dir, value) : value
												const afterShortenPath = typeof shortenPath === 'string' && resolvedPath.startsWith(rootDir)
													? `${shortenPath}${resolvedPath.slice(rootDir.length)}`
													: resolvedPath
												return t.stringLiteral(afterShortenPath)
											}
										}
										return node
									})
								)
							)
						)
					}
			}
		}
	})
}
