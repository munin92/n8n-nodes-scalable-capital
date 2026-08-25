module.exports = {
	root: true,
	env: { browser: true, es6: true, node: true },
	parser: '@typescript-eslint/parser',
	parserOptions: { project: ['./tsconfig.json'], sourceType: 'module', extraFileExtensions: ['.json'] },
	ignorePatterns: ['.eslintrc.js', '**/*.js', '**/node_modules/**', '**/dist/**'],
	overrides: [
		{
			files: ['./credentials/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/credentials'],
			// Community packages must point documentationUrl at a real HTTP URL
			// (cred-class-field-documentation-url-not-http-url). The miscased rule
			// wants a camelCase docs slug instead and its autofix mangles the URL.
			rules: { 'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off' },
		},
		{
			files: ['./nodes/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/nodes'],
		},
	],
};
