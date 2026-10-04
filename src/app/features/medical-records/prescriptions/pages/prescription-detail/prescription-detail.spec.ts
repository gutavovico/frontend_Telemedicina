import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Injector, runInInjectionContext, signal, type DestroyableInjector } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../../../core/services/auth.service';
import { PrescriptionsService } from '../../services/prescriptions.service';
import { PrescriptionDetail } from './prescription-detail';
import { RecetaResponse } from '../../models/prescription.models';
import type { AppRole } from '../../../../../core/models/auth.models';
import type { MedicoResponse } from '../../../../../core/models/medico.models';

function perfilMedico(idMedico: number): MedicoResponse {
  return {
    id_medico: idMedico,
    id_usuario: 7,
    matricula_profesional: 'MAT-00007',
    estado: 'activo',
    fecha_registro: '2026-01-01',
    especialidades: [],
  };
}

function recetaBase(
  estado: 'EMITIDA' | 'ANULADA' = 'EMITIDA',
  vencida = false,
  idMedico = 1,
): RecetaResponse {
  return {
    id_receta: 5,
    id_clinica: 1,
    id_consulta: 1,
    id_paciente: 1,
    id_medico: idMedico,
    id_documento: 1,
    id_receta_sustituta: null,
    folio: 'REC-5',
    pdf_url: '',
    indicaciones_generales: null,
    algoritmo_firma: 'ED25519',
    key_id: 'k',
    version_payload: 1,
    hash_pdf: 'h',
    fecha_emision: '2026-01-01',
    fecha_vencimiento: '2026-02-01',
    esta_vencida: vencida,
    estado,
    motivo_anulacion: null,
    observaciones_anulacion: null,
    fecha_anulacion: null,
    medico: {
      id_medico: idMedico,
      nombre_completo: 'M',
      matricula_profesional: 'X',
      especialidad: null,
    },
    paciente: { id_paciente: 1, nombre_completo: 'P' },
    detalles: [],
  } as RecetaResponse;
}

