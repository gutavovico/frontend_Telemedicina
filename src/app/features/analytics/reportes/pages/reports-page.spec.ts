import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../../core/services/auth.service';
import { ReportExportService } from '../../exportacion/services/report-export.service';
import { ReportInterpretResponse, ReportQuery, ReportQueryResponse } from '../models/report.models';
import { ReportsService } from '../services/reports.service';
import { ReportVoiceCaptureService } from '../services/report-voice-capture.service';
import { catalogFixture, optionsFixture, queryFixture, responseFixture } from '../testing/report-fixtures';
import { ReportsPage } from './reports-page';

const citaDefinition: ReportQuery = {
  reporte: 'citas', periodo: { desde: '2026-09-01', hasta: '2026-09-30' },
  filtros: [{ campo: 'estado', operador: 'eq', valor: 'CANCELADA' }],
  columnas: ['fecha', 'citas'], agrupacion: ['fecha'],
  orden: [{ campo: 'fecha', direccion: 'desc' }], pagina: 1, tamano_pagina: 20,
};

function interpreted(definicion: ReportQuery): ReportInterpretResponse {
  return { estado: 'valida', definicion, resumen: 'Reporte interpretado.',
    campos_aclaracion: [], advertencias: ['Ausentismo no disponible: SIN_ESTADO_AUSENCIA.'] };
}

