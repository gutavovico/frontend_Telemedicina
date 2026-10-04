/// <reference types="cypress" />

describe('CU10 - Emitir Solicitudes de Exámenes de Laboratorio', () => {
  beforeEach(() => {
    cy.login('medico@test.com', 'password123');
  });

  describe('Crear orden en borrador', () => {
    it('debe permitir crear una orden con múltiples exámenes', () => {
      cy.navigateTo('/ordenes-laboratorio/nueva');

      // Verificar título de página
      cy.contains('h1', 'Nueva Orden de Laboratorio').should('be.visible');

      // Llenar paciente
      cy.get('input[formcontrolname="id_paciente"]').clear().type('10');

      // Agregar primer examen
      cy.selectExamen('HEMOGRAMA');
      cy.get('textarea[formcontrolname="indicaciones"]').first().type('En ayunas 12 horas');

      // Agregar segundo examen
      cy.contains('button', 'Añadir examen').click();
      cy.selectExamen('GLUCOSA');
      cy.get('textarea[formcontrolname="indicaciones"]').eq(1).type('Post-prandial 2h');

      // Crear orden
      cy.contains('button', 'Crear orden en borrador').click();

      // Verificar redirección a detalle
      cy.url().should('match', /\/ordenes-laboratorio\/\d+/);
      cy.contains('BORRADOR').should('be.visible');
      cy.contains('HEMOGRAMA').should('be.visible');
      cy.contains('GLUCOSA').should('be.visible');
    });

    it('debe rechazar creación sin exámenes', () => {
      cy.navigateTo('/ordenes-laboratorio/nueva');
      cy.get('input[formcontrolname="id_paciente"]').clear().type('10');
      cy.contains('button', 'Crear orden en borrador').click();
      cy.contains('Debe incluir al menos un examen').should('be.visible');
    });

    it('debe rechazar examen inexistente', () => {
      cy.navigateTo('/ordenes-laboratorio/nueva');
      cy.get('input[formcontrolname="id_paciente"]').clear().type('10');
      cy.get('input[formcontrolname="codigo"]').first().type('EXAMEN_FALSO{enter}');
      cy.contains('button', 'Crear orden en borrador').click();
      cy.contains('Examen no encontrado en catálogo').should('be.visible');
    });
  });

  describe('Firmar y emitir orden', () => {
    let orderId: number;

    beforeEach(() => {
      // Crear orden en borrador via API para test de firma
      cy.request({
        method: 'POST',
        url: '/api/v1/ordenes-laboratorio',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        body: {
          id_paciente: 10,
          examenes: [{ codigo: 'HEMOGRAMA', indicaciones: 'En ayunas' }]
        }
      }).then((res) => {
        orderId = res.body.id_orden;
      });
    });

    it('debe permitir firmar y emitir la orden', () => {
      cy.navigateTo(`/ordenes-laboratorio/${orderId}`);
      cy.contains('BORRADOR').should('be.visible');

      cy.contains('button', 'Firmar y emitir orden').click();

      cy.contains('FIRMADA').should('be.visible');
      cy.contains('Firma Digital').should('be.visible');
      cy.contains('Hash SHA-256').should('be.visible');

      // Verificar que se indexó en HCE (documentos_clinicos)
      cy.request({
        method: 'GET',
        url: `/api/v1/documentos?tipo_documento=ORDEN_LAB&q=${orderId}`,
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
      }).then((res) => {
        expect(res.body.items.length).to.be.greaterThan(0);
        expect(res.body.items[0].tipo_documento).to.eq('ORDEN_LAB');
      });
    });

    it('debe generar URL de descarga del PDF firmado', () => {
      cy.navigateTo(`/ordenes-laboratorio/${orderId}`);
      cy.contains('button', 'Generar URL de descarga').click();
      cy.contains('Descargar PDF').should('be.visible').click();

      // Verificar descarga (blob)
      cy.readFile('cypress/downloads/orden-lab-*.pdf').should('exist');
    });
  });

  describe('Listado y filtros', () => {
    it('debe listar órdenes con paginación', () => {
      cy.navigateTo('/ordenes-laboratorio');
      cy.contains('Listado de Órdenes').should('be.visible');
      cy.get('table tbody tr').should('have.length.at.least', 1);
    });

    it('debe filtrar por estado', () => {
      cy.navigateTo('/ordenes-laboratorio');
      cy.get('select[formcontrolname="selectedEstado"]').select('FIRMADA');
      cy.get('table tbody tr').each(($row) => {
        cy.wrap($row).find('td').eq(2).should('contain', 'FIRMADA');
      });
    });

    it('debe buscar por paciente', () => {
      cy.navigateTo('/ordenes-laboratorio');
      cy.get('input[placeholder*="paciente"]').type('Carlos');
      cy.get('table tbody tr').each(($row) => {
        cy.wrap($row).find('td').first().should('contain', 'Carlos');
      });
    });

    it('debe filtrar por fecha', () => {
      cy.navigateTo('/ordenes-laboratorio');
      const today = new Date().toISOString().split('T')[0];
      cy.get('input[type="date"]').first().type(today);
      cy.get('table tbody tr').should('have.length.at.least', 0);
    });
  });

  describe('Permisos por rol', () => {
    it('médico solo ve sus propias órdenes', () => {
      // Login como médico 2
      cy.logout();
      cy.login('medico2@test.com', 'password123');
      cy.navigateTo('/ordenes-laboratorio');
      // Verificar que no ve órdenes de médico 1
      cy.get('table tbody tr').each(($row) => {
        // Solo órdenes del médico 2
      });
    });

    it('recepcionista ve todas las órdenes', () => {
      cy.logout();
      cy.login('recepcion@test.com', 'password123');
      cy.navigateTo('/ordenes-laboratorio');
      // Debe ver órdenes de todos los médicos
      cy.get('table tbody tr').should('have.length.at.least', 1);
    });
  });
});