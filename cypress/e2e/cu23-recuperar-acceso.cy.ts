/// <reference types="cypress" />

describe('CU23 - Recuperar Acceso e Inactividad', () => {
  describe('Recuperar contraseña por correo', () => {
    it('debe permitir solicitar código por email', () => {
      cy.visit('/recuperar');
      cy.contains('Recuperar Acceso').should('be.visible');

      cy.get('input[formcontrolname="correo"]').type('medico@test.com');
      cy.get('input[formcontrolname="canal"][value="email"]').check();
      cy.contains('button', 'Enviar código de recuperación').click();

      cy.contains('Solicitud enviada').should('be.visible');
      cy.contains('correo de recuperación').should('be.visible');
    });

    it('debe permitir solicitar código por SMS', () => {
      cy.visit('/recuperar');
      cy.get('input[formcontrolname="correo"]').type('medico@test.com');
      cy.get('input[formcontrolname="canal"][value="sms"]').check();
      cy.contains('button', 'Enviar código de recuperación').click();

      cy.contains('Solicitud enviada').should('be.visible');
      cy.contains('SMS').should('be.visible');
    });

    it('debe mostrar mensaje genérico para correo no registrado', () => {
      cy.visit('/recuperar');
      cy.get('input[formcontrolname="correo"]').type('noexiste@test.com');
      cy.contains('button', 'Enviar código de recuperación').click();

      cy.contains('Si el correo está registrado').should('be.visible');
    });

    it('debe permitir restablecer contraseña con código válido', () => {
      // En modo desarrollo, el código se muestra en la respuesta
      cy.visit('/recuperar');
      cy.get('input[formcontrolname="correo"]').type('medico@test.com');
      cy.contains('button', 'Enviar código de recuperación').click();

      // Obtener código debug de la respuesta
      cy.contains('Código dev:').invoke('text').then((text) => {
        const codigo = text.match(/\d{6}/)?.[0];
        if (codigo) {
          cy.visit('/recuperar-contrasena');
          cy.get('input[formcontrolname="correo"]').type('medico@test.com');
          cy.get('input[formcontrolname="codigo"]').type(codigo);
          cy.get('input[formcontrolname="nueva_password"]').type('NuevaPassword123');
          cy.contains('button', 'Restablecer').click();
          cy.contains('Contraseña restablecida').should('be.visible');
        }
      });
    });
  });

  describe('Control de inactividad', () => {
    beforeEach(() => {
      cy.login('medico@test.com', 'password123');
    });

    it('debe mostrar aviso de inactividad a los 60 segundos antes del cierre', () => {
      cy.visit('/documentos');
      // Simular inactividad avanzando el reloj
      cy.clock();
      cy.tick(14 * 60 * 1000); // 14 minutos (ventana 15 min - aviso 60s)

      // El aviso debe aparecer
      cy.contains('Tu sesión está por vencer').should('be.visible');
      cy.contains('Seguir conectado').should('be.visible');
    });

    it('debe renovar sesión al hacer clic en "Seguir conectado"', () => {
      cy.visit('/documentos');
      cy.clock();
      cy.tick(14 * 60 * 1000);

      cy.contains('Seguir conectado').click();

      // Verificar que se renueva la sesión
      cy.contains('Tu sesión está por vencer').should('not.exist');
    });

    it('debe cerrar sesión automáticamente al agotar el tiempo', () => {
      cy.visit('/documentos');
      cy.clock();
      cy.tick(16 * 60 * 1000); // Pasar la ventana de 15 minutos

      // Debe redirigir a login con parámetro inactive=true
      cy.url().should('include', '/login');
      cy.url().should('include', 'inactive=true');
    });

    it('debe reconciliar reloj al recuperar foco de ventana', () => {
      cy.visit('/documentos');
      cy.clock();
      cy.tick(10 * 60 * 1000); // 10 minutos

      // Simular pérdida y recuperación de foco
      cy.window().then((win) => {
        win.dispatchEvent(new Event('blur'));
        cy.tick(5 * 60 * 1000); // Simular 5 min en background
        win.dispatchEvent(new Event('focus'));
      });

      // El reloj debe sincronizarse con el servidor
      cy.contains('Tu sesión está por vencer').should('not.exist');
    });
  });

  describe('Cierre de sesión por inactividad en interceptor', () => {
    it('debe interceptar 401 por inactividad y redirigir a login', () => {
      cy.login('medico@test.com', 'password123');
      cy.visit('/documentos');

      // Simular respuesta 401 con detail "inactividad"
      cy.intercept('**/api/**', {
        statusCode: 401,
        body: { detail: 'Sesión cerrada por inactividad' }
      }).as('inactivityError');

      cy.visit('/documentos');
      cy.wait('@inactivityError');

      cy.url().should('include', '/login');
      cy.url().should('include', 'inactive=true');
    });
  });
});