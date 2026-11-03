// ESLint para todo el repo: servidor (Node) y web (Vue 3, navegador). npm run lint
import js from '@eslint/js';
import vue from 'eslint-plugin-vue';
import globals from 'globals';

export default [
  { ignores: ['**/node_modules/**', '**/dist/**'] },
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': ['error', { caughtErrors: 'none', argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    files: ['server/**/*.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  ...vue.configs['flat/essential'].map((c) => ({ ...c, files: ['web/**/*.{js,vue}'] })),
  {
    files: ['web/**/*.{js,vue}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['web/public/sw.js'],
    languageOptions: { globals: globals.serviceworker },
  },
];
