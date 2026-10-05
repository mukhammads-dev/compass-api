/**
 * ESLint 8 config (the version installed in package.json).
 * Type-aware rules: `any` leaking from requests, errors or aggregations is reported,
 * so the code keeps real types instead of hiding problems behind `any`.
 */
module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	parserOptions: {
		project: './tsconfig.json',
		tsconfigRootDir: __dirname,
		sourceType: 'module',
	},
	plugins: ['@typescript-eslint'],
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended-type-checked',
		'plugin:prettier/recommended',
	],
	env: { node: true, jest: true },
	ignorePatterns: ['.eslintrc.js', 'dist', 'node_modules'],
	rules: {
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/no-floating-promises': 'warn',
		'@typescript-eslint/no-unsafe-argument': 'warn',
		'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
		'prettier/prettier': ['error', { endOfLine: 'auto' }],
	},
};
