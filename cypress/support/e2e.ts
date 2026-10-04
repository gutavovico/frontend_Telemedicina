// Cypress support file - runs before each test file
import './commands';

// Global beforeEach
beforeEach(() => {
  cy.intercept('**/api/**').as('apiRequest');
  cy.clearLocalStorage();
  cy.clearCookies();
});

// Global afterEach
afterEach(() => {
  // Cleanup if needed
});

/// <reference types="cypress" />
/// <reference types="@cypress/code-coverage/support" />