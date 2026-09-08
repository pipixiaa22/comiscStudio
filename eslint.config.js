const js = require('@eslint/js')
const globals = require('globals')
const react = require('eslint-plugin-react')
const reactHooks = require('eslint-plugin-react-hooks')

module.exports = [
  {ignores: ['dist/**', 'release/**', 'node_modules/**', '.pnpm-store/**', 'resources/**']},
  js.configs.recommended,
  {
    rules: {
      'no-empty': ['error', {allowEmptyCatch: true}],
      'no-unused-vars': ['error', {args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true}]
    }
  },
  {
    // Renderer: ES modules with JSX running in Chromium.
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: {ecmaFeatures: {jsx: true}},
      globals: {...globals.browser}
    },
    plugins: {react, 'react-hooks': reactHooks},
    rules: {
      'react/jsx-uses-vars': 'error',
      'react/jsx-key': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },
  {
    // Audio worklet globals are provided by the audio rendering thread.
    files: ['src/features/voice/worklet/**/*.js'],
    languageOptions: {
      globals: {AudioWorkletProcessor: 'readonly', registerProcessor: 'readonly', sampleRate: 'readonly', currentFrame: 'readonly', currentTime: 'readonly'}
    }
  },
  {
    // Electron main process, preload, build scripts, node:test suites, and the
    // CommonJS domain modules that both processes share.
    files: ['electron/**/*.js', 'main.js', 'preload.js', 'scripts/**/*.cjs', 'tests/**/*.cjs', '*.config.js', 'src/shared/domain/*.js'],
    languageOptions: {ecmaVersion: 2024, sourceType: 'commonjs', globals: {...globals.node}}
  }
]
