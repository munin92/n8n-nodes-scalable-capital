import { n8nCommunityNodesPlugin } from '@n8n/eslint-plugin-community-nodes';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{ ignores: ['dist/**', 'node_modules/**', 'scripts/**', 'test/**', 'eslint.config.mjs'] },
	{
		files: ['nodes/**/*.ts', 'credentials/**/*.ts'],
		extends: [...tseslint.configs.recommended],
		languageOptions: { parserOptions: { project: './tsconfig.json' } },
	},
	n8nCommunityNodesPlugin.configs.recommended,
);
