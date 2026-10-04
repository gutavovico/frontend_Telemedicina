import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subscription, forkJoin, take } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { Footer } from '../../../../shared/components/footer/footer';
import { Header } from '../../../../shared/components/header/header';
import { ReportExportService } from '../../exportacion/services/report-export.service';
import { APPOINTMENT_STATES, ReportDraft, buildReportDefinition, reportFieldLabel, sameReportConfiguration } from '../models/report-definition';
import { CatalogReport, ReportCatalog, ReportCell, ReportFormat, ReportInterpretResponse, ReportOptions, ReportQuery, ReportQueryResponse, ReportSort } from '../models/report.models';
import { ReportsService } from '../services/reports.service';
import { ReportVoiceCaptureService } from '../services/report-voice-capture.service';

type DraftControls = {
  [Key in keyof ReportDraft]: FormControl<ReportDraft[Key]>;
};

function localDate(date: Date): string {
  const year = date.getFullYear();
  return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Header, Footer],
  templateUrl: './reports-page.html',
  styleUrl: './reports-page.css',
})
export class ReportsPage implements OnInit, OnDestroy {
  @ViewChild('requestTextarea') private requestTextarea?: ElementRef<HTMLTextAreaElement>;
  private readonly reports = inject(ReportsService);
  private readonly voiceCapture = inject(ReportVoiceCaptureService);
  private readonly exporter = inject(ReportExportService);
  private readonly auth = inject(AuthService);
  private readonly subscriptions = new Subscription();
  private activeQuery: Subscription | null = null;
  private activeExport: Subscription | null = null;
  private activeInterpret: Subscription | null = null;
  private activeCatalog: Subscription | null = null;
  private activeTranscription: Subscription | null = null;
  private pendingDefinition: ReportQuery | null = null;
  private requestVersion = 0;
  private interpretVersion = 0;
  private catalogVersion = 0;
  private exportVersion = 0;
  private sessionKey: string | null = null;
  private destroyed = false;
  private voiceVersion = 0;
  private voiceContextVersion = 0;
  private textEditVersion = 0;
  private voiceAutoSendAtStart = false;
  private voiceContextAtStart = 0;
  private voiceTimer: ReturnType<typeof setInterval> | null = null;

  private readonly today = new Date();
  private readonly initialDate = new Date(this.today.getFullYear(), this.today.getMonth(), this.today.getDate() - 29);
  readonly form = new FormGroup<DraftControls>({
    reporte: new FormControl('', { nonNullable: true }),
    desde: new FormControl(localDate(this.initialDate), { nonNullable: true }),
    hasta: new FormControl(localDate(this.today), { nonNullable: true }),
    id_medico: new FormControl('', { nonNullable: true }),
    id_especialidad: new FormControl('', { nonNullable: true }),
    estado: new FormControl('', { nonNullable: true }),
    modalidad: new FormControl('', { nonNullable: true }),
    tamano_pagina: new FormControl(20, { nonNullable: true }),
  });
  readonly textRequest = new FormControl('', { nonNullable: true });
  readonly hasTextRequest = signal(false);
  readonly hasAnyText = signal(false);

