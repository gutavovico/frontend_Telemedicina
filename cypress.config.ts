import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 30000,
    setupNodeEvents(on, config) {
      on('task', {
        log(message) {
          console.log(message);
          return null;
        }
      });
    },
    specPattern: 'cypress/e2e/**/*.cy.{js,ts}',
  },
  component: {
    devServer: {
      framework: 'angular',
      bundler: 'vite',
    },
    specPattern: 'src/**/*.cy.{js,ts}',
  },
  retries: {
    runMode: 2,
    openMode: 0,
  },
  env: {
    apiUrl: 'http://localhost:8000',
    testUser: {
      email: 'medico@test.com',
      password: 'password123'
    }
  }
});