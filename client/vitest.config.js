import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      include: ['src/**/*.test.{js,jsx}'],
      css: false,
      restoreMocks: true,
      env: {
        VITE_API_BASE_URL: 'http://api.test',
      },
      coverage: {
        include: ['src/**/*.{js,jsx}'],
        exclude: ['src/test/**', 'src/**/*.test.{js,jsx}', 'src/main.jsx'],
      },
    },
  }),
)
