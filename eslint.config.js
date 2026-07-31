const expoConfig = require('eslint-config-expo/flat');
const tseslint = require('@typescript-eslint/eslint-plugin');

module.exports = [
  ...expoConfig,
  {
    ignores: ['admin/**', 'node_modules/**', '.expo/**', '__tests__/**', 'dist/**'],
  },
  {
    plugins: {
      '@typescript-eslint': tseslint,
    },
    languageOptions: {
      globals: {
        RequestInfo: 'readonly',
        RequestInit: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react-hooks/exhaustive-deps': 'error',
      'no-console': 'warn',
      'no-empty-function': 'error',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
];