  readonly catalog = signal<ReportCatalog | null>(null);
  readonly options = signal<ReportOptions | null>(null);
  readonly selectedReportId = signal('');
  readonly currentReport = computed<CatalogReport | undefined>(() =>
    this.catalog()?.reportes.find((report) => report.id === this.selectedReportId()));
  readonly resultReport = computed<CatalogReport | undefined>(() =>
    this.catalog()?.reportes.find((report) => report.id === this.result()?.definicion.reporte));
  readonly columns = signal<string[]>([]);
  readonly groups = signal<string[]>([]);
  readonly sorts = signal<ReportSort[]>([]);
  readonly sortChoice = signal('');
  readonly sortDirection = signal<'asc' | 'desc'>('asc');
  readonly result = signal<ReportQueryResponse | null>(null);
  readonly loadingCatalog = signal(true);
  readonly loadingReport = signal(false);
  readonly exporting = signal<ReportFormat | null>(null);
  readonly interpreting = signal(false);
  readonly interpretation = signal<ReportInterpretResponse | null>(null);
  readonly interpretError = signal<string | null>(null);
  readonly voiceState = signal<'idle' | 'requesting' | 'recording' | 'transcribing'>('idle');
  readonly voiceSeconds = signal(0);
  readonly voiceError = signal<string | null>(null);
  readonly voiceNotice = signal<string | null>(null);
  readonly pendingTranscript = signal<string | null>(null);
  readonly sendWhenStopped = signal(false);
  readonly dirty = signal(false);
  readonly catalogError = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly queryError = signal<string | null>(null);
  readonly exportError = signal<string | null>(null);
  readonly pageCount = computed(() => {
    const result = this.result();
    return result ? Math.ceil(result.total / result.definicion.tamano_pagina) : 0;
  });
  readonly canExport = computed(() => !!this.result() && !this.dirty() &&
    !this.loadingReport() && !this.interpreting() && this.exporting() === null);
  readonly canClearText = computed(() => this.hasAnyText() && this.voiceState() === 'idle' &&
    !this.interpreting() && !this.loadingReport() && this.pendingTranscript() === null);
  readonly canToggleAutoSend = computed(() => this.voiceState() === 'idle' &&
    !this.interpreting() && !this.loadingReport() && !this.loadingCatalog());
  readonly states = APPOINTMENT_STATES;

  constructor() {
    effect(() => {
      const key = this.sessionFingerprint();
      if (this.sessionKey !== null && key !== this.sessionKey) {
        this.cancelVoice();
        this.pendingTranscript.set(null);
        this.sendWhenStopped.set(false);
        this.voiceNotice.set(null);
        this.invalidateInterpretation();
        this.invalidateRequest();
        this.activeCatalog?.unsubscribe();
        this.catalogVersion++;
        this.activeExport?.unsubscribe();
        this.exportVersion++;
        this.exporting.set(null);
        this.result.set(null);
        this.dirty.set(false);
        this.interpretation.set(null);
        this.interpretError.set(null);
        this.textRequest.setValue('', { emitEvent: false });
        this.hasTextRequest.set(false);
        this.hasAnyText.set(false);
        this.catalog.set(null);
        this.options.set(null);
        this.selectedReportId.set('');
        this.columns.set([]);
        this.groups.set([]);
        this.sorts.set([]);
        this.sortChoice.set('');
        this.form.patchValue({
          reporte: '', id_medico: '', id_especialidad: '', estado: '', modalidad: '',
          desde: localDate(this.initialDate), hasta: localDate(this.today), tamano_pagina: 20,
        }, { emitEvent: false });
        this.formError.set(null);
        this.queryError.set(null);
        this.exportError.set(null);
        if (this.auth.isAuthenticated() && this.auth.profileVerified() &&
            this.auth.userRole() === 'admin' && this.auth.currentUser()?.id_clinica) {
          this.loadCatalog();
        } else {
          this.loadingCatalog.set(false);
          this.catalogError.set('Inicia sesión con una cuenta ADMIN activa para consultar reportes.');
        }
      }
      this.sessionKey = key;
    });
  }

  ngOnInit(): void {
    this.subscriptions.add(this.form.valueChanges.subscribe(() => this.markDraftChanged()));
    this.subscriptions.add(this.textRequest.valueChanges.subscribe(() => {
      this.textEditVersion++;
      this.hasTextRequest.set(!!this.textRequest.value.trim());
      this.hasAnyText.set(this.textRequest.value.length > 0);
      this.invalidateInterpretation();
      this.interpretation.set(null);
      this.interpretError.set(null);
    }));
    this.loadCatalog();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.cancelVoice();
    this.invalidateInterpretation();
    this.requestVersion++;
    this.activeQuery?.unsubscribe();
    this.activeExport?.unsubscribe();
    this.activeCatalog?.unsubscribe();
    this.catalogVersion++;
    this.exportVersion++;
    this.subscriptions.unsubscribe();
  }

