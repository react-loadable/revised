// @ts-nocheck
export default ({ types: t, template }) => ({
	visitor: {
		ImportDeclaration(path) {
			const source = path.node.source.value
			if (source !== '~react-loadable/revised' && source !== '@react-loadable/revised') return

			const defaultSpecifier = path.get('specifiers').find(specifier => {
				return specifier.isImportDefaultSpecifier()
			})

			if (!defaultSpecifier) return

			const bindingName = defaultSpecifier.node.local.name
			const binding = path.scope.getBinding(bindingName)

			binding.referencePaths.forEach(refPath => {
				let callExpression = refPath.parentPath

				if (
					callExpression.isMemberExpression() &&
					callExpression.node.computed === false &&
					callExpression.get('property').isIdentifier({ name: 'Map' })
				) callExpression = callExpression.parentPath

				if (!callExpression.isCallExpression()) return

				const args = callExpression.get('arguments')
				if (args.length !== 1) throw callExpression.error

				const options = args[0]
				if (!options.isObjectExpression()) return

				const properties = options.get('properties')
				const propertiesMap = {}

				properties.forEach(property => {
					if (property.type !== 'SpreadProperty') {
						const key = property.get('key')
						propertiesMap[key.node.name] = property
					}
				})

				if (propertiesMap.webpack) return

				const loaderMethod = propertiesMap.loader.get('value')
				const dynamicImports = []

				loaderMethod.traverse({
					Import(path) {
						dynamicImports.push(path.parentPath)
					}
				})

				if (!dynamicImports.length) return

				propertiesMap.loader.insertAfter(
					t.objectProperty(
						t.identifier('webpack'),
						t.arrowFunctionExpression(
							[],
							t.arrayExpression(
								dynamicImports.map(dynamicImport => {
									return t.callExpression(
										t.memberExpression(
											t.identifier('require'),
											t.identifier('resolveWeak'),
										),
										[dynamicImport.get('arguments')[0].node],
									)
								})
							)
						)
					)
				)

				propertiesMap.loader.insertAfter(
					t.objectProperty(
						t.identifier('modules'),
						t.arrayExpression(
							dynamicImports.map(dynamicImport => {
								return dynamicImport.get('arguments')[0].node
							})
						)
					)
				)
			})
		}
	}
})
