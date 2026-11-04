import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { A11yModule } from '@angular/cdk/a11y';
import { PlanesService } from '../../../core/services/planes.service';
import {
  CondicionesPlan,
  OpcionesPlanes,
  Plan,
  Recurso,
  Tarifa,
  VersionPlan,
} from '../../../core/models/plan.models';

const money = Validators.pattern(/^\d{1,12}(\.\d{1,2})?$/);
const count = [Validators.required, Validators.pattern(/^\d+$/), Validators.max(2147483647)];
function resourceForm() {
  return new FormGroup({
    ilimitado: new FormControl(false, { nonNullable: true }),
    limite: new FormControl('', { nonNullable: true, validators: count }),
    excedente: new FormControl(false, { nonNullable: true }),
    precio: new FormControl('', { nonNullable: true }),
  });
}

@Component({
  selector: 'app-planes-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, A11yModule],
  templateUrl: './planes-page.html',
  styleUrl: './planes-page.css',
})
export class PlanesPage implements OnInit {
  private readonly api = inject(PlanesService);
  private readonly destroy = inject(DestroyRef);
  private listRequest = 0;
  private panelRequest = 0;
  readonly planes = signal<Plan[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly panelLoading = signal(false);
  readonly saving = signal(false);
  readonly listError = signal('');
  readonly error = signal('');
  readonly success = signal('');
  readonly conflict = signal(false);
  readonly opciones = signal<OpcionesPlanes | null>(null);
  readonly selected = signal<Plan | null>(null);
  readonly mode = signal<'closed' | 'new' | 'edit' | 'view'>('closed');
  readonly historical = signal<VersionPlan | null>(null);
  readonly history = signal<VersionPlan[]>([]);
  readonly historyPage = signal(1);
  readonly historyTotal = signal(0);
  readonly historyOpen = signal(false);
  readonly historyLoading = signal(false);
  readonly historyError = signal('');
  readonly confirm = signal<Plan | null>(null);
  readonly search = new FormControl('', {
    nonNullable: true,
    validators: Validators.maxLength(150),
  });
  readonly estado = new FormControl('', { nonNullable: true });
  readonly form = new FormGroup({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/)],
    }),
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150), Validators.pattern(/\S/)],
    }),
    descripcion: new FormControl('', { nonNullable: true, validators: Validators.maxLength(2000) }),
    precio_mensual: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, money],
    }),
    demora_pago_dias: new FormControl('', { nonNullable: true, validators: count }),
    servicios_incluidos: new FormControl<string[]>([], { nonNullable: true }),
    MEDICOS: resourceForm(),
    SEDES: resourceForm(),
    CONSULTAS: resourceForm(),
  });
  readonly recursos: { key: Recurso; label: string; unit: string }[] = [
    { key: 'MEDICOS', label: 'Médicos', unit: 'por médico / ciclo mensual' },
    { key: 'SEDES', label: 'Sedes', unit: 'por sede / ciclo mensual' },
    { key: 'CONSULTAS', label: 'Consultas por ciclo mensual', unit: 'por consulta' },
  ];

  ngOnInit() {
    this.loadOptions();
    this.load();
  }
  loadOptions() {
    this.api
      .opciones()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (value) => this.opciones.set(value),
        error: () =>
          this.error.set(
            'No se pudieron cargar los servicios y unidades. Reintente antes de guardar.',
          ),
      });
  }
  load(page = 1) {
    if (this.search.invalid) return;
    const request = ++this.listRequest;
    this.loading.set(true);
    this.listError.set('');
    this.api
      .listar(this.search.value.trim(), this.estado.value, page)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (data) => {
          if (request !== this.listRequest) return;
          this.planes.set(data.items);
          this.total.set(data.total);
          this.page.set(page);
          this.loading.set(false);
        },
        error: (err) => {
          if (request !== this.listRequest) return;
          this.listError.set(this.message(err));
          this.loading.set(false);
        },
      });
  }
  nuevo() {
    if (this.saving()) return;
    ++this.panelRequest;
    this.panelLoading.set(false);
    this.selected.set(null);
    this.historical.set(null);
    this.mode.set('new');
    this.error.set('');
    this.success.set('');
    this.conflict.set(false);
    this.historyOpen.set(false);
    this.form.enable();
    this.form.reset();
    this.syncResources();
  }
  abrir(plan: Plan, edit = false) {
    if (this.saving()) return;
    const request = ++this.panelRequest;
    this.panelLoading.set(true);
    this.error.set('');
    this.conflict.set(false);
    this.historyOpen.set(false);
    this.api
      .detalle(plan.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (value) => {
          if (request !== this.panelRequest) return;
          this.selected.set(value);
          this.historical.set(null);
          this.mode.set(edit && value.activo ? 'edit' : 'view');
          this.fill(value.version);
          this.panelLoading.set(false);
        },
        error: (err) => {
          if (request !== this.panelRequest) return;
          this.panelLoading.set(false);
          this.error.set(this.message(err));
        },
      });
  }
  cerrar() {
    if (!this.saving()) {
      ++this.panelRequest;
      this.panelLoading.set(false);
      this.mode.set('closed');
      this.error.set('');
    }
  }
  private fill(v: VersionPlan) {
    this.form.enable();
    this.form.patchValue({
      codigo: this.selected()?.codigo ?? '',
      nombre: v.nombre,
      descripcion: v.descripcion ?? '',
      precio_mensual: v.precio_mensual,
      demora_pago_dias: String(v.demora_pago_dias),
      servicios_incluidos: [...v.servicios_incluidos],
    });
    const limits = {
      MEDICOS: v.limite_medicos,
      SEDES: v.limite_sedes,
      CONSULTAS: v.limite_consultas,
    };
    for (const r of this.recursos) {
      const tariff = v.tarifas_excedentes.find((t) => t.recurso === r.key);
      this.form.controls[r.key].setValue({
        ilimitado: limits[r.key] === null,
        limite: limits[r.key] === null ? '' : String(limits[r.key]),
        excedente: !!tariff,
        precio: tariff?.precio ?? '',
      });
    }
    this.syncResources();
    this.form.controls.codigo.disable();
    if (this.mode() === 'view') this.form.disable();
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }
  syncResources() {
    for (const r of this.recursos) {
      const c = this.form.controls[r.key].controls;
      if (c.ilimitado.value) {
        c.limite.disable();
        c.excedente.setValue(false);
        c.excedente.disable();
      } else {
        c.limite.enable();
        c.excedente.enable();
      }
      c.precio.setValidators(c.excedente.value ? [Validators.required, money] : []);
      if (c.excedente.value) c.precio.enable();
      else c.precio.disable();
      c.precio.updateValueAndValidity();
    }
  }
  toggleService(code: string, checked: boolean) {
    const current = this.form.controls.servicios_incluidos.value;
    this.form.controls.servicios_incluidos.setValue(
      checked ? [...current.filter((c) => c !== code), code] : current.filter((c) => c !== code),
    );
    this.form.markAsDirty();
  }
  private payload(): CondicionesPlan {
    const raw = this.form.getRawValue();
    const tariffs: Tarifa[] = [];
    for (const r of this.opciones()!.recursos) {
      const value = raw[r.recurso];
      if (!value.ilimitado && value.excedente)
        tariffs.push({ recurso: r.recurso, unidad: r.unidad, precio: value.precio });
    }
    return {
      nombre: raw.nombre.trim(),
      descripcion: raw.descripcion.trim() || null,
      precio_mensual: raw.precio_mensual,
      moneda: 'BOB',
      ciclo: 'MENSUAL',
      servicios_incluidos: raw.servicios_incluidos,
      limite_medicos: raw.MEDICOS.ilimitado ? null : Number(raw.MEDICOS.limite),
      limite_sedes: raw.SEDES.ilimitado ? null : Number(raw.SEDES.limite),
      limite_consultas: raw.CONSULTAS.ilimitado ? null : Number(raw.CONSULTAS.limite),
      tarifas_excedentes: tariffs,
      demora_pago_dias: Number(raw.demora_pago_dias),
    };
  }
  guardar() {
    if (
      this.saving() ||
      this.panelLoading() ||
      this.conflict() ||
      !this.opciones() ||
      !['new', 'edit'].includes(this.mode())
    )
      return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.error.set(
        'Revise los campos: importes con hasta dos decimales y cantidades enteras no negativas.',
      );
      return;
    }
    const plan = this.selected();
    const data = this.payload();
    const operation =
      this.mode() === 'new'
        ? this.api.crear({ ...data, codigo: this.form.controls.codigo.value.toUpperCase() })
        : this.api.nuevaVersion(plan!.id, { ...data, version_base: plan!.version_actual });
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    operation
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (value) => {
          this.selected.set(value);
          this.mode.set('view');
          this.historical.set(null);
          this.fill(value.version);
          this.success.set('Plan guardado correctamente.');
          this.historyOpen.set(false);
          this.load(this.page());
        },
        error: (err) => {
          this.error.set(this.message(err));
          if (err.status === 409 && this.mode() === 'edit') this.conflict.set(true);
        },
      });
  }
  historial(page = 1) {
    const plan = this.selected();
    if (!plan) return;
    const request = this.panelRequest;
    this.historyOpen.set(true);
    this.historyLoading.set(true);
    this.historyError.set('');
    this.api
      .historial(plan.id, page)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (value) => {
          if (request !== this.panelRequest) return;
          this.history.set(value.items);
          this.historyPage.set(page);
          this.historyTotal.set(value.total);
          this.historyLoading.set(false);
        },
        error: (err) => {
          if (request !== this.panelRequest) return;
          this.historyError.set(this.message(err));
          this.historyLoading.set(false);
        },
      });
  }
  verVersion(numero: number) {
    const plan = this.selected();
    if (!plan || this.saving()) return;
    const request = ++this.panelRequest;
    this.panelLoading.set(true);
    this.error.set('');
    this.api
      .version(plan.id, numero)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (v) => {
          if (request !== this.panelRequest) return;
          this.historical.set(v);
          this.mode.set('view');
          this.fill(v);
          this.panelLoading.set(false);
        },
        error: (err) => {
          if (request !== this.panelRequest) return;
          this.error.set(this.message(err));
          this.panelLoading.set(false);
        },
      });
  }
  pedirDesactivar(plan: Plan) {
    if (!this.saving()) {
      this.confirm.set(plan);
      this.error.set('');
    }
  }
  desactivar() {
    const plan = this.confirm();
    if (!plan || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.api
      .desactivar(plan.id)
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (value) => {
          this.confirm.set(null);
          ++this.panelRequest;
          this.panelLoading.set(false);
          this.historyOpen.set(false);
          this.selected.set(value);
          this.mode.set('view');
          this.historical.set(null);
          this.fill(value.version);
          this.success.set('Plan desactivado. Se conserva todo su historial.');
          this.load(this.page());
        },
        error: (err) => this.error.set(this.message(err)),
      });
  }
  limite(value: number | null) {
    return value === null ? 'Sin límite' : String(value);
  }
  precio(value: string) {
    const [integer, decimals = '00'] = value.split('.');
    return integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + decimals.padEnd(2, '0');
  }
  message(err: HttpErrorResponse) {
    if (err.status === 403) return 'Solo el superadministrador puede gestionar el catálogo.';
    if (err.status === 401) return 'Su sesión finalizó. Vuelva a iniciar sesión.';
    const detail: unknown = err.error?.detail;
    if (typeof detail === 'string') return detail;
    if (err.status === 422) return 'Revise los datos ingresados; alguna condición no es válida.';
    return 'No se pudo completar la solicitud. Sus datos se conservan; puede reintentar.';
  }
}