  loadCatalog(): void {
    this.voiceContextVersion++;
    this.activeCatalog?.unsubscribe();
    const version = ++this.catalogVersion;
    const session = this.sessionFingerprint();
    this.loadingCatalog.set(true);
    this.catalogError.set(null);
    this.activeCatalog = forkJoin({
      catalog: this.reports.catalog(),
      options: this.reports.options(),
    }).subscribe({
      next: ({ catalog, options }) => {
        if (this.destroyed || version !== this.catalogVersion || session !== this.sessionFingerprint()) return;
        this.catalog.set(catalog);
        this.options.set(options);
        if (catalog.reportes.length > 0) {
          const first = catalog.reportes[0];
          this.form.controls.reporte.setValue(first.id, { emitEvent: false });
          this.selectedReportId.set(first.id);
          this.columns.set([first.metrica_principal]);
        } else {
          this.catalogError.set('No hay tipos de reporte disponibles para esta cuenta.');
        }
        this.loadingCatalog.set(false);
      },
      error: (error: HttpErrorResponse) => {
        if (this.destroyed || version !== this.catalogVersion || session !== this.sessionFingerprint()) return;
        this.loadingCatalog.set(false);
        this.catalogError.set(this.accessError(error) ?? 'No se pudo cargar el catálogo de reportes.');
      },
    });
  }

  onReportChange(): void {
    this.voiceContextVersion++;
    this.invalidateInterpretation();
    this.interpretation.set(null);
    this.activeExport?.unsubscribe();
    this.exportVersion++;
    this.exporting.set(null);
    const report = this.catalog()?.reportes.find((item) => item.id === this.form.controls.reporte.value);
    this.selectedReportId.set(report?.id ?? '');
    this.form.patchValue({ id_medico: '', id_especialidad: '', estado: '', modalidad: '' }, { emitEvent: false });
    this.groups.set([]);
    this.sorts.set([]);
    this.columns.set(report ? [report.metrica_principal] : []);
    this.sortChoice.set('');
    this.result.set(null);
    this.dirty.set(false);
    this.formError.set(null);
    this.queryError.set(null);
    this.invalidateRequest();
  }

  hasFilter(field: string): boolean {
    return this.currentReport()?.filtros.some((filter) => filter.campo === field) ?? false;
  }

  toggleGroup(field: string): void {
    const report = this.currentReport();
    const catalog = this.catalog();
    if (!report || !catalog || !report.dimensiones.includes(field)) return;
    if (this.groups().includes(field)) {
      this.groups.update((groups) => groups.filter((item) => item !== field));
      this.columns.update((columns) => columns.filter((item) => item !== field));
      this.sorts.update((sorts) => sorts.filter((item) => item.campo !== field));
    } else if (this.groups().length < catalog.limites.agrupaciones &&
               this.columns().length < catalog.limites.columnas) {
      this.groups.update((groups) => [...groups, field]);
      this.columns.update((columns) => [...columns, field]);
    } else {
      this.formError.set('Se alcanzó el límite de agrupaciones o columnas.');
      return;
    }
    this.formError.set(null);
    this.markDraftChanged();
  }

  toggleColumn(field: string): void {
    const report = this.currentReport();
    const catalog = this.catalog();
    if (!report || !catalog || !report.columnas.includes(field) ||
        field === report.metrica_principal || report.dimensiones.includes(field)) return;
    if (this.columns().includes(field)) {
      this.columns.update((columns) => columns.filter((item) => item !== field));
      this.sorts.update((sorts) => sorts.filter((item) => item.campo !== field));
    } else if (this.columns().length < catalog.limites.columnas) {
      this.columns.update((columns) => [...columns, field]);
    } else {
      this.formError.set('Se alcanzó el límite de columnas.');
      return;
    }
    this.formError.set(null);
    this.markDraftChanged();
  }

