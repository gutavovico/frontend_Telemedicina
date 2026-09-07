import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.vitest.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/app/features/medical-records/documents/services/**/*.ts',
        'src/app/features/medical-records/documents/guards/**/*.ts',
        'src/app/features/medical-records/documents/pipes/**/*.ts',
        'src/app/features/medical-records/documents/models/**/*.ts'
      ],
      thresholds: {
        global: { statements: 70, functions: 70, lines: 70, branches: 70 }
      }
    }
  }
});