describe('PrescriptionDetail (CU16)', () => {
  const serviceMock = {
    getPrescription: vi.fn(),
    downloadPdf: vi.fn(),
    resolvePdfFilename: vi.fn(() => 'receta_REC-5.pdf'),
    saveBlob: vi.fn(),
  };
  const routerMock = { navigate: vi.fn() };
  let authMock: {
    userRole: ReturnType<typeof vi.fn>;
    isLoggedIn: ReturnType<typeof vi.fn>;
    perfilMedico: ReturnType<typeof signal<MedicoResponse | null>>;
  };
  let injector: DestroyableInjector;

  function create(
    role: AppRole,
    idParam: string | null,
    perfil: MedicoResponse | null = null,
  ): PrescriptionDetail {
    authMock = {
      userRole: vi.fn(() => role),
      isLoggedIn: vi.fn(() => true),
      perfilMedico: signal(perfil),
    };
    const routeMock = { snapshot: { paramMap: { get: vi.fn(() => idParam) } } };
    injector = Injector.create({
      providers: [
        { provide: PrescriptionsService, useValue: serviceMock },
        { provide: AuthService, useValue: authMock },
        { provide: Router, useValue: routerMock },
        { provide: ActivatedRoute, useValue: routeMock },
      ],
    });
    return runInInjectionContext(injector, () => new PrescriptionDetail());
  }

  beforeEach(() => {
    vi.clearAllMocks();
    serviceMock.getPrescription.mockReturnValue(of(recetaBase()));
    serviceMock.downloadPdf.mockReturnValue(
      of(new HttpResponse({ status: 200, body: new Blob() })),
    );
  });

  it('id inválido muestra error sin llamar al backend', () => {
    const comp = create('doctor', 'no-numerico');
    comp.ngOnInit();
    expect(comp.errorMessage()).toBe('Identificador de receta inválido.');
    injector.destroy();
  });

  it('anular visible solo para médico emisor con receta emitida y vigente', () => {
    const emisor = create('doctor', '5', perfilMedico(1));
    emisor.ngOnInit();
    expect(emisor.canCancel()).toBe(true);
    injector.destroy();

    serviceMock.getPrescription.mockReturnValueOnce(of(recetaBase('EMITIDA', false, 1)));
    const noEmisor = create('doctor', '5', perfilMedico(2));
    noEmisor.ngOnInit();
    expect(noEmisor.canCancel()).toBe(false);
    injector.destroy();

    serviceMock.getPrescription.mockReturnValueOnce(of(recetaBase('EMITIDA', false, 1)));
    const sinPerfil = create('doctor', '5', null);
    sinPerfil.ngOnInit();
    expect(sinPerfil.canCancel()).toBe(false);
    injector.destroy();
  });

  it('anular visible para ADMIN real aunque no sea el emisor', () => {
    const admin = create('admin', '5', null);
    admin.ngOnInit();
    expect(admin.canCancel()).toBe(true);
    injector.destroy();
  });

  it('anular oculta para paciente, receta anulada o vencida', () => {
    serviceMock.getPrescription.mockReturnValueOnce(of(recetaBase()));
    const paciente = create('paciente', '5', null);
    paciente.ngOnInit();
    expect(paciente.canCancel()).toBe(false);
    injector.destroy();

    serviceMock.getPrescription.mockReturnValueOnce(of(recetaBase('ANULADA')));
    const anulada = create('admin', '5', null);
    anulada.ngOnInit();
    expect(anulada.canCancel()).toBe(false);
    injector.destroy();

    serviceMock.getPrescription.mockReturnValueOnce(of(recetaBase('EMITIDA', true)));
    const vencida = create('admin', '5', null);
    vencida.ngOnInit();
    expect(vencida.canCancel()).toBe(false);
    injector.destroy();
  });

  it('descarga visible con receta cargada y rol reconocido; oculta sin receta o rol desconocido', () => {
    const doctor = create('doctor', '5', perfilMedico(9));
    doctor.ngOnInit();
    expect(doctor.canDownload()).toBe(true);
    injector.destroy();

    serviceMock.getPrescription.mockReturnValueOnce(of(recetaBase()));
    const paciente = create('paciente', '5', null);
    paciente.ngOnInit();
    expect(paciente.canDownload()).toBe(true);
    injector.destroy();

    serviceMock.getPrescription.mockReturnValueOnce(of(recetaBase()));
    const admin = create('admin', '5', null);
    admin.ngOnInit();
    expect(admin.canDownload()).toBe(true);
    injector.destroy();

    serviceMock.getPrescription.mockReturnValueOnce(of(recetaBase()));
    const desconocido = create('unknown', '5', null);
    desconocido.ngOnInit();
    expect(desconocido.canDownload()).toBe(false);
    injector.destroy();

    const sinReceta = create('doctor', '5', perfilMedico(1));
    expect(sinReceta.canDownload()).toBe(false);
    injector.destroy();
  });

  it('descarga usa nombre seguro y maneja 403 aunque la acción estuviera visible', () => {
    const comp = create('doctor', '5', perfilMedico(1));
    comp.ngOnInit();
    comp.descargarPdf();
    expect(serviceMock.downloadPdf).toHaveBeenCalledWith(5);
    expect(serviceMock.saveBlob).toHaveBeenCalled();
    injector.destroy();

    serviceMock.downloadPdf.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 403, error: { detail: 'x' } })),
    );
    const sinPermiso = create('paciente', '5', null);
    sinPermiso.ngOnInit();
    expect(sinPermiso.canDownload()).toBe(true);
    sinPermiso.descargarPdf();
    expect(sinPermiso.downloadError()).toContain('403');
    injector.destroy();
  });

  it('al confirmar anulación refresca la boleta y su estado', () => {
    const comp = create('doctor', '5', perfilMedico(1));
    comp.ngOnInit();
    comp.abrirAnulacion();
    expect(comp.cancelOpen()).toBe(true);
    comp.alAnularConfirmada(recetaBase('ANULADA'));
    expect(comp.receta()?.estado).toBe('ANULADA');
    expect(comp.cancelOpen()).toBe(false);
    injector.destroy();
  });
});
