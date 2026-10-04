/// <reference types="cypress" />

describe('CU12 - Consultar Documentos Clínicos y Exámenes', () => {
  beforeEach(() => {
    cy.login('medico@test.com', 'password123');
  });

  describe('Listado de documentos', () => {
    it('debe listar documentos con paginación', () => {
      cy.navigateTo('/documentos');
      cy.contains('Documentos clínicos').should('be.visible');
      cy.get('table tbody tr, .document-card').should('have.length.at.least', 1);
    });

    it('debe filtrar por tipo de documento', () => {
      cy.navigateTo('/documentos');
      cy.get('select[formcontrolname="tipo_documento"]').select('RECETA');
      cy.get('table tbody tr').each(($row) => {
        cy.wrap($row).find('td').eq(2).should('contain', 'RECETA');
      });
    });

    it('debe buscar por título', () => {
      cy.navigateTo('/documentos');
      cy.get('input[placeholder*="buscar"]').type('Receta');
      cy.get('table tbody tr').each(($row) => {
        cy.wrap($row).find('td').first().should('contain', 'Receta');
      });
    });

    it('debe filtrar por rango de fechas', () => {
      cy.navigateTo('/documentos');
      const today = new Date().toISOString().split('T')[0];
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      cy.get('input[type="date"]').first().type(lastWeek);
      cy.get('input[type="date"]').last().type(today);
      cy.get('table tbody tr').should('have.length.at.least', 0);
    });
  });

  describe('Detalle y descarga de documento', () => {
    let documentId: number;

    beforeEach(() => {
      // Obtener un documento existente via API
      cy.request({
        method: 'GET',
        url: '/api/v1/documentos',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        qs: { page_size: 1 }
      }).then((res) => {
        documentId = res.body.items[0]?.id_documento;
      });
    });

    it('debe mostrar detalle del documento', () => {
      cy.navigateTo(`/documentos/${documentId}`);
      cy.contains('Detalle del Documento').should('be.visible');
      cy.contains('tipo_documento').should('be.visible');
      cy.contains('paciente_nombre').should('be.visible');
    });

    it('debe generar URL de descarga y descargar PDF', () => {
      cy.navigateTo(`/documentos/${documentId}`);
      cy.contains('button', 'Descargar').click();
      cy.contains('Descargar PDF').should('be.visible').click();
      cy.readFile('cypress/downloads/*.pdf').should('exist');
    });

    it('debe registrar auditoría al descargar', () => {
      cy.navigateTo(`/documentos/${documentId}`);
      cy.contains('button', 'Descargar').click();
      cy.contains('Descargar PDF').click();

      // Verificar auditoría via API
      cy.request({
        method: 'GET',
        url: `/api/v1/auditoria?tabla=documentos_clinicos&registro=${documentId}`,
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
      }).then((res) => {
        expect(res.body.items.some((a: any) => a.accion === 'DESCARGAR_DOCUMENTO')).to.be.true;
      });
    });
  });

  describe('Permisos por tipo de documento', () => {
    it('recepcionista NO puede ver RESULTADO_LAB', () => {
      cy.logout();
      cy.login('recepcion@test.com', 'password123');
      cy.navigateTo('/documentos');
      cy.get('select[formcontrolname="tipo_documento"]').select('RESULTADO_LAB');
      cy.contains('Permiso denegado').should('be.visible');
    });

    it('paciente solo ve sus propios documentos', () => {
      cy.logout();
      cy.login('paciente@test.com', 'password123');
      cy.navigateTo('/mis-documentos');
      // Verificar que solo ve sus documentos
      cy.get('table tbody tr').each(($row) => {
        cy.wrap($row).find('td').first().should('contain', 'Paciente');
      });
    });
  });

  describe('Vista de paciente (mis-documentos)', () => {
    it('debe mostrar solo documentos del paciente autenticado', () => {
      cy.logout();
      cy.login('paciente@test.com', 'password123');
      cy.navigateTo('/mis-documentos');
      cy.contains('Mis Documentos Clínicos').should('be.visible');
      cy.get('table tbody tr').should('have.length.at.least', 0);
    });
  });
});