describe('CU22/CU27 pantalla de reportes', () => {
  let page: ReportsPage;
  let fixture: ComponentFixture<ReportsPage>;
  let root: HTMLElement;
  let auth: {
    userRole: WritableSignal<string>;
    profileVerified: WritableSignal<boolean>;
    currentUser: WritableSignal<{ rol: string; estado: string; id_clinica: number }>;
    isAuthenticated: WritableSignal<boolean>;
    isAdmin: WritableSignal<boolean>;
    isDoctor: WritableSignal<boolean>;
    isPaciente: WritableSignal<boolean>;
    logout: ReturnType<typeof vi.fn>;
    userPhoto: WritableSignal<null>;
    userDisplayName: WritableSignal<string>;
    userInitials: WritableSignal<string>;
  };
  let reports: {
    catalog: ReturnType<typeof vi.fn>;
    options: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
    interpret: ReturnType<typeof vi.fn>;
    transcribe: ReturnType<typeof vi.fn>;
  };
  let voiceCapture: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };
  let exporter: {
    export: ReturnType<typeof vi.fn>;
    filename: ReturnType<typeof vi.fn>;
    download: ReturnType<typeof vi.fn>;
    errorMessage: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    reports = {
      catalog: vi.fn(() => of(catalogFixture)),
      options: vi.fn(() => of(optionsFixture)),
      query: vi.fn((definition: ReportQuery): Observable<ReportQueryResponse> => of(responseFixture(definition))),
      interpret: vi.fn((): Observable<ReportInterpretResponse> => of({
        estado: 'valida', definicion: queryFixture, resumen: 'Encuentros de septiembre.',
        campos_aclaracion: [], advertencias: ['Ausentismo no disponible: SIN_ESTADO_AUSENCIA.'],
      })),
      transcribe: vi.fn(() => of({ texto: 'Encuentros de septiembre de 2026' })),
    };
    voiceCapture = {
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => ({ blob: new Blob(['audio'], { type: 'audio/webm' }), filename: 'dictado.webm' })),
      cancel: vi.fn(),
    };
    exporter = {
      export: vi.fn(() => of(new HttpResponse({ body: new Blob(['report']) }))),
      filename: vi.fn(() => 'reporte.pdf'),
      download: vi.fn(),
      errorMessage: vi.fn(async () => 'Reduce el período o ajusta filtros y agrupaciones.'),
    };
    auth = {
      currentUser: signal({ rol: 'ADMIN', estado: 'ACTIVO', id_clinica: 12 }),
      isAuthenticated: signal(true), profileVerified: signal(true), userRole: signal('admin'),
      isAdmin: signal(true), isDoctor: signal(false), isPaciente: signal(false), logout: vi.fn(),
      userPhoto: signal(null), userDisplayName: signal('Administrador'), userInitials: signal('AD'),
    };
    await TestBed.configureTestingModule({
      imports: [ReportsPage], providers: [provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ReportsService, useValue: reports },
        { provide: ReportVoiceCaptureService, useValue: voiceCapture },
        { provide: ReportExportService, useValue: exporter },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ReportsPage);
    page = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  function enableAutoSend(): HTMLInputElement {
    const option = root.querySelector('input[aria-describedby="report-auto-send-help"]') as HTMLInputElement;
    expect(option.checked).toBe(false);
    option.click();
    fixture.detectChanges();
    expect(page.sendWhenStopped()).toBe(true);
    return option;
  }

  it('carga catálogo y opciones y presenta controles etiquetados', () => {
    expect(reports.catalog).toHaveBeenCalledOnce();
    expect(reports.options).toHaveBeenCalledOnce();
    expect(page.currentReport()?.id).toBe('encuentros');
    for (const id of ['report-type', 'report-from', 'report-to', 'report-doctor',
      'report-specialty', 'report-modality', 'report-page-size']) {
      expect(root.querySelector(`label[for="${id}"]`)).not.toBeNull();
    }
    expect(root.querySelector('app-header')).not.toBeNull();
    expect(root.querySelector('app-footer')).not.toBeNull();
  });

  it('muestra enlace Reportes solo con perfil ADMIN activo ya verificado', () => {
    expect(root.querySelector('a[href="/analitica"]')).not.toBeNull();
    auth.profileVerified.set(false);
    fixture.detectChanges();
    expect(root.querySelector('a[href="/analitica"]')).toBeNull();
    auth.profileVerified.set(true);
    auth.userRole.set('doctor');
    fixture.detectChanges();
    expect(root.querySelector('a[href="/analitica"]')).toBeNull();
    auth.userRole.set('admin');
    auth.currentUser.set({ rol: 'ADMIN', estado: 'INACTIVO', id_clinica: 12 });
    fixture.detectChanges();
    expect(root.querySelector('a[href="/analitica"]')).toBeNull();
    auth.isAuthenticated.set(false);
  });

  it('limpia configuración incompatible al cambiar de reporte', () => {
    page.toggleGroup('modalidad');
    page.toggleColumn('pacientes_unicos');
    page.form.controls.modalidad.setValue('TELEMEDICINA');
    page.sortChoice.set('pacientes_unicos');
    page.addSort();
    page.form.controls.reporte.setValue('citas');
    page.onReportChange();
    expect(page.groups()).toEqual([]);
    expect(page.columns()).toEqual(['citas']);
    expect(page.sorts()).toEqual([]);
    expect(page.form.controls.modalidad.value).toBe('');
    expect(page.currentReport()?.id).toBe('citas');
  });

  it('consulta columnas, grupos, orden y filtros; pagina con definición normalizada', () => {
    page.form.patchValue({ desde: '2026-09-01', hasta: '2026-09-30', id_medico: '7' });
    page.toggleGroup('fecha');
    page.toggleColumn('pacientes_unicos');
    page.moveColumn('fecha', -1);
    page.sortChoice.set('fecha');
    page.sortDirection.set('desc');
    page.addSort();
    page.generate();
    const sent = reports.query.mock.calls[0][0] as ReportQuery;
    expect(sent).toMatchObject({
      reporte: 'encuentros', filtros: [{ campo: 'id_medico', operador: 'eq', valor: 7 }],
      columnas: ['fecha', 'encuentros', 'pacientes_unicos'], agrupacion: ['fecha'],
      orden: [{ campo: 'fecha', direccion: 'desc' }], pagina: 1,
    });
    expect(sent).not.toHaveProperty('id_clinica');
    expect(page.result()?.metricas['pacientes_unicos'].valor).toBe(2);
    expect(page.result()?.filas.reduce((sum, row) => sum + Number(row['pacientes_unicos']), 0)).toBe(3);
    fixture.detectChanges();
    expect(root.textContent).toContain('No disponible');
    expect(root.textContent).not.toContain('0 %');
    expect(root.querySelector('.overflow-x-auto > .report-table')).not.toBeNull();
    page.result.set({ ...responseFixture(sent), total: 40 });
    page.changePage(2);
    expect((reports.query.mock.calls[1][0] as ReportQuery).pagina).toBe(2);
  });

  it('descarta respuesta antigua y distingue datos vacíos de error', () => {
    const oldResponse = new Subject<ReportQueryResponse>();
    const newResponse = new Subject<ReportQueryResponse>();
    reports.query.mockReturnValueOnce(oldResponse).mockReturnValueOnce(newResponse);
    page.generate();
    page.form.controls.desde.setValue('2026-09-02');
    page.generate();
    oldResponse.next(responseFixture());
    expect(page.result()).toBeNull();
    const definition = reports.query.mock.calls[1][0] as ReportQuery;
    newResponse.next({ ...responseFixture(definition), total: 0, filas: [] });
    expect(page.result()?.total).toBe(0);
    expect(page.result()?.definicion.periodo.desde).toBe('2026-09-02');
    page.form.controls.desde.setValue('2026-09-03');
    reports.query.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403 })));
    page.generate();
    expect(page.queryError()).toContain('permiso');
  });

  it('exporta los cuatro formatos de la definición generada y bloquea cambios pendientes', () => {
    page.generate();
    const definition = page.result()!.definicion;
    for (const format of catalogFixture.formatos) page.export(format);
    expect(exporter.export.mock.calls.map((call) => call[1])).toEqual(catalogFixture.formatos);
    for (const call of exporter.export.mock.calls) expect(call[0]).toEqual(definition);
    expect(exporter.download).toHaveBeenCalledTimes(4);
    page.form.controls.desde.setValue('2026-09-02');
    expect(page.dirty()).toBe(true);
    expect(page.canExport()).toBe(false);
    page.export('pdf');
    expect(exporter.export).toHaveBeenCalledTimes(4);
  });

  it('mantiene la descarga bloqueada mientras prepara y restaura el control ante 413', async () => {
    page.generate();
    const response = new Subject<HttpResponse<Blob>>();
    exporter.export.mockReturnValueOnce(response);
    page.export('xlsx');
    expect(page.exporting()).toBe('xlsx');
    page.export('xlsx');
    expect(exporter.export).toHaveBeenCalledOnce();
    response.error(new HttpErrorResponse({ status: 413 }));
    await Promise.resolve();
    expect(page.exporting()).toBeNull();
    expect(page.exportError()).toContain('Reduce el período');
  });

  it('retira resultados visibles si la API revoca el acceso al paginar', () => {
    page.generate();
    page.result.set({ ...page.result()!, total: 40 });
    reports.query.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 401 })));
    page.changePage(2);
    expect(page.result()).toBeNull();
    expect(page.queryError()).toContain('sesión');
  });

  it('Enviar y Enter interpretan y generan con la definición devuelta', () => {
    page.textRequest.setValue('Encuentros de septiembre de 2026 por fecha');
    fixture.detectChanges();
    (root.querySelector('button[aria-label="Enviar solicitud y generar reporte"]') as HTMLButtonElement).click();
    expect(reports.interpret).toHaveBeenCalledOnce();
    const payload = reports.interpret.mock.calls[0][0] as Record<string, string>;
    expect(payload['texto']).toBe(page.textRequest.value);
    expect(payload['fecha_referencia']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload).not.toHaveProperty('id_clinica');
    expect(reports.query).toHaveBeenCalledWith(queryFixture);
    expect(page.result()?.definicion).toEqual(queryFixture);
    expect(page.interpretation()?.resumen).toBe('Encuentros de septiembre.');

    const textarea = root.querySelector('#report-request') as HTMLTextAreaElement;
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }));
    expect(reports.interpret).toHaveBeenCalledOnce();
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(reports.interpret).toHaveBeenCalledTimes(2);
    expect(reports.query).toHaveBeenCalledTimes(2);
  });

  it('Aplicar filtros reemplaza el reporte completo sin consultar y bloquea la exportación anterior', () => {
    page.form.patchValue({ id_medico: '7', modalidad: 'TELEMEDICINA' });
    page.generate();
    expect(page.canExport()).toBe(true);
    reports.interpret.mockReturnValue(of(interpreted(citaDefinition)));
    page.textRequest.setValue('Cancelaciones de septiembre de 2026');
    page.interpretText(false);
    expect(reports.query).toHaveBeenCalledOnce();
    expect(page.form.getRawValue()).toMatchObject({
      reporte: 'citas', desde: '2026-09-01', hasta: '2026-09-30',
      id_medico: '', id_especialidad: '', estado: 'CANCELADA', modalidad: '',
    });
    expect(page.columns()).toEqual(citaDefinition.columnas);
    expect(page.groups()).toEqual(citaDefinition.agrupacion);
    expect(page.sorts()).toEqual(citaDefinition.orden);
    expect(page.dirty()).toBe(true);
    expect(page.canExport()).toBe(false);
    fixture.detectChanges();
    expect(root.querySelector('#result-title')?.textContent).toContain('Encuentros');
    page.generate();
    expect(reports.query).toHaveBeenCalledTimes(2);
    expect(page.canExport()).toBe(true);
    page.interpretText(false);
    expect(page.dirty()).toBe(false);
    expect(page.canExport()).toBe(true);
    expect(reports.query).toHaveBeenCalledTimes(2);
  });

  it('aclaración y rechazo mantienen controles y texto sin consultar', () => {
    const before = page.form.getRawValue();
    reports.interpret.mockReturnValueOnce(of({ estado: 'aclaracion', definicion: null,
      resumen: 'Indica el año.', campos_aclaracion: ['periodo'], advertencias: [] }))
      .mockReturnValueOnce(of({ estado: 'no_admitida', definicion: null,
        resumen: 'Ausentismo no disponible.', campos_aclaracion: [],
        advertencias: ['SIN_ESTADO_AUSENCIA'] }));
    page.textRequest.setValue('Citas de septiembre');
    page.interpretText(true);
    expect(page.form.getRawValue()).toEqual(before);
    expect(page.textRequest.value).toBe('Citas de septiembre');
    expect(reports.query).not.toHaveBeenCalled();
    fixture.detectChanges();
    expect(root.textContent).toContain('Período');
    page.interpretText(false);
    expect(page.form.getRawValue()).toEqual(before);
    expect(reports.query).not.toHaveBeenCalled();
    expect(page.interpretation()?.estado).toBe('no_admitida');
  });

  it('rechaza una definición válida mal representada sin aplicar filtros parciales', () => {
    const before = page.form.getRawValue();
    reports.interpret.mockReturnValueOnce(of(interpreted({ ...citaDefinition,
      filtros: [...citaDefinition.filtros, { campo: 'campo_oculto', operador: 'eq', valor: 'x' }],
    })));
    page.textRequest.setValue('Citas de septiembre de 2026');
    page.interpretText(true);
    expect(page.form.getRawValue()).toEqual(before);
    expect(page.interpretError()).toContain('catálogo');
    expect(reports.query).not.toHaveBeenCalled();
  });

  it('un error del proveedor deja disponible la generación manual', () => {
    reports.interpret.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));
    page.textRequest.setValue('Encuentros de septiembre de 2026');
    page.interpretText(true);
    expect(page.interpretError()).toContain('filtros manuales');
    expect(reports.query).not.toHaveBeenCalled();
    page.generate();
    expect(reports.query).toHaveBeenCalledOnce();
  });

  it('impide envíos duplicados y descarta interpretación atrasada tras edición y cambio de cuenta', () => {
    const pending = new Subject<ReportInterpretResponse>();
    reports.interpret.mockReturnValueOnce(pending);
    page.textRequest.setValue('Citas de septiembre de 2026');
    page.interpretText(true);
    page.interpretText(true);
    expect(reports.interpret).toHaveBeenCalledOnce();
    page.form.controls.desde.setValue('2026-09-02');
    pending.next(interpreted(citaDefinition));
    expect(page.form.controls.reporte.value).toBe('encuentros');
    expect(reports.query).not.toHaveBeenCalled();

    const later = new Subject<ReportInterpretResponse>();
    reports.interpret.mockReturnValueOnce(later);
    page.form.controls.id_medico.setValue('7');
    page.interpretText(true);
    auth.isAuthenticated.set(false);
    fixture.detectChanges();
    later.next(interpreted(citaDefinition));
    expect(page.result()).toBeNull();
    expect(page.interpretation()).toBeNull();
    expect(page.form.controls.id_medico.value).toBe('');
    expect(page.textRequest.value).toBe('');
    expect(reports.query).not.toHaveBeenCalled();
  });

  it('graba, detiene y añade dictado al texto previo sin interpretar ni consultar', async () => {
    page.textRequest.setValue('Reporte de');
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('recording'));
    expect(page.recordingDuration()).toBe('00:00');
    page.interpretText(true);
    page.interpretText(false);
    expect(reports.interpret).not.toHaveBeenCalled();
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('idle'));
    expect(reports.transcribe).toHaveBeenCalledOnce();
    expect(page.textRequest.value).toBe('Reporte de Encuentros de septiembre de 2026');
    expect(reports.interpret).not.toHaveBeenCalled();
    expect(reports.query).not.toHaveBeenCalled();
    expect(voiceCapture.stop).toHaveBeenCalledOnce();
  });

  it('conserva ediciones hechas durante la transcripción y ofrece incorporación explícita', async () => {
    const pending = new Subject<{ texto: string }>();
    reports.transcribe.mockReturnValueOnce(pending);
    page.textRequest.setValue('Citas de');
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('recording'));
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('transcribing'));
    page.textRequest.setValue('Texto corregido por la persona');
    pending.next({ texto: 'septiembre de 2026' });
    expect(page.textRequest.value).toBe('Texto corregido por la persona');
    expect(page.pendingTranscript()).toBe('septiembre de 2026');
    expect(reports.interpret).not.toHaveBeenCalled();
    page.incorporatePendingTranscript();
    expect(page.textRequest.value).toBe('Texto corregido por la persona septiembre de 2026');
    expect(page.pendingTranscript()).toBeNull();
  });

  it('muestra fallo de permiso y descarta respuestas tras cambio de cuenta o salida', async () => {
    voiceCapture.start.mockRejectedValueOnce(new Error('Permiso de micrófono denegado.'));
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('idle'));
    expect(page.voiceError()).toContain('Permiso');
    const pending = new Subject<{ texto: string }>();
    reports.transcribe.mockReturnValueOnce(pending);
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('recording'));
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('transcribing'));
    auth.isAuthenticated.set(false);
    fixture.detectChanges();
    pending.next({ texto: 'resultado atrasado' });
    expect(page.textRequest.value).toBe('');
    expect(page.pendingTranscript()).toBeNull();
    expect(voiceCapture.cancel).toHaveBeenCalled();
    page.ngOnDestroy();
    expect(page.voiceState()).toBe('idle');
  });

  it('limpia solo el texto y su interpretación; conserva filtros, resultado, página y exportación', () => {
    page.form.controls.id_medico.setValue('7');
    page.generate();
    page.result.set({ ...page.result()!, total: 40 });
    page.changePage(2);
    const beforeForm = page.form.getRawValue();
    const beforeResult = page.result();
    const beforeColumns = page.columns();
    const beforeGroups = page.groups();
    const beforeSorts = page.sorts();
    page.exporting.set('pdf');
    page.textRequest.setValue('Citas de septiembre de 2026');
    page.interpretation.set({ estado: 'aclaracion', definicion: null,
      resumen: 'Indica el período.', campos_aclaracion: ['periodo'], advertencias: [] });
    page.interpretError.set('Mensaje de interpretación');
    fixture.detectChanges();
    const clear = root.querySelector('button[aria-label="Limpiar texto"]') as HTMLButtonElement;
    expect(clear.title).toBe('Limpiar texto');
    expect(clear.tabIndex).toBeGreaterThanOrEqual(0);
    expect(clear.disabled).toBe(false);
    const textarea = root.querySelector('#report-request') as HTMLTextAreaElement;
    clear.click();
    fixture.detectChanges();
    expect(textarea.value).toBe('');
    expect(document.activeElement).toBe(textarea);
    expect(root.querySelector('button[aria-label="Limpiar texto"]')).toBeNull();
    expect(page.interpretation()).toBeNull();
    expect(page.interpretError()).toBeNull();
    expect(page.form.getRawValue()).toEqual(beforeForm);
    expect(page.result()).toBe(beforeResult);
    expect(page.result()?.definicion.pagina).toBe(2);
    expect(page.columns()).toBe(beforeColumns);
    expect(page.groups()).toBe(beforeGroups);
    expect(page.sorts()).toBe(beforeSorts);
    expect(page.exporting()).toBe('pdf');
    expect(reports.interpret).not.toHaveBeenCalled();
    expect(reports.query).toHaveBeenCalledTimes(2);
    expect(exporter.export).not.toHaveBeenCalled();
  });

  it('bloquea Limpiar durante grabación, transcripción, interpretación y generación', () => {
    page.textRequest.setValue('Encuentros de septiembre de 2026');
    for (const state of ['requesting', 'recording', 'transcribing'] as const) {
      page.voiceState.set(state);
      fixture.detectChanges();
      const clear = root.querySelector('button[aria-label="Limpiar texto"]') as HTMLButtonElement;
      expect(clear.disabled).toBe(true);
      clear.click();
      expect(page.textRequest.value).not.toBe('');
    }
    page.voiceState.set('idle');
    page.interpreting.set(true);
    fixture.detectChanges();
    expect((root.querySelector('button[aria-label="Limpiar texto"]') as HTMLButtonElement).disabled).toBe(true);
    page.interpreting.set(false);
    page.loadingReport.set(true);
    fixture.detectChanges();
    expect((root.querySelector('button[aria-label="Limpiar texto"]') as HTMLButtonElement).disabled).toBe(true);
    page.loadingReport.set(false);
    page.pendingTranscript.set('texto pendiente');
    fixture.detectChanges();
    expect((root.querySelector('button[aria-label="Limpiar texto"]') as HTMLButtonElement).disabled).toBe(true);
    page.clearText();
    expect(page.textRequest.value).not.toBe('');
    page.discardPendingTranscript();
    fixture.detectChanges();
    expect((root.querySelector('button[aria-label="Limpiar texto"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('descarta una interpretación atrasada si se borra el texto mientras se espera', () => {
    const pending = new Subject<ReportInterpretResponse>();
    reports.interpret.mockReturnValueOnce(pending);
    page.textRequest.setValue('Citas de septiembre de 2026');
    page.interpretText(true);
    expect(page.interpreting()).toBe(true);
    // La X está bloqueada durante la interpretación; el usuario aún puede editar el cuadro.
    page.textRequest.setValue('');
    pending.next(interpreted(citaDefinition));
    expect(page.interpretation()).toBeNull();
    expect(page.form.controls.reporte.value).toBe('encuentros');
    expect(reports.query).not.toHaveBeenCalled();
    expect(page.result()).toBeNull();
  });

  it('Enviar al terminar empieza apagado y se bloquea durante captura, interpretación y generación', async () => {
    const option = root.querySelector('input[aria-describedby="report-auto-send-help"]') as HTMLInputElement;
    expect(option.checked).toBe(false);
    expect(root.querySelector('#report-auto-send-help')?.textContent).toContain('transcribe y genera');
    enableAutoSend();
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('recording'));
    fixture.detectChanges();
    expect(option.disabled).toBe(true);
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('idle'));
    page.interpreting.set(true);
    fixture.detectChanges();
    expect(option.disabled).toBe(true);
    page.interpreting.set(false);
    page.loadingReport.set(true);
    fixture.detectChanges();
    expect(option.disabled).toBe(true);
    page.loadingReport.set(false);
    fixture.detectChanges();
    expect(option.disabled).toBe(false);
  });

  it('detención explícita con opción activa usa Enviar una sola vez y conserva texto previo', async () => {
    enableAutoSend();
    page.textRequest.setValue('Reporte de');
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('recording'));
    page.toggleRecording();
    page.toggleRecording();
    await vi.waitFor(() => expect(reports.query).toHaveBeenCalledOnce());
    expect(page.textRequest.value).toBe('Reporte de Encuentros de septiembre de 2026');
    expect(voiceCapture.stop).toHaveBeenCalledOnce();
    expect(reports.transcribe).toHaveBeenCalledOnce();
    expect(reports.interpret).toHaveBeenCalledOnce();
    expect(reports.query).toHaveBeenCalledWith(queryFixture);
    expect(page.result()?.definicion).toEqual(queryFixture);
  });

  it('captura la opción al iniciar y procesa una sola transcripción', async () => {
    enableAutoSend();
    const transcription = new Subject<{ texto: string }>();
    reports.transcribe.mockReturnValueOnce(transcription);
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('recording'));
    page.sendWhenStopped.set(false);
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('transcribing'));
    const option = root.querySelector('input[aria-describedby="report-auto-send-help"]') as HTMLInputElement;
    fixture.detectChanges();
    expect(option.disabled).toBe(true);
    transcription.next({ texto: 'Encuentros de septiembre de 2026' });
    transcription.next({ texto: 'Citas de septiembre de 2026' });
    expect(page.textRequest.value).toBe('Encuentros de septiembre de 2026');
    expect(reports.interpret).toHaveBeenCalledOnce();
    expect(reports.query).toHaveBeenCalledOnce();
  });

  it.each(['aclaracion', 'no_admitida'] as const)(
    'detiene el autoenvío ante %s sin aplicar controles ni consultar', async (estado) => {
      enableAutoSend();
      const before = page.form.getRawValue();
      reports.interpret.mockReturnValueOnce(of({ estado, definicion: null,
        resumen: 'Revisa la solicitud.', campos_aclaracion: estado === 'aclaracion' ? ['periodo'] : [],
        advertencias: [] }));
      page.toggleRecording();
      await vi.waitFor(() => expect(page.voiceState()).toBe('recording'));
      page.toggleRecording();
      await vi.waitFor(() => expect(reports.interpret).toHaveBeenCalledOnce());
      expect(reports.query).not.toHaveBeenCalled();
      expect(page.form.getRawValue()).toEqual(before);
      expect(page.interpretation()?.estado).toBe(estado);
    },
  );

  it('no envía si el texto cambia durante el dictado aunque vuelva al valor anterior', async () => {
    enableAutoSend();
    page.textRequest.setValue('Reporte de');
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('recording'));
    page.textRequest.setValue('Editado');
    page.textRequest.setValue('Reporte de');
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('idle'));
    expect(page.textRequest.value).toBe('Reporte de');
    expect(page.pendingTranscript()).toBe('Encuentros de septiembre de 2026');
    expect(page.voiceNotice()).toContain('manualmente');
    expect(reports.interpret).not.toHaveBeenCalled();
    page.incorporatePendingTranscript();
    expect(page.textRequest.value).toContain('Encuentros de septiembre de 2026');
    expect(reports.interpret).not.toHaveBeenCalled();
  });

  it('no envía si el texto o los filtros cambian durante la transcripción', async () => {
    enableAutoSend();
    const pending = new Subject<{ texto: string }>();
    reports.transcribe.mockReturnValueOnce(pending);
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('recording'));
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('transcribing'));
    page.textRequest.setValue('Texto propio');
    page.form.controls.id_medico.setValue('7');
    pending.next({ texto: 'Encuentros de septiembre de 2026' });
    expect(page.pendingTranscript()).toBe('Encuentros de septiembre de 2026');
    expect(reports.interpret).not.toHaveBeenCalled();
    expect(reports.query).not.toHaveBeenCalled();
  });

  it('conserva texto para revisión sin autoenvío si cambian solo los filtros', async () => {
    enableAutoSend();
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('recording'));
    page.form.controls.id_medico.setValue('7');
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('idle'));
    expect(page.textRequest.value).toBe('Encuentros de septiembre de 2026');
    expect(page.voiceNotice()).toContain('manualmente');
    expect(reports.interpret).not.toHaveBeenCalled();
  });

  it('no envía al detenerse por el límite de duración', async () => {
    enableAutoSend();
    let tick: (() => void) | null = null;
    const interval = vi.spyOn(globalThis, 'setInterval').mockImplementation((callback, delay) => {
      if (delay === 1000) tick = callback as () => void;
      return 42 as ReturnType<typeof setInterval>;
    });
    const clear = vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => undefined);
    try {
      page.toggleRecording();
      await vi.waitFor(() => expect(page.voiceState()).toBe('recording'));
      for (let second = 0; second < 60; second++) tick!();
      await vi.waitFor(() => expect(page.voiceState()).toBe('idle'));
      expect(voiceCapture.stop).toHaveBeenCalledOnce();
      expect(reports.transcribe).toHaveBeenCalledOnce();
      expect(page.textRequest.value).toBe('Encuentros de septiembre de 2026');
      expect(reports.interpret).not.toHaveBeenCalled();
      expect(page.voiceNotice()).toContain('manualmente');
    } finally {
      interval.mockRestore();
      clear.mockRestore();
    }
  });

  it('no envía ante audio vacío, error, cambio de cuenta o salida', async () => {
    enableAutoSend();
    reports.transcribe.mockReturnValueOnce(of({ texto: '  ' }));
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('recording'));
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('idle'));
    expect(reports.interpret).not.toHaveBeenCalled();
    reports.transcribe.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('recording'));
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('idle'));
    expect(reports.interpret).not.toHaveBeenCalled();

    const pending = new Subject<{ texto: string }>();
    reports.transcribe.mockReturnValueOnce(pending);
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('recording'));
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('transcribing'));
    auth.isAuthenticated.set(false);
    fixture.detectChanges();
    pending.next({ texto: 'Citas de septiembre de 2026' });
    expect(reports.interpret).not.toHaveBeenCalled();
    expect(page.sendWhenStopped()).toBe(false);
    page.ngOnDestroy();
    expect(voiceCapture.cancel).toHaveBeenCalled();
  });

  it('no envía una transcripción que llega después de abandonar la pantalla', async () => {
    enableAutoSend();
    const pending = new Subject<{ texto: string }>();
    reports.transcribe.mockReturnValueOnce(pending);
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('recording'));
    page.toggleRecording();
    await vi.waitFor(() => expect(page.voiceState()).toBe('transcribing'));
    page.ngOnDestroy();
    pending.next({ texto: 'Citas de septiembre de 2026' });
    expect(reports.interpret).not.toHaveBeenCalled();
    expect(reports.query).not.toHaveBeenCalled();
    expect(voiceCapture.cancel).toHaveBeenCalled();
  });
});
