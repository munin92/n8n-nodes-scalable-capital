// package.json is linted separately: the n8n community rules run on it, but it
// is not part of tsconfig, so the type-aware parser must stay out of the way.
module.exports = {
	root: true,
	parser: 'jsonc-eslint-parser',
	plugins: ['eslint-plugin-n8n-nodes-base'],
	extends: ['plugin:n8n-nodes-base/community'],
	rules: { 'n8n-nodes-base/community-package-json-name-still-default': 'off' },
};
