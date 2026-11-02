/// <reference types="cypress" />

describe('CU17 - Gestionar y Monitorear Tratamiento Médico: Cronograma y Registro de Dosis', () => {
  const mockPlan = {
    id_tratamiento: 15,
    id_clinica: 1,
    id_consulta: 42,
    id_receta: 81,
    id_diagnostico: 54,
    diagnostico: {
      codigo_cie: 'J02.9',
      descripcion: 'Faringitis aguda, no especificada',
    },
    id_paciente: 10,
    id_medico: 3,
    fecha_inicio: '2026-11-01',
    fecha_fin: '2026-11-14',
    zona_horaria: 'America/La_Paz',
    estado: 'ACTIVO',
    notas: 'Tomar con abundante agua',
    motivo_cierre: null,
    medicamentos: [
      {
        id_medicamento_plan: 31,
        id_receta_detalle: 121,
        medicamento_nombre: 'Amoxicilina 500mg',
        dosis: '1 cápsula cada 8 horas',
        via_administracion: 'Oral',
        frecuencia_texto_receta: 'Cada 8 horas',
        duracion_texto_receta: '7 días',
        indicaciones: 'Con alimentos',
        fecha_inicio: '2026-11-01',
        fecha_fin: '2026-11-07',
        horas_locales: ['06:00', '14:00', '22:00'],
        intervalo_horas: 8,
        estado: 'ACTIVO',
      },
    ],
    created_at: '2026-10-30T08:00:00Z',
    updated_at: '2026-10-30T08:00:00Z',
    adherencia: {
      numerador_puntual: 2,
      denominador_programado: 3,
      porcentaje: 66.7,
      nivel: 'REGULAR',
      calculado_en: '2026-11-01T14:30:00Z',
    },
  };

  const mockCronogramaInicial = {
    id_tratamiento: 15,
    fecha: '2026-11-01',
    zona_horaria: 'America/La_Paz',
    dosis: [
      {
        id_dosis: 901,
        id_medicamento_plan: 31,
        programada_en: '2026-11-01T10:00:00Z',
        programada_hora_local: '06:00',
        zona_horaria: 'America/La_Paz',
        estado: 'INGERIDA',
        vencida: false,
        efectiva_en: '2026-11-01T10:05:00Z',
        registrada_en: '2026-11-01T10:06:00Z',
        puntual: true,
        nota: 'Sin efectos secundarios',
      },
      {
        id_dosis: 902,
        id_medicamento_plan: 31,
        programada_en: '2026-11-01T18:00:00Z',
        programada_hora_local: '14:00',
        zona_horaria: 'America/La_Paz',
        estado: 'PENDIENTE',
        vencida: false,
        efectiva_en: null,
        registrada_en: null,
        puntual: false,
        nota: null,
      },
      {
        id_dosis: 903,
        id_medicamento_plan: 31,
        programada_en: '2026-11-02T02:00:00Z',
        programada_hora_local: '22:00',
        zona_horaria: 'America/La_Paz',
        estado: 'PENDIENTE',
        vencida: false,
        efectiva_en: null,
        registrada_en: null,
        puntual: false,
        nota: null,
      },
    ],
    adherencia: {
      numerador_puntual: 1,
      denominador_programado: 2,
      porcentaje: 50.0,
      nivel: 'REGULAR',
      calculado_en: '2026-11-01T18:30:00Z',
    },
  };

  const setupPatientSession = () => {
    localStorage.setItem('access_token', 'mock-patient-access-token');
    localStorage.setItem(
      'user_profile',
      JSON.stringify({
        id_usuario: 10,
        nombres: 'Carlos',
        apellidos: 'Mamani',
        correo: 'paciente@test.com',
        rol: 'PACIENTE',
        estado: 'ACTIVO',
      }),
    );
    localStorage.setItem('remember_me', 'true');
  };

  const setupDoctorSession = () => {
    localStorage.setItem('access_token', 'mock-doctor-access-token');
    localStorage.setItem(
      'user_profile',
      JSON.stringify({
        id_usuario: 3,
        nombres: 'Dr. Alejandro',
        apellidos: 'Vargas',
        correo: 'medico@test.com',
        rol: 'MEDICO',
        estado: 'ACTIVO',
      }),
    );
    localStorage.setItem('remember_me', 'true');
  };

  beforeEach(() => {
    // Interceptar llamadas base de auth
    cy.intercept('GET', '**/auth/me', {
      statusCode: 200,
      body: {
        id_usuario: 10,
        nombres: 'Carlos',
        apellidos: 'Mamani',
        correo: 'paciente@test.com',
        rol: 'PACIENTE',
        estado: 'ACTIVO',
      },
    }).as('getAuthMe');

    cy.intercept('GET', '**/medicos/me', {
      statusCode: 404,
      body: { detail: 'No es médico' },
    }).as('getMedicosMe');

    // Interceptar fase 1 de intento durable para protocolo CU17
    cy.intercept('POST', '**/api/v1/tratamientos/dosis/*/intentos', {
      statusCode: 200,
      body: {
        estado: 'EN_CURSO',
        confirmado: false,
        en_curso: true,
        rechazado: false,
        generacion: 1,
      },
    }).as('postIntento');
  });

  describe('1. Acceso y visualización del cronograma diario por paciente titular', () => {
    beforeEach(() => {
      setupPatientSession();

      cy.intercept('GET', '**/api/v1/tratamientos/15', {
        statusCode: 200,
        body: mockPlan,
      }).as('getPlan');

      cy.intercept('GET', '**/api/v1/tratamientos/15/cronograma?fecha=*', {
        statusCode: 200,
        body: mockCronogramaInicial,
      }).as('getCronograma');
    });

    it('debe mostrar el cronograma del día con métricas de adherencia y lista de tomas', () => {
      cy.visit('/tratamientos/15/cronograma');

      cy.wait('@getPlan');
      cy.wait('@getCronograma');

      // Título y contexto del tratamiento
      cy.contains('h1', 'Cronograma Diario y Registro de Tomas').should('be.visible');
      cy.contains('Tratamiento #15').should('be.visible');
      cy.contains('Faringitis aguda, no especificada').should('be.visible');

      // Métrica de adherencia calculada
      cy.contains('50.0%').should('be.visible');
      cy.contains('1 / 2 tomas puntuales').should('be.visible');
      cy.contains('REGULAR').should('be.visible');

      // Lista de dosis
      cy.contains('Dosis Programadas del Día').should('be.visible');
      cy.contains('06:00').should('be.visible');
      cy.contains('14:00').should('be.visible');
      cy.contains('22:00').should('be.visible');
      cy.contains('Amoxicilina 500mg').should('be.visible');

      // Estados de las dosis
      cy.contains('INGERIDA').should('be.visible');
      cy.contains('PENDIENTE').should('be.visible');

      // Botón "Registrar toma" disponible solo para dosis pendientes
      cy.contains('button', 'Registrar toma').should('be.visible');
    });

    it('debe permitir navegar entre días en el cronograma', () => {
      cy.visit('/tratamientos/15/cronograma');
      cy.wait('@getCronograma');

      // Cambiar a día anterior
      cy.contains('button', 'Día anterior').click();
      cy.wait('@getCronograma').its('request.url').should('include', 'fecha=');

      // Regresar a hoy
      cy.contains('button', 'Hoy').click();
      cy.wait('@getCronograma');
    });
  });

  describe('2. Flujo E2E de registro exitoso de toma con Idempotency-Key', () => {
    beforeEach(() => {
      setupPatientSession();

      cy.intercept('GET', '**/api/v1/tratamientos/15', {
        statusCode: 200,
        body: mockPlan,
      }).as('getPlan');

      cy.intercept('GET', '**/api/v1/tratamientos/15/cronograma?fecha=*', {
        statusCode: 200,
        body: mockCronogramaInicial,
      }).as('getCronograma');
    });

    it('debe registrar una toma exitosamente enviando Idempotency-Key y recargando el cronograma', () => {
      let capturedIdempotencyKey: string | null = null;

      const mockCronogramaActualizado = {
        ...mockCronogramaInicial,
        dosis: [
          mockCronogramaInicial.dosis[0],
          {
            ...mockCronogramaInicial.dosis[1],
            estado: 'INGERIDA',
            efectiva_en: '2026-11-01T18:05:00Z',
            registrada_en: '2026-11-01T18:06:00Z',
            puntual: true,
            nota: 'Toma registrada a tiempo con comida',
          },
          mockCronogramaInicial.dosis[2],
        ],
        adherencia: {
          numerador_puntual: 2,
          denominador_programado: 2,
          porcentaje: 100.0,
          nivel: 'OPTIMA',
          calculado_en: '2026-11-01T18:10:00Z',
        },
      };

      // Interceptar POST de registro de dosis
      cy.intercept('POST', '**/api/v1/tratamientos/dosis/902/registros', (req) => {
        capturedIdempotencyKey = req.headers['idempotency-key'] as string;
        expect(capturedIdempotencyKey).to.be.a('string');
        expect(capturedIdempotencyKey?.length).to.be.at.least(8);

        expect(req.body.estado).to.equal('INGERIDA');
        expect(req.body.efectiva_en).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
        expect(req.body.nota).to.equal('Toma registrada a tiempo con comida');

        req.reply({
          statusCode: 200,
          body: {
            id_dosis: 902,
            id_medicamento_plan: 31,
            programada_en: '2026-11-01T18:00:00Z',
            programada_hora_local: '14:00',
            zona_horaria: 'America/La_Paz',
            estado: 'INGERIDA',
            vencida: false,
            efectiva_en: req.body.efectiva_en,
            registrada_en: '2026-11-01T18:06:00Z',
            puntual: true,
            nota: req.body.nota,
          },
        });
      }).as('postRegistroDosis');

      cy.visit('/tratamientos/15/cronograma');
      cy.wait('@getCronograma');

      // Abrir modal de toma para la dosis de las 14:00 (id 902)
      cy.contains('button', 'Registrar toma').first().click();

      // Modal abierto
      cy.contains('h3', 'Registrar Toma de Medicamento').should('be.visible');
      cy.contains('Amoxicilina 500mg').should('be.visible');
      cy.contains('14:00').should('be.visible');

      // Estado por defecto: Ingerida
      cy.contains('button', 'Ingerida').should('be.visible');

      // Agregar nota clínica opcional
      cy.get('textarea').clear().type('Toma registrada a tiempo con comida');

      // Preparar interceptor del cronograma actualizado para la recarga posterior
      cy.intercept('GET', '**/api/v1/tratamientos/15/cronograma?fecha=*', {
        statusCode: 200,
        body: mockCronogramaActualizado,
      }).as('getCronogramaActualizado');

      // Confirmar guardado
      cy.contains('button', 'Guardar registro').click();

      cy.wait('@postRegistroDosis');
      cy.wait('@getCronogramaActualizado');

      // Toast de éxito
      cy.contains('Toma registrada exitosamente.').should('be.visible');

      // Modal debe haberse cerrado
      cy.contains('h3', 'Registrar Toma de Medicamento').should('not.exist');

      // Verificar actualización en la vista
      cy.contains('100.0%').should('be.visible');
      cy.contains('OPTIMA').should('be.visible');
      cy.contains('2 / 2 tomas puntuales').should('be.visible');
    });
  });

  describe('3. Idempotencia y reconciliación ante fallo de red / error 500', () => {
    beforeEach(() => {
      setupPatientSession();

      cy.intercept('GET', '**/api/v1/tratamientos/15', {
        statusCode: 200,
        body: mockPlan,
      }).as('getPlan');

      cy.intercept('GET', '**/api/v1/tratamientos/15/cronograma?fecha=*', {
        statusCode: 200,
        body: mockCronogramaInicial,
      }).as('getCronograma');
    });

    it('debe conservar la misma Idempotency-Key al reintentar tras fallo 500 o timeout', () => {
      let callCount = 0;
      let firstKey = '';
      let secondKey = '';

      cy.intercept('POST', '**/api/v1/tratamientos/dosis/902/registros', (req) => {
        callCount++;
        if (callCount === 1) {
          firstKey = req.headers['idempotency-key'] as string;
          // Simula error transitorio de servidor o timeout de base de datos
          req.reply({
            statusCode: 500,
            body: {
              detail: 'Fallo transitorio de conexión con la base de datos.',
              code: 'DATABASE_TIMEOUT',
            },
          });
        } else {
          secondKey = req.headers['idempotency-key'] as string;
          // Éxito en el reintento usando el mismo Idempotency-Key
          req.reply({
            statusCode: 200,
            body: {
              id_dosis: 902,
              id_medicamento_plan: 31,
              programada_en: '2026-11-01T18:00:00Z',
              programada_hora_local: '14:00',
              zona_horaria: 'America/La_Paz',
              estado: 'INGERIDA',
              vencida: false,
              efectiva_en: '2026-11-01T18:00:00Z',
              registrada_en: '2026-11-01T18:01:00Z',
              puntual: true,
              nota: 'Reintento exitoso',
            },
          });
        }
      }).as('postRegistroDosisFlaky');

      cy.visit('/tratamientos/15/cronograma');
      cy.wait('@getCronograma');

      // Abrir modal
      cy.contains('button', 'Registrar toma').first().click();
      cy.get('textarea').clear().type('Reintento exitoso');

      // Primer intento -> falla con 500
      cy.contains('button', 'Guardar registro').click();
      cy.wait('@postRegistroDosisFlaky');

      // Mensaje de error visible en el modal sin cerrarse
      cy.contains('Fallo transitorio de conexión con la base de datos.').should('be.visible');
      cy.contains('h3', 'Registrar Toma de Medicamento').should('be.visible');

      // Reintento por el paciente (hace clic nuevamente en "Guardar registro")
      cy.contains('button', 'Guardar registro').click();
      cy.wait('@postRegistroDosisFlaky').then(() => {
        // Validación crítica del protocolo de idempotencia: ambas peticiones usan la MISMA clave
        expect(callCount).to.equal(2);
        expect(firstKey).to.be.a('string');
        expect(secondKey).to.equal(firstKey);
      });

      // Debe cerrarse el modal y mostrar toast de éxito
      cy.contains('Toma registrada exitosamente.').should('be.visible');
      cy.contains('h3', 'Registrar Toma de Medicamento').should('not.exist');
    });

    it('debe prevenir doble envío deshabilitando el botón mientras se procesa la solicitud', () => {
      // Retardar la respuesta para verificar estado de guardado
      cy.intercept('POST', '**/api/v1/tratamientos/dosis/902/registros', (req) => {
        req.on('response', (res) => {
          res.setDelay(1000);
        });
        req.reply({
          statusCode: 200,
          body: {
            id_dosis: 902,
            id_medicamento_plan: 31,
            programada_en: '2026-11-01T18:00:00Z',
            programada_hora_local: '14:00',
            zona_horaria: 'America/La_Paz',
            estado: 'INGERIDA',
            vencida: false,
            efectiva_en: '2026-11-01T18:00:00Z',
            registrada_en: '2026-11-01T18:01:00Z',
            puntual: true,
            nota: null,
          },
        });
      }).as('postRegistroDosisLento');

      cy.visit('/tratamientos/15/cronograma');
      cy.wait('@getCronograma');

      cy.contains('button', 'Registrar toma').first().click();

      // Al hacer clic, el botón se bloquea inmediatamente para evitar race conditions
      cy.contains('button', 'Guardar registro').click();
      cy.contains('Guardando...').should('be.visible');
      cy.contains('button', 'Guardando...').should('be.disabled');
      cy.contains('button', 'Cancelar').should('be.disabled');

      cy.wait('@postRegistroDosisLento');
      cy.contains('Toma registrada exitosamente.').should('be.visible');
    });
  });

  describe('4. Reglas de negocio y validación clínica de tomas', () => {
    beforeEach(() => {
      setupPatientSession();

      cy.intercept('GET', '**/api/v1/tratamientos/15', {
        statusCode: 200,
        body: mockPlan,
      }).as('getPlan');

      cy.intercept('GET', '**/api/v1/tratamientos/15/cronograma?fecha=*', {
        statusCode: 200,
        body: mockCronogramaInicial,
      }).as('getCronograma');
    });

    it('no debe permitir omitir una toma futura antes de su hora programada', () => {
      cy.visit('/tratamientos/15/cronograma');
      cy.wait('@getCronograma');

      // Abrir modal de toma de las 22:00 (dosis 903, futura)
      cy.get('.divide-y > div').last().within(() => {
        cy.contains('button', 'Registrar toma').click();
      });

      // Seleccionar estado "Omitida"
      cy.contains('button', 'Omitida').click();

      // Mensaje de advertencia en modal
      cy.contains('Solo se puede omitir una toma a partir de su hora programada.').should('be.visible');

      // Botón "Guardar registro" debe estar deshabilitado
      cy.contains('button', 'Guardar registro').should('be.disabled');
    });
  });

  describe('5. Control de acceso por rol clínico (Médico vs Paciente)', () => {
    it('médico tratante puede consultar cronograma y adherencia pero NO registrar tomas del paciente', () => {
      setupDoctorSession();

      cy.intercept('GET', '**/auth/me', {
        statusCode: 200,
        body: {
          id_usuario: 3,
          nombres: 'Dr. Alejandro',
          apellidos: 'Vargas',
          correo: 'medico@test.com',
          rol: 'MEDICO',
          estado: 'ACTIVO',
        },
      }).as('getAuthMeDoctor');

      cy.intercept('GET', '**/medicos/me', {
        statusCode: 200,
        body: {
          id_medico: 3,
          id_usuario: 3,
          nombres: 'Dr. Alejandro',
          apellidos: 'Vargas',
          especialidad: 'Medicina General',
        },
      }).as('getPerfilMedico');

      cy.intercept('GET', '**/api/v1/tratamientos/15', {
        statusCode: 200,
        body: mockPlan,
      }).as('getPlanDoctor');

      cy.intercept('GET', '**/api/v1/tratamientos/15/cronograma?fecha=*', {
        statusCode: 200,
        body: mockCronogramaInicial,
      }).as('getCronogramaDoctor');

      cy.visit('/tratamientos/15/cronograma');
      cy.wait('@getCronogramaDoctor');

      // El médico visualiza el cronograma y adherencia
      cy.contains('Cronograma Diario y Registro de Tomas').should('be.visible');
      cy.contains('50.0%').should('be.visible');
      cy.contains('Amoxicilina 500mg').should('be.visible');

      // El médico NO ve botones de registrar tomas (reservado al paciente titular según CU17)
      cy.contains('button', 'Registrar toma').should('not.exist');
    });

    it('usuario no autenticado es redirigido a /login al intentar acceder al cronograma', () => {
      localStorage.clear();

      cy.visit('/tratamientos/15/cronograma');
      cy.url().should('include', '/login');
      cy.url().should('include', 'returnUrl');
    });
  });

  describe('6. Recuperación segura y purga clínica tras cierre de sesión (CU17 / CU23)', () => {
    beforeEach(() => {
      setupPatientSession();

      cy.intercept('GET', '**/api/v1/tratamientos/15', {
        statusCode: 200,
        body: mockPlan,
      }).as('getPlanRecovery');

      cy.intercept('GET', '**/api/v1/tratamientos/15/cronograma?fecha=*', {
        statusCode: 200,
        body: mockCronogramaInicial,
      }).as('getCronogramaRecovery');
    });

    it('detecta marcador mínimo opaco y reconcilia consultando api simulada de idempotencia', () => {
      // Simular que el usuario reingresa y tiene en localStorage el marcador mínimo opaco (sin cuerpo clínico)
      localStorage.setItem(
        'cu17_recovery_10_1_902',
        JSON.stringify({
          id_dosis: 902,
          id_tratamiento: 15,
          idempotency_key: 'idem-recuperacion-e2e',
          timestamp: Date.now(),
          id_usuario: 10,
          id_clinica: 1,
        })
      );

      // Simular endpoint de verificación de idempotencia
      cy.intercept('GET', '**/api/v1/tratamientos/dosis/902/registros/idempotencia/idem-recuperacion-e2e', {
        statusCode: 200,
        body: {
          confirmado: true,
          id_dosis: 902,
          idempotency_key: 'idem-recuperacion-e2e',
          dosis: {
            id_dosis: 902,
            id_medicamento_plan: 31,
            programada_en: '2026-11-01T18:00:00Z',
            programada_hora_local: '14:00',
            zona_horaria: 'America/La_Paz',
            estado: 'INGERIDA',
            vencida: false,
            efectiva_en: '2026-11-01T18:05:00Z',
            registrada_en: '2026-11-01T18:06:00Z',
            puntual: true,
            nota: 'Confirmada',
          },
        },
      }).as('getIdempotencia');

      cy.visit('/tratamientos/15/cronograma');
      cy.wait('@getCronogramaRecovery');

      // Al abrir la toma de las 14:00, se detecta el marcador opaco y se reconcilia
      cy.contains('button', 'Registrar toma').first().click();

      // Debe consultar el endpoint simulado de idempotencia
      cy.wait('@getIdempotencia');

      // Notificación de éxito y purga del marcador en almacenamiento
      cy.contains('Operación previa confirmada en el servidor.').should('be.visible');
    });
  });
});
