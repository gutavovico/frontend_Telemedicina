// Custom Cypress commands for Telemedicina E2E tests

/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      login(email?: string, password?: string): Chainable<void>;
      logout(): Chainable<void>;
      navigateTo(path: string): Chainable<void>;
      waitForApi(alias: string): Chainable<void>;
      fillForm(formData: Record<string, string>): Chainable<void>;
      selectExamen(codigo: string): Chainable<void>;
    }
  }
}

// Login command
Cypress.Commands.add('login', (email = 'medico@test.com', password = 'password123') => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.get('input[type="email"]').clear().type(email);
    cy.get('input[type="password"]').clear().type(password);
    cy.get('button[type="submit"]').click();
    cy.url().should('not.include', '/login');
    cy.get('header').should('be.visible');
  });
});

// Logout command
Cypress.Commands.add('logout', () => {
  cy.visit('/');
  cy.get('header').find('button, a').contains('Cerrar sesión').click();
  cy.url().should('include', '/login');
});

// Navigate to path
Cypress.Commands.add('navigateTo', (path: string) => {
  cy.visit(path);
  cy.location('pathname').should('eq', path);
});

// Wait for API request
Cypress.Commands.add('waitForApi', (alias: string) => {
  cy.wait(`@${alias}`, { timeout: 15000 });
});

// Fill form
Cypress.Commands.add('fillForm', (formData: Record<string, string>) => {
  Object.entries(formData).forEach(([field, value]) => {
    cy.get(`[formcontrolname="${field}"], [formControlName="${field}"], input[name="${field}"], select[name="${field}"]`)
      .clear()
      .type(value);
  });
});

// Select examen from catalog
Cypress.Commands.add('selectExamen', (codigo: string) => {
  cy.get('input[placeholder*="buscar"], input[placeholder*="Buscar"]').type(codigo);
  cy.get('mat-option, .examen-option, [role="option"]').contains(codigo).click();
});

// Select multiple examenes
Cypress.Commands.add('selectExamenes', (codigos: string[]) => {
  codigos.forEach((codigo) => {
    cy.selectExamen(codigo);
  });
});

export {};