  moveColumn(field: string, step: number): void {
    const columns = [...this.columns()];
    const index = columns.indexOf(field);
    const target = index + step;
    if (index < 0 || target < 0 || target >= columns.length) return;
    [columns[index], columns[target]] = [columns[target], columns[index]];
    this.columns.set(columns);
    this.markDraftChanged();
  }

  addSort(): void {
    const field = this.sortChoice();
    if (!field || !this.columns().includes(field) || this.sorts().some((item) => item.campo === field)) return;
    this.sorts.update((items) => [...items, { campo: field, direccion: this.sortDirection() }]);
    this.sortChoice.set('');
    this.markDraftChanged();
  }

  removeSort(field: string): void {
    this.sorts.update((items) => items.filter((item) => item.campo !== field));
    this.markDraftChanged();
  }

  clearFilters(): void {
    this.form.patchValue({ id_medico: '', id_especialidad: '', estado: '', modalidad: '' });
    this.formError.set(null);
  }

  clearText(): void {
    if (!this.canClearText()) return;
    this.textRequest.setValue('');
    this.voiceNotice.set(null);
    // valueChanges invalidates in-flight interpretation and its messages.
    if (typeof window !== 'undefined') this.requestTextarea?.nativeElement.focus();
  }

  onTextKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    this.interpretText(true);
  }

  interpretText(generateAfter: boolean): void {
    if (this.voiceState() !== 'idle' || this.interpreting() || this.loadingReport() ||
        this.loadingCatalog() ||
        !this.catalog() || !this.options()) return;
    const texto = this.textRequest.value.trim();
    if (!texto || texto.length > 1000) {
      this.interpretError.set('Escribe una solicitud de hasta 1000 caracteres.');
      return;
    }
    this.voiceContextVersion++;
    this.voiceNotice.set(null);
    this.invalidateRequest();
    this.activeExport?.unsubscribe();
    this.exportVersion++;
    this.exporting.set(null);
    this.invalidateInterpretation();
    const version = this.interpretVersion;
    const session = this.sessionFingerprint();
    this.interpretation.set(null);
    this.interpretError.set(null);
    this.interpreting.set(true);
    this.activeInterpret = this.reports.interpret({
      texto, fecha_referencia: localDate(new Date()),
    }).subscribe({
      next: (response) => {
        if (this.destroyed || version !== this.interpretVersion || session !== this.sessionFingerprint()) return;
        this.interpreting.set(false);
        if (response.estado === 'valida') {
          if (!response.definicion || !this.applyInterpretedDefinition(response.definicion)) {
            this.interpretError.set('La definición recibida no coincide con el catálogo. Usa los filtros manuales.');
            return;
          }
          this.interpretation.set(response);
          if (generateAfter) {
            this.dirty.set(false);
            this.result.set(null);
            this.fetchPage(response.definicion);
          }
        } else if (response.estado === 'aclaracion' || response.estado === 'no_admitida') {
          this.interpretation.set(response);
        } else {
          this.interpretError.set('La respuesta de interpretación no es válida. Usa los filtros manuales.');
        }
      },
      error: (error: HttpErrorResponse) => {
        if (this.destroyed || version !== this.interpretVersion || session !== this.sessionFingerprint()) return;
        this.interpreting.set(false);
        this.interpretError.set(this.interpretationError(error));
      },
    });
  }

  toggleRecording(): void {
    if (this.voiceState() === 'recording') {
      void this.stopRecording(true);
      return;
    }
    if (!this.auth.isAuthenticated() || !this.auth.profileVerified() ||
        this.auth.userRole() !== 'admin' || !this.catalog() || this.interpreting() ||
        this.loadingReport() || this.pendingTranscript() !== null) return;
    if (this.voiceState() === 'idle') {
      void this.startRecording();
    }
  }

  onSendWhenStoppedChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!this.canToggleAutoSend()) {
      input.checked = this.sendWhenStopped();
      return;
    }
    this.sendWhenStopped.set(input.checked);
  }

  recordingDuration(): string {
    const seconds = this.voiceSeconds();
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  incorporatePendingTranscript(): void {
    const transcript = this.pendingTranscript();
    if (transcript && this.appendTranscript(transcript)) {
      this.pendingTranscript.set(null);
      this.voiceNotice.set(null);
    }
  }

  discardPendingTranscript(): void {
    this.pendingTranscript.set(null);
    this.voiceNotice.set(null);
  }

  private async startRecording(): Promise<void> {
    const version = ++this.voiceVersion;
    const session = this.sessionFingerprint();
    const editVersion = this.textEditVersion;
    this.voiceAutoSendAtStart = this.sendWhenStopped();
    this.voiceContextAtStart = this.voiceContextVersion;
    this.voiceError.set(null);
    this.voiceNotice.set(null);
    this.voiceSeconds.set(0);
    this.voiceState.set('requesting');
    try {
      await this.voiceCapture.start(() => {
        if (version !== this.voiceVersion || this.destroyed) return;
        this.cancelVoice();
        this.voiceError.set('La grabación se interrumpió. Puedes escribir la solicitud.');
      });
      if (this.destroyed || version !== this.voiceVersion || session !== this.sessionFingerprint()) {
        this.voiceCapture.cancel();
        return;
      }
      this.voiceState.set('recording');
      this.voiceTimer = setInterval(() => {
        this.voiceSeconds.update((seconds) => seconds + 1);
        if (this.voiceSeconds() >= 60) void this.stopRecording(false, editVersion);
      }, 1000);
      this.voiceEditAtStart = editVersion;
    } catch (error) {
      if (version !== this.voiceVersion || this.destroyed) return;
      this.voiceState.set('idle');
      this.voiceError.set(error instanceof Error ? error.message : 'No se pudo iniciar el micrófono.');
    }
  }

  private voiceEditAtStart = 0;

  private async stopRecording(explicitStop: boolean, editVersion = this.voiceEditAtStart): Promise<void> {
    if (this.voiceState() !== 'recording') return;
    this.stopVoiceTimer();
    this.voiceState.set('transcribing');
    const version = this.voiceVersion;
    const session = this.sessionFingerprint();
    try {
      const recording = await this.voiceCapture.stop();
      if (this.destroyed || version !== this.voiceVersion || session !== this.sessionFingerprint()) return;
      if (recording.blob.size > 5 * 1024 * 1024) {
        throw new Error('El audio supera 5 MiB. Graba una solicitud más breve.');
      }
      this.activeTranscription = this.reports.transcribe(recording.blob, recording.filename).pipe(take(1)).subscribe({
        next: (response) => {
          if (this.destroyed || version !== this.voiceVersion || session !== this.sessionFingerprint()) return;
          this.voiceState.set('idle');
          const transcript = response.texto?.trim();
          if (!transcript) {
            this.voiceError.set('La transcripción no produjo texto. Reintenta o escribe la solicitud.');
          } else if (editVersion !== this.textEditVersion || this.pendingTranscript() !== null) {
            const pending = this.pendingTranscript();
            this.pendingTranscript.set(pending ? `${pending} ${transcript}` : transcript);
            this.voiceNotice.set('Revisa el dictado pendiente y envía la solicitud manualmente.');
          } else if (!this.appendTranscript(transcript)) {
            this.pendingTranscript.set(transcript);
            this.voiceNotice.set('Reduce el texto, incorpora el dictado y envía manualmente.');
          } else if (this.voiceAutoSendAtStart) {
            if (explicitStop && this.voiceContextAtStart === this.voiceContextVersion &&
                this.pendingTranscript() === null && !this.loadingReport() && !this.interpreting() &&
                this.catalog() && this.options() && this.auth.isAuthenticated() &&
                this.auth.profileVerified() && this.auth.userRole() === 'admin') {
              this.interpretText(true);
            } else {
              this.voiceNotice.set('Revisa la transcripción y envía la solicitud manualmente.');
            }
          }
        },
        error: (error: HttpErrorResponse) => {
          if (this.destroyed || version !== this.voiceVersion || session !== this.sessionFingerprint()) return;
          this.voiceState.set('idle');
          this.voiceError.set(this.transcriptionError(error));
        },
      });
    } catch (error) {
      if (this.destroyed || version !== this.voiceVersion || session !== this.sessionFingerprint()) return;
      this.voiceCapture.cancel();
      this.voiceState.set('idle');
      this.voiceError.set(error instanceof Error ? error.message : 'No se pudo transcribir el audio.');
    }
  }

  private appendTranscript(transcript: string): boolean {
    const previous = this.textRequest.value.trim();
    const combined = previous ? `${previous} ${transcript}` : transcript;
    if (combined.length > 1000) {
      this.voiceError.set('La solicitud supera 1000 caracteres. Reduce el texto antes de incorporar el dictado.');
      return false;
    }
    this.voiceError.set(null);
    this.textRequest.setValue(combined);
    return true;
  }

  private cancelVoice(): void {
    this.voiceVersion++;
    this.stopVoiceTimer();
    this.activeTranscription?.unsubscribe();
    this.activeTranscription = null;
    this.voiceCapture.cancel();
    this.voiceState.set('idle');
    this.voiceSeconds.set(0);
    this.voiceError.set(null);
  }

  private stopVoiceTimer(): void {
    if (this.voiceTimer !== null) clearInterval(this.voiceTimer);
    this.voiceTimer = null;
  }

  private transcriptionError(error: HttpErrorResponse): string {
    const access = this.accessError(error);
    if (access) return access;
    if (error.status === 413) return 'El audio supera el límite de 5 MiB. Graba una solicitud más breve.';
    if (error.status === 422) return 'El audio está vacío o su formato no es válido. Reintenta la grabación.';
    if (error.status === 429) return 'El proveedor alcanzó su límite temporal. Intenta más tarde.';
    if (error.status === 504) return 'La transcripción tardó demasiado. Puedes escribir la solicitud.';
    if (error.status === 502 || error.status === 503) return 'La transcripción no está disponible. Puedes escribir la solicitud.';
    return 'No se pudo transcribir el audio. Revisa la conexión o escribe la solicitud.';
  }

  clarificationLabel(field: string): string {
    const labels: Record<string, string> = {
      reporte: 'Tipo de reporte', periodo: 'Período', filtros: 'Filtros',
      agrupacion: 'Agrupación', columnas: 'Columnas', orden: 'Orden',
    };
    return labels[field] ?? this.fieldLabel(field);
  }

  clarificationLabels(fields: string[]): string {
    return fields.map((field) => this.clarificationLabel(field)).join(', ');
  }

  generate(): void {
    this.voiceContextVersion++;
    this.invalidateInterpretation();
    const catalog = this.catalog();
    if (!catalog) return;
    const checked = buildReportDefinition(catalog, this.currentReport(), this.form.getRawValue(),
      this.columns(), this.groups(), this.sorts());
    this.formError.set(checked.error);
    if (!checked.definition) return;
    this.dirty.set(false);
    this.result.set(null);
    this.fetchPage(checked.definition);
  }

  changePage(page: number): void {
    const result = this.result();
    if (!result || this.dirty() || page < 1 || page > this.pageCount() ||
        page === result.definicion.pagina) return;
    this.voiceContextVersion++;
    this.fetchPage({ ...result.definicion, pagina: page });
  }

  export(format: ReportFormat): void {
    const result = this.result();
    if (!result || !this.canExport() || !this.catalog()?.formatos.includes(format)) return;
    this.voiceContextVersion++;
    this.exportError.set(null);
    this.exporting.set(format);
    const version = ++this.exportVersion;
    const session = this.sessionFingerprint();
    const definition: ReportQuery = result.definicion;
    this.activeExport = this.exporter.export(definition, format).subscribe({
      next: (response) => {
        if (this.destroyed || version !== this.exportVersion || session !== this.sessionFingerprint() || this.dirty()) return;
        const filename = this.exporter.filename(response, definition, format);
        this.exporter.download(response, filename, format);
        this.exporting.set(null);
      },
      error: (error: HttpErrorResponse) => {
        if (this.destroyed || version !== this.exportVersion || session !== this.sessionFingerprint()) return;
        if (error.status === 401 || error.status === 403) this.result.set(null);
        void this.exporter.errorMessage(error).then((message) => {
          if (this.destroyed || version !== this.exportVersion || session !== this.sessionFingerprint()) return;
          this.exportError.set(message);
          this.exporting.set(null);
        });
      },
    });
  }

  fieldLabel(field: string): string {
    return reportFieldLabel(field);
  }

  columnsLabel(fields: string[]): string {
    return fields.map((field) => this.fieldLabel(field)).join(', ');
  }

  generatedAt(iso: string): string {
    return new Date(iso).toLocaleString('es-BO');
  }

  cell(field: string, value: ReportCell | undefined): string {
    if (value === null || value === undefined) {
      return field === 'id_especialidad'
        ? (this.catalog()?.categorias_nulas['id_especialidad'] ?? 'Sin especialidad registrada') : '—';
    }
    return String(value);
  }

  warning(message: string): string {
    if (message.includes('SIN_ESTADO_AUSENCIA')) {
      return 'El ausentismo no está disponible porque aún no se registra la ausencia de forma explícita.';
    }
    return message;
  }

  private applyInterpretedDefinition(definition: ReportQuery): boolean {
    const catalog = this.catalog();
    const options = this.options();
    const report = catalog?.reportes.find((item) => item.id === definition.reporte);
    if (!catalog || !options || !report || definition.pagina !== 1) return false;
    const draft: ReportDraft = {
      reporte: definition.reporte, desde: definition.periodo.desde, hasta: definition.periodo.hasta,
      id_medico: '', id_especialidad: '', estado: '', modalidad: '',
      tamano_pagina: definition.tamano_pagina,
    };
    const seen = new Set<string>();
    for (const filter of definition.filtros) {
      if (seen.has(filter.campo) || filter.operador !== 'eq') return false;
      seen.add(filter.campo);
      if (filter.campo === 'id_medico') {
        if (typeof filter.valor !== 'number' || !options.medicos.some((item) => item.id_medico === filter.valor)) return false;
        draft.id_medico = String(filter.valor);
      } else if (filter.campo === 'id_especialidad') {
        if (typeof filter.valor !== 'number' || !options.especialidades.some((item) => item.id_especialidad === filter.valor)) return false;
        draft.id_especialidad = String(filter.valor);
      } else if (filter.campo === 'estado' || filter.campo === 'modalidad') {
        if (typeof filter.valor !== 'string') return false;
        draft[filter.campo] = filter.valor;
      } else {
        return false;
      }
    }
    const checked = buildReportDefinition(catalog, report, draft,
      definition.columnas, definition.agrupacion, definition.orden);
    if (!checked.definition || !sameReportConfiguration(checked.definition, definition)) return false;

    const previous = this.result();
    this.selectedReportId.set(report.id);
    this.form.patchValue(draft, { emitEvent: false });
    this.columns.set([...definition.columnas]);
    this.groups.set([...definition.agrupacion]);
    this.sorts.set(definition.orden.map((item) => ({ ...item })));
    this.sortChoice.set('');
    this.sortDirection.set('asc');
    this.formError.set(null);
    this.exportError.set(null);
    this.dirty.set(!!previous && !sameReportConfiguration(previous.definicion, definition));
    if (this.dirty()) {
      this.activeExport?.unsubscribe();
      this.exportVersion++;
      this.exporting.set(null);
    }
    return true;
  }

  private invalidateInterpretation(): void {
    this.interpretVersion++;
    this.activeInterpret?.unsubscribe();
    this.activeInterpret = null;
    this.interpreting.set(false);
  }

  private sessionFingerprint(): string {
    const user = this.auth.currentUser();
    return JSON.stringify([this.auth.isAuthenticated(), this.auth.profileVerified(),
      user?.id_usuario, user?.id_clinica, user?.rol, user?.estado]);
  }

  private interpretationError(error: HttpErrorResponse): string {
    const access = this.accessError(error);
    if (access) return access;
    if (error.status === 429) return 'El proveedor alcanzó su límite temporal. Intenta más tarde o usa los filtros manuales.';
    if (error.status === 504) return 'La interpretación tardó demasiado. Intenta de nuevo o usa los filtros manuales.';
    if (error.status === 502 || error.status === 503) return 'La interpretación no está disponible. Usa los filtros manuales.';
    if (error.status === 422) return 'Revisa el texto de la solicitud y vuelve a enviarlo.';
    return 'No se pudo interpretar la solicitud. Revisa tu conexión o usa los filtros manuales.';
  }

  private fetchPage(definition: ReportQuery): void {
    this.activeQuery?.unsubscribe();
    const version = ++this.requestVersion;
    const session = this.sessionFingerprint();
    this.pendingDefinition = definition;
    this.loadingReport.set(true);
    this.queryError.set(null);
    this.activeQuery = this.reports.query(definition).subscribe({
      next: (response) => {
        if (this.destroyed || version !== this.requestVersion || session !== this.sessionFingerprint() || this.dirty()) return;
        this.pendingDefinition = null;
        this.result.set(response);
        this.loadingReport.set(false);
      },
      error: (error: HttpErrorResponse) => {
        if (this.destroyed || version !== this.requestVersion || session !== this.sessionFingerprint()) return;
        this.pendingDefinition = null;
        this.loadingReport.set(false);
        if (error.status === 401 || error.status === 403) this.result.set(null);
        this.queryError.set(this.accessError(error) ??
          (error.status === 422 ? 'Revisa filtros, fechas, columnas y agrupaciones.'
            : 'No se pudo generar el reporte. Inténtalo nuevamente.'));
      },
    });
  }

  private markDraftChanged(): void {
    this.voiceContextVersion++;
    this.invalidateInterpretation();
    this.interpretation.set(null);
    const catalog = this.catalog();
    const checked = catalog ? buildReportDefinition(catalog, this.currentReport(),
      this.form.getRawValue(), this.columns(), this.groups(), this.sorts()) : null;
    const next = checked?.definition;
    const unchangedResult = !!next && !!this.result() &&
      sameReportConfiguration(next, this.result()!.definicion);
    const unchangedPending = !!next && !!this.pendingDefinition &&
      sameReportConfiguration(next, this.pendingDefinition);
    if (!unchangedResult && !unchangedPending) this.invalidateRequest();
    this.dirty.set(!!this.result() && !unchangedResult);
    if (this.dirty()) {
      this.activeExport?.unsubscribe();
      this.exportVersion++;
      this.exporting.set(null);
    }
    this.formError.set(null);
    this.exportError.set(null);
  }

  private invalidateRequest(): void {
    this.requestVersion++;
    this.activeQuery?.unsubscribe();
    this.pendingDefinition = null;
    this.loadingReport.set(false);
  }

  private accessError(error: HttpErrorResponse): string | null {
    if (error.status === 401) return 'Tu sesión terminó. Inicia sesión nuevamente.';
    if (error.status === 403) return 'No tienes permiso para consultar reportes de esta clínica.';
    return null;
  }
}
