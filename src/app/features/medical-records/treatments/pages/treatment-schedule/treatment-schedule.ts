import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Header } from '../../../../../shared/components/header/header';
import { Footer } from '../../../../../shared/components/footer/footer';
import { AuthService } from '../../../../../core/services/auth.service';
import { TreatmentsService } from '../../services/treatments.service';
import {
  CronogramaDia,
  Dosis,
  EstadoDosis,
  MedicamentoPlan,
  NivelAdherencia,
  Plan,
  RegistroDosis,
  ConsultaIdempotenciaResponse,
} from '../../models/treatment.models';

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentLocalDateTimeString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${mins}`;
}

export function toIsoWithOffset(date: Date): string {
  const tzo = -date.getTimezoneOffset();
  const dif = tzo >= 0 ? '+' : '-';
  const pad = (num: number) => String(Math.floor(Math.abs(num))).padStart(2, '0');
  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes()) +
    ':' +
    pad(date.getSeconds()) +
    dif +
    pad(tzo / 60) +
    ':' +
    pad(tzo % 60)
  );
}

export function generarIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'idemp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
}

export function formatIsoToLocalDateTimeInput(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${mins}`;
  } catch {
    return '';
  }
}

export const PENDING_DOSE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

export interface OperacionDosisPendiente {
  id_dosis: number;
  id_tratamiento: number;
  idempotency_key: string;
  payload: RegistroDosis;
  raw_hora_efectiva?: string;
  timestamp: number;
}

/**
 * Marcador mínimo de recuperación sin cuerpo clínico.
 * Contiene únicamente datos opacos para evitar duplicados en re-entrada tras cierre de sesión.
 * ¡PROHIBIDO incluir payload, nota, efectiva_en ni ningún dato clínico legible!
 */
export interface MarcadorRecuperacionDosis {
  id_dosis: number;
  id_tratamiento: number;
  idempotency_key: string;
  timestamp: number;
  id_usuario: number;
  id_clinica: number;
}

export function sonPayloadsEquivalentes(a: RegistroDosis, b: RegistroDosis): boolean {
  if (a.estado !== b.estado) return false;
  const notaA = a.nota?.trim() || null;
  const notaB = b.nota?.trim() || null;
  if (notaA !== notaB) return false;
  const efA = a.efectiva_en || null;
  const efB = b.efectiva_en || null;
  if (efA !== efB) return false;
  return true;
}

export function serializarPayloadDosis(payload: RegistroDosis): string {
  const obj: Record<string, any> = {
    efectiva_en: payload.efectiva_en ?? null,
    estado: payload.estado,
    nota: payload.nota ?? null,
  };
  return JSON.stringify(obj);
}

export function sha256Utf8(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const words: number[] = [];
  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const utf8: number[] = [];
  for (let i = 0; i < ascii.length; i++) {
    let charcode = ascii.charCodeAt(i);
    if (charcode < 0x80) {
      utf8.push(charcode);
    } else if (charcode < 0x800) {
      utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    } else {
      i++;
      charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (ascii.charCodeAt(i) & 0x3ff));
      utf8.push(
        0xf0 | (charcode >> 18),
        0x80 | ((charcode >> 12) & 0x3f),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f)
      );
    }
  }

  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= utf8[i] << (24 - (i % 4) * 8);
  }
  words[utf8.length >> 2] |= 0x80 << (24 - (utf8.length % 4) * 8);
  words[(((utf8.length + 8) >> 6) << 4) + 15] = utf8.length * 8;

  const w = new Array(64);
  for (let i = 0; i < words.length; i += 16) {
    let [a, b, c, d, e, f, g, h] = hash;
    for (let j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = words[i + j] | 0;
      } else {
        const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[j] + w[j]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }
    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  return hash.map((h) => ((h >>> 0).toString(16).padStart(8, '0'))).join('');
}

export function calcularRequestHash(payload: RegistroDosis): string {
  const serialized = serializarPayloadDosis(payload);
  return sha256Utf8(serialized);
}

@Component({
  selector: 'app-treatment-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Header, Footer],
  templateUrl: './treatment-schedule.html',
  styleUrl: './treatment-schedule.css',
})
export class TreatmentSchedule implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly treatmentsService = inject(TreatmentsService);
  readonly authService = inject(AuthService);

  readonly idTratamiento = signal<number>(0);
  readonly fechaSeleccionada = signal<string>(getTodayDateString());
  readonly cronograma = signal<CronogramaDia | null>(null);
  readonly plan = signal<Plan | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly isLoadingPlan = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly toastMessage = signal<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Modal de registro de toma
  readonly isModalOpen = signal<boolean>(false);
  readonly selectedDosis = signal<Dosis | null>(null);
  readonly modalEstado = signal<'INGERIDA' | 'OMITIDA' | 'POSPUESTA'>('INGERIDA');
  readonly modalHoraEfectiva = signal<string>('');
  readonly modalNota = signal<string>('');
  readonly modalError = signal<string | null>(null);
  readonly isSaving = signal<boolean>(false);
  readonly isReconciling = signal<boolean>(false);
  readonly isResolving = signal<boolean>(false);

  // Clave de idempotencia y payload congelado de la operación
  readonly currentIdempotencyKey = signal<string | null>(null);
  readonly lastSubmittedPayload = signal<RegistroDosis | null>(null);
  readonly pendingOperation = signal<OperacionDosisPendiente | null>(null);
  readonly activeRecoveryMarker = signal<MarcadorRecuperacionDosis | null>(null);

  // Permisos: solo el paciente titular puede registrar tomas
  readonly isPacienteTitular = computed(() => this.authService.isPaciente());

  readonly isHoy = computed(() => this.fechaSeleccionada() === getTodayDateString());

  // Detección de edición de campos tras un resultado incierto / fallo
  readonly haModificadoDatosPendientes = computed<boolean>(() => {
    const pending = this.pendingOperation();
    if (!pending) return false;

    if (this.modalEstado() !== pending.payload.estado) {
      return true;
    }

    const notaActual = this.modalNota().trim() || null;
    const notaOriginal = pending.payload.nota?.trim() || null;
    if (notaActual !== notaOriginal) {
      return true;
    }

    if (this.modalEstado() === 'INGERIDA') {
      const horaActual = this.modalHoraEfectiva();
      const horaOriginal =
        pending.raw_hora_efectiva ||
        formatIsoToLocalDateTimeInput(pending.payload.efectiva_en || '');
      if (horaActual !== horaOriginal) {
        return true;
      }
    }

    return false;
  });

  readonly adherenciaNivel = computed<NivelAdherencia>(() => {
    return this.cronograma()?.adherencia?.nivel ?? 'SIN_DATOS';
  });

  readonly adherenciaBadgeClass = computed(() => {
    switch (this.adherenciaNivel()) {
      case 'OPTIMA':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'REGULAR':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'CRITICA':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'SIN_DATOS':
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  });

  readonly adherenciaPorcentajeTexto = computed(() => {
    const porc = this.cronograma()?.adherencia?.porcentaje;
    if (porc === null || porc === undefined) {
      return 'Sin datos';
    }
    return `${porc.toFixed(1)}%`;
  });

  readonly adherenciaFraccionTexto = computed(() => {
    const adh = this.cronograma()?.adherencia;
    const num = adh?.numerador_puntual ?? 0;
    const den = adh?.denominador_programado ?? 0;
    return `${num} / ${den} tomas puntuales`;
  });

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = Number(idParam);
    if (!id || Number.isNaN(id)) {
      this.errorMessage.set('Identificador de tratamiento no válido');
      return;
    }
    this.idTratamiento.set(id);
    this.loadPlan();
    this.loadCronograma();
  }

  loadPlan(): void {
    const id = this.idTratamiento();
    if (!id) return;
    this.isLoadingPlan.set(true);
    this.treatmentsService.getPlan(id).subscribe({
      next: (data) => {
        this.plan.set(data);
        this.isLoadingPlan.set(false);
      },
      error: () => {
        this.isLoadingPlan.set(false);
      },
    });
  }

  loadCronograma(): void {
    const id = this.idTratamiento();
    const fecha = this.fechaSeleccionada();
    if (!id || !fecha) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.treatmentsService.getCronograma(id, fecha).subscribe({
      next: (data) => {
        this.cronograma.set(data);
        this.isLoading.set(false);
        this.reconciliarCronograma(data);
      },
      error: (err) => {
        this.isLoading.set(false);
        const detail = err?.error?.detail || 'Error al cargar el cronograma del día.';
        this.errorMessage.set(detail);
      },
    });
  }

  getUserId(): number | string {
    return this.authService.currentUser()?.id_usuario ?? 'anon';
  }

  getClinicId(): number | string {
    return this.authService.currentUser()?.id_clinica ?? this.plan()?.id_clinica ?? '0';
  }

  getStorageKey(idDosis: number): string {
    return `pending_dose_${this.getUserId()}_${this.getClinicId()}_${idDosis}`;
  }

  getRecoveryKey(idDosis: number): string {
    return `cu17_recovery_${this.getUserId()}_${this.getClinicId()}_${idDosis}`;
  }

  guardarOperacionPendiente(op: OperacionDosisPendiente): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem(this.getStorageKey(op.id_dosis), JSON.stringify(op));
      }
    } catch {
      // Entornos donde sessionStorage no esté disponible
    }
  }

  obtenerOperacionPendiente(idDosis: number): OperacionDosisPendiente | null {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const raw = sessionStorage.getItem(this.getStorageKey(idDosis));
        if (!raw) return null;
        const op: OperacionDosisPendiente = JSON.parse(raw);
        // Invariante: Un resultado incierto NO se descarta silenciosamente al vencer un TTL.
        // El vencimiento del almacenamiento local no habilita por sí solo un nuevo envío potencialmente duplicado.
        return op;
      }
    } catch {
      return null;
    }
    return null;
  }

  limpiarOperacionPendiente(idDosis: number): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem(this.getStorageKey(idDosis));
      }
    } catch {}
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(this.getStorageKey(idDosis));
      }
    } catch {}
  }

  guardarMarcadorRecuperacion(marcador: MarcadorRecuperacionDosis): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.getRecoveryKey(marcador.id_dosis), JSON.stringify(marcador));
      }
    } catch {}
  }

  obtenerMarcadorRecuperacion(idDosis: number): MarcadorRecuperacionDosis | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(this.getRecoveryKey(idDosis));
        if (!raw) return null;
        const marcador: MarcadorRecuperacionDosis = JSON.parse(raw);
        return marcador;
      }
    } catch {
      return null;
    }
    return null;
  }

  limpiarMarcadorRecuperacion(idDosis: number): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(this.getRecoveryKey(idDosis));
      }
    } catch {}
  }

  tieneOperacionGuardada(idDosis: number): boolean {
    return this.obtenerOperacionPendiente(idDosis) !== null || this.obtenerMarcadorRecuperacion(idDosis) !== null;
  }

  reconciliarCronograma(_data: CronogramaDia): void {
    // Invariante: Una consulta GET del cronograma NO demuestra que un intento en curso haya concluido
    // ni cuál operación concreta se confirmó. Por tanto, no se asume éxito ni se borra
    // una operación pendiente solo por observar dosis.estado !== 'PENDIENTE'.
    // El mecanismo inequívoco de resolución es el reenvío idempotente del cuerpo y la clave.
  }

  reconciliarManual(): void {
    const dosis = this.selectedDosis();
    if (!dosis) return;
    const pending = this.obtenerOperacionPendiente(dosis.id_dosis) || this.pendingOperation();
    if (!pending) return;

    if (this.isReconciling() || this.isSaving()) return;

    this.isReconciling.set(true);
    this.modalError.set(null);

    this.treatmentsService
      .registrarDosis(pending.id_dosis, pending.payload, pending.idempotency_key)
      .subscribe({
        next: (dosisConfirmada) => {
          this.isReconciling.set(false);
          this.limpiarOperacionPendiente(dosis.id_dosis);
          this.limpiarMarcadorRecuperacion(dosis.id_dosis);
          this.pendingOperation.set(null);
          this.activeRecoveryMarker.set(null);
          this.lastSubmittedPayload.set(null);
          this.cerrarModal();
          this.loadCronograma();
          this.showToast(
            'success',
            `Operación confirmada con el servidor (estado: ${dosisConfirmada.estado}).`
          );
        },
        error: (err) => {
          this.isReconciling.set(false);
          const status = err?.status;
          if (status === 422 || status === 400) {
            this.limpiarOperacionPendiente(dosis.id_dosis);
            this.limpiarMarcadorRecuperacion(dosis.id_dosis);
            this.pendingOperation.set(null);
            this.activeRecoveryMarker.set(null);
            this.lastSubmittedPayload.set(null);
            this.currentIdempotencyKey.set(generarIdempotencyKey());
            const detail =
              err?.error?.detail || 'Operación rechazada definitivamente por validación.';
            this.modalError.set(`${detail} Ahora puedes corregir los datos y reintentar.`);
          } else if (status === 0) {
            this.modalError.set(
              'Sin conexión con el servidor. La operación continúa en estado incierto; no se puede registrar una nueva toma hasta recuperar la conexión y confirmar el resultado.'
            );
          } else {
            const detail =
              err?.error?.detail || 'No se pudo conectar con el servidor para reconciliar.';
            this.modalError.set(
              `${detail} La operación continúa en estado incierto. No se permite crear otra operación hasta resolverla.`
            );
          }
        },
      });
  }

  /**
   * Consulta el estado de una operación de resultado incierto mediante el endpoint
   * específico de idempotencia cuando no se cuenta con el cuerpo clínico (post-cierre de sesión / recarga).
   */
  verificarMarcadorRecuperacion(marker?: MarcadorRecuperacionDosis | null): void {
    const m = marker ?? this.activeRecoveryMarker();
    if (!m) return;
    if (this.isReconciling() || this.isSaving() || this.isResolving()) return;
    if (typeof this.treatmentsService.consultarIdempotencia !== 'function') return;

    this.isReconciling.set(true);
    this.modalError.set(null);

    this.treatmentsService.consultarIdempotencia(m.id_dosis, m.idempotency_key).subscribe({
      next: (res: ConsultaIdempotenciaResponse) => {
        this.isReconciling.set(false);
        if (!res) return;

        if (res.confirmado || res.estado === 'CONFIRMADA') {
          // 1. Confirmada exitosamente en el servidor
          this.limpiarMarcadorRecuperacion(m.id_dosis);
          this.limpiarOperacionPendiente(m.id_dosis);
          this.activeRecoveryMarker.set(null);
          this.pendingOperation.set(null);
          this.lastSubmittedPayload.set(null);
          this.cerrarModal();
          this.loadCronograma();
          this.showToast('success', 'Operación previa confirmada en el servidor.');
        } else if (res.en_curso || res.estado === 'EN_CURSO') {
          // 2. En curso / estado incierto en el servidor:
          // ¡NO interpretar como rechazo!
          // ¡NO eliminar marcador de recuperación!
          // ¡NO permitir generar una nueva clave de idempotencia ni enviar una nueva solicitud!
          // Mantener la dosis bloqueada.
          this.modalError.set(
            'La operación previa sigue en curso o en estado incierto en el servidor. No se permite registrar una nueva toma hasta confirmar el resultado anterior.'
          );
        } else if (res.rechazado || res.estado === 'RECHAZADA') {
          // 3. Rechazo definitivo confirmado por el servidor
          this.limpiarMarcadorRecuperacion(m.id_dosis);
          this.limpiarOperacionPendiente(m.id_dosis);
          this.activeRecoveryMarker.set(null);
          this.pendingOperation.set(null);
          this.lastSubmittedPayload.set(null);
          this.currentIdempotencyKey.set(generarIdempotencyKey());
          const mensajeRechazo =
            res.mensaje ||
            'Operación rechazada definitivamente por el servidor. Puedes corregir los datos y reintentar.';
          this.modalError.set(mensajeRechazo);
        } else if (res.estado === 'NO_INICIADA' || (!res.confirmado && !res.en_curso && !res.rechazado)) {
          // 4. Operación no iniciada / aún no observada en el servidor:
          // Invariante crítico: NO liberar un marcador ni crear una clave nueva por observar simplemente NO_INICIADA
          // si aún puede llegar un envío anterior. Si NO_INICIADA, mostrar advertencia y permitir reintentar o resolver.
          this.modalError.set(
            'La operación previa no figura aún en el servidor, pero podría haber un envío anterior en tránsito. Para proteger tu historial y evitar duplicados, no se libera el bloqueo automáticamente. Puedes volver a verificar o usar "Resolver operación abandonada".'
          );
        }
      },
      error: () => {
        this.isReconciling.set(false);
        // Si hay fallo de conexión o error 5xx:
        // Mantener el marcador bloqueando la dosis y mostrar mensaje explícito con botón de reintento.
        this.modalError.set(
          'Sin conexión con el servidor para verificar la operación previa. No se puede registrar una nueva toma hasta restablecer la conexión y verificar el resultado anterior.'
        );
      },
    });
  }

  /**
   * Resuelve de forma segura y explícita una operación previa abandonada en estado incierto/EN_CURSO
   * (p. ej., worker caído o cliente que cerró sesión perdiendo el cuerpo clínico).
   */
  resolverOperacionAbandonada(idDosis?: number, idempotencyKey?: string): void {
    const dosisId =
      idDosis ??
      this.selectedDosis()?.id_dosis ??
      this.activeRecoveryMarker()?.id_dosis;
    const key =
      idempotencyKey ??
      this.activeRecoveryMarker()?.idempotency_key ??
      this.currentIdempotencyKey() ??
      this.pendingOperation()?.idempotency_key;

    if (!dosisId || !key) return;
    if (this.isResolving() || this.isSaving() || this.isReconciling()) return;

    this.isResolving.set(true);
    this.modalError.set(null);

    this.treatmentsService.resolverOperacionAbandonada(dosisId, key).subscribe({
      next: (res: ConsultaIdempotenciaResponse) => {
        this.isResolving.set(false);
        if (res.confirmado || res.estado === 'CONFIRMADA') {
          this.limpiarMarcadorRecuperacion(dosisId);
          this.limpiarOperacionPendiente(dosisId);
          this.activeRecoveryMarker.set(null);
          this.pendingOperation.set(null);
          this.lastSubmittedPayload.set(null);
          this.cerrarModal();
          this.loadCronograma();
          this.showToast('success', 'Operación previa confirmada en el servidor.');
        } else if (res.rechazado || res.estado === 'RECHAZADA') {
          this.limpiarMarcadorRecuperacion(dosisId);
          this.limpiarOperacionPendiente(dosisId);
          this.activeRecoveryMarker.set(null);
          this.pendingOperation.set(null);
          this.lastSubmittedPayload.set(null);
          this.currentIdempotencyKey.set(generarIdempotencyKey());
          const dosis = this.selectedDosis();
          this.modalEstado.set('INGERIDA');
          this.modalHoraEfectiva.set(getCurrentLocalDateTimeString());
          this.modalNota.set(dosis?.nota || '');
          this.modalError.set(null);
          this.showToast(
            'info',
            'Operación abandonada resuelta. El formulario ha sido desbloqueado.'
          );
        } else {
          this.modalError.set(
            res.mensaje || 'No se pudo resolver la operación abandonada. El estado continúa en curso.'
          );
        }
      },
      error: (err) => {
        this.isResolving.set(false);
        const detail =
          err?.error?.detail || 'Error al resolver la operación abandonada en el servidor.';
        this.modalError.set(detail);
      },
    });
  }

  descartarOperacionPrevia(): void {
    const dosis = this.selectedDosis();
    if (!dosis) return;

    // Un resultado incierto no se puede descartar arbitrariamente mientras la solicitud
    // previa pueda seguir en curso en el servidor o red, evitando duplicados.
    const pending = this.obtenerOperacionPendiente(dosis.id_dosis) || this.pendingOperation();
    const marker = this.obtenerMarcadorRecuperacion(dosis.id_dosis) || this.activeRecoveryMarker();
    if (pending || marker) {
      this.modalError.set(
        'No se puede descartar una operación pendiente mientras su resultado sea incierto. Debe reintentar hasta obtener confirmación o rechazo definitivo del servidor.'
      );
      return;
    }

    this.limpiarOperacionPendiente(dosis.id_dosis);
    this.limpiarMarcadorRecuperacion(dosis.id_dosis);
    this.pendingOperation.set(null);
    this.activeRecoveryMarker.set(null);
    this.lastSubmittedPayload.set(null);
    this.currentIdempotencyKey.set(generarIdempotencyKey());
    this.modalError.set(null);
  }

  restaurarDatosOriginales(): void {
    const pending = this.pendingOperation();
    if (!pending) return;

    this.modalEstado.set(pending.payload.estado);
    if (pending.raw_hora_efectiva) {
      this.modalHoraEfectiva.set(pending.raw_hora_efectiva);
    } else if (pending.payload.efectiva_en) {
      this.modalHoraEfectiva.set(formatIsoToLocalDateTimeInput(pending.payload.efectiva_en));
    }
    this.modalNota.set(pending.payload.nota || '');
    this.modalError.set(null);
  }

  cambiarDia(offsetDias: number): void {
    const parts = this.fechaSeleccionada().split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + offsetDias);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    this.fechaSeleccionada.set(`${year}-${month}-${day}`);
    this.loadCronograma();
  }

  irAHoy(): void {
    const hoy = getTodayDateString();
    if (this.fechaSeleccionada() !== hoy) {
      this.fechaSeleccionada.set(hoy);
      this.loadCronograma();
    }
  }

  onFechaChange(nuevaFecha: string): void {
    if (nuevaFecha && nuevaFecha !== this.fechaSeleccionada()) {
      this.fechaSeleccionada.set(nuevaFecha);
      this.loadCronograma();
    }
  }

  getMedicamento(idMedicamentoPlan: number): MedicamentoPlan | undefined {
    return this.plan()?.medicamentos?.find((m) => m.id_medicamento_plan === idMedicamentoPlan);
  }

  getMedicamentoNombre(idMedicamentoPlan: number): string {
    const med = this.getMedicamento(idMedicamentoPlan);
    return med ? med.medicamento_nombre : `Medicamento #${idMedicamentoPlan}`;
  }

  getMedicamentoIndicaciones(idMedicamentoPlan: number): string {
    const med = this.getMedicamento(idMedicamentoPlan);
    if (!med) return '';
    const parts: string[] = [];
    if (med.dosis) parts.push(med.dosis);
    if (med.via_administracion) parts.push(med.via_administracion);
    if (med.indicaciones) parts.push(med.indicaciones);
    return parts.join(' • ');
  }

  isDosisFutura(dosis: Dosis | null): boolean {
    if (!dosis || !dosis.programada_en) return false;
    return new Date(dosis.programada_en).getTime() > Date.now();
  }

  formatHoraEfectiva(isoStr: string | null): string {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr;
    }
  }

  formatFechaHuman(fechaStr: string): string {
    if (!fechaStr) return '';
    try {
      const parts = fechaStr.split('-').map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return fechaStr;
    }
  }

  abrirModalRegistro(dosis: Dosis): void {
    if (!this.isPacienteTitular()) return;
    this.selectedDosis.set(dosis);
    this.modalError.set(null);
    this.isModalOpen.set(true);

    const pending = this.obtenerOperacionPendiente(dosis.id_dosis);
    const marker = this.obtenerMarcadorRecuperacion(dosis.id_dosis);

    if (pending) {
      // Sesión activa con cuerpo clínico completo en memoria/sessionStorage
      this.activeRecoveryMarker.set(null);
      this.pendingOperation.set(pending);
      this.currentIdempotencyKey.set(pending.idempotency_key);
      this.lastSubmittedPayload.set(pending.payload);
      this.modalEstado.set(pending.payload.estado);
      if (pending.raw_hora_efectiva) {
        this.modalHoraEfectiva.set(pending.raw_hora_efectiva);
      } else if (pending.payload.efectiva_en) {
        this.modalHoraEfectiva.set(formatIsoToLocalDateTimeInput(pending.payload.efectiva_en));
      } else {
        this.modalHoraEfectiva.set(getCurrentLocalDateTimeString());
      }
      this.modalNota.set(pending.payload.nota || '');
    } else if (marker) {
      // Vuelta a entrar tras cierre de sesión o recarga sin cuerpo clínico legible.
      // Bloquear generación de nueva clave y bloquear nuevo envío de formulario.
      this.pendingOperation.set(null);
      this.lastSubmittedPayload.set(null);
      this.currentIdempotencyKey.set(marker.idempotency_key);
      this.activeRecoveryMarker.set(marker);
      // Reconciliar consultando el nuevo endpoint de idempotencia
      this.verificarMarcadorRecuperacion(marker);
    } else {
      this.activeRecoveryMarker.set(null);
      this.pendingOperation.set(null);
      this.lastSubmittedPayload.set(null);
      this.currentIdempotencyKey.set(generarIdempotencyKey());
      this.modalEstado.set('INGERIDA');
      this.modalHoraEfectiva.set(getCurrentLocalDateTimeString());
      this.modalNota.set(dosis.nota || '');
    }
  }

  cerrarModal(): void {
    this.isModalOpen.set(false);
    this.selectedDosis.set(null);
    this.modalError.set(null);
    this.currentIdempotencyKey.set(null);
    this.pendingOperation.set(null);
    this.activeRecoveryMarker.set(null);
    this.lastSubmittedPayload.set(null);
    this.isSaving.set(false);
    this.isReconciling.set(false);
    this.isResolving.set(false);
  }

  guardarRegistro(): void {
    if (this.isSaving() || this.isReconciling() || this.isResolving()) return;
    if (this.activeRecoveryMarker()) {
      this.modalError.set(
        'La operación previa sigue en curso o en estado incierto en el servidor. No se permite registrar una nueva toma hasta confirmar el resultado anterior.'
      );
      return;
    }

    const dosis = this.selectedDosis();
    if (!dosis) return;

    // Validación de conflicto de idempotencia en UI:
    // Si hay una operación pendiente y los datos fueron modificados, impedir enviar la misma clave con otro cuerpo
    if (this.haModificadoDatosPendientes()) {
      this.modalError.set(
        'Has modificado los datos respecto a una operación anterior no confirmada. Para evitar conflictos de idempotencia, restaura los datos originales y reintenta.'
      );
      return;
    }

    const estado = this.modalEstado();
    const nota = this.modalNota().trim() || null;

    if (nota && nota.length > 1000) {
      this.modalError.set('La nota no puede superar los 1000 caracteres.');
      return;
    }

    let efectivaEn: string | null = null;
    let rawHora = '';

    if (estado === 'INGERIDA') {
      rawHora = this.modalHoraEfectiva();
      if (!rawHora) {
        this.modalError.set('Debe indicar la hora efectiva de la ingesta.');
        return;
      }
      const fechaEfectiva = new Date(rawHora);
      if (fechaEfectiva.getTime() > Date.now()) {
        this.modalError.set('La fecha y hora efectiva no puede ser futura.');
        return;
      }
      efectivaEn = toIsoWithOffset(fechaEfectiva);
    } else if (estado === 'OMITIDA') {
      if (this.isDosisFutura(dosis)) {
        this.modalError.set('No se puede omitir una toma futura antes de su hora programada.');
        return;
      }
      efectivaEn = null;
    } else {
      efectivaEn = null;
    }

    // Si estamos reintentando una operación pendiente existente sin cambios,
    // usamos exactamente el payload y la clave originales ya congelados
    const pending = this.pendingOperation();
    const payload: RegistroDosis = pending
      ? pending.payload
      : {
          estado,
          nota,
          ...(efectivaEn ? { efectiva_en: efectivaEn } : {}),
        };

    const finalKey: string =
      (pending ? pending.idempotency_key : this.currentIdempotencyKey()) || generarIdempotencyKey();
    this.currentIdempotencyKey.set(finalKey);

    // Congelar y persistir en almacenamiento local para resiliencia ante recarga / cierre
    const timestampOperacion = pending?.timestamp ?? Date.now();
    const operacionPendiente: OperacionDosisPendiente = {
      id_dosis: dosis.id_dosis,
      id_tratamiento: this.idTratamiento(),
      idempotency_key: finalKey,
      payload,
      raw_hora_efectiva: rawHora || undefined,
      timestamp: timestampOperacion,
    };

    // Marcador mínimo opaco: SIN datos clínicos legibles (sobrevive al logout)
    const marcador: MarcadorRecuperacionDosis = {
      id_dosis: dosis.id_dosis,
      id_tratamiento: this.idTratamiento(),
      idempotency_key: finalKey,
      timestamp: timestampOperacion,
      id_usuario: Number(this.getUserId()) || 0,
      id_clinica: Number(this.getClinicId()) || 0,
    };

    // 1) Guarda marcador opaco en localStorage
    this.guardarOperacionPendiente(operacionPendiente);
    this.guardarMarcadorRecuperacion(marcador);
    this.pendingOperation.set(operacionPendiente);
    this.lastSubmittedPayload.set(payload);

    this.isSaving.set(true);
    this.modalError.set(null);

    const requestHash = calcularRequestHash(payload);

    // 2) Llama a this.treatmentsService.iniciarIntento(...)
    this.treatmentsService.iniciarIntento(dosis.id_dosis, requestHash, finalKey).subscribe({
      next: (intentoRes) => {
        if (intentoRes.confirmado || intentoRes.estado === 'CONFIRMADA') {
          this.isSaving.set(false);
          this.limpiarOperacionPendiente(dosis.id_dosis);
          this.limpiarMarcadorRecuperacion(dosis.id_dosis);
          this.pendingOperation.set(null);
          this.activeRecoveryMarker.set(null);
          this.lastSubmittedPayload.set(null);
          this.cerrarModal();
          this.loadCronograma();
          this.showToast('success', 'Toma registrada exitosamente.');
          return;
        }

        // 3) Al recibir éxito durable (200/201 con en_curso: true), envía this.treatmentsService.registrarDosis(...)
        this.treatmentsService.registrarDosis(dosis.id_dosis, payload, finalKey).subscribe({
          next: () => {
            // 4) Si el registro clínico se confirma, limpia marcador y actualiza vista.
            this.isSaving.set(false);
            this.limpiarOperacionPendiente(dosis.id_dosis);
            this.limpiarMarcadorRecuperacion(dosis.id_dosis);
            this.pendingOperation.set(null);
            this.activeRecoveryMarker.set(null);
            this.lastSubmittedPayload.set(null);
            this.cerrarModal();
            this.loadCronograma();
            this.showToast('success', 'Toma registrada exitosamente.');
          },
          error: (err) => {
            this.isSaving.set(false);
            const status = err?.status;
            const detail =
              err?.error?.detail || 'Error al registrar la toma. Verifique los datos e intente nuevamente.';

            // Errores de validación definitivos 400 / 422: el backend rechazó la petición sin registrar
            // evento en base de datos. Se libera la operación pendiente para permitir al usuario
            // corregir los campos y enviar con una clave limpia.
            if (status === 400 || status === 422) {
              this.limpiarOperacionPendiente(dosis.id_dosis);
              this.limpiarMarcadorRecuperacion(dosis.id_dosis);
              this.pendingOperation.set(null);
              this.activeRecoveryMarker.set(null);
              this.lastSubmittedPayload.set(null);
              this.currentIdempotencyKey.set(generarIdempotencyKey());
              this.modalError.set(detail);
            } else if (status === 0) {
              // Error de red / sin conexión: resultado incierto
              this.modalError.set(
                'Sin conexión con el servidor. El resultado de la operación sigue siendo incierto; no se puede registrar una nueva toma hasta que se restablezca la conexión y se confirme el estado.'
              );
            } else {
              // Error 5xx o timeout: resultado incierto
              this.modalError.set(
                `${detail} El resultado de la operación sigue siendo incierto. No se permite crear otra operación hasta resolverla; por favor, reintente.`
              );
            }
          },
        });
      },
      error: (err) => {
        this.isSaving.set(false);
        const status = err?.status;
        const detail =
          err?.error?.detail || 'Error al registrar intento en el servidor.';

        if (status === 400 || status === 422) {
          this.limpiarOperacionPendiente(dosis.id_dosis);
          this.limpiarMarcadorRecuperacion(dosis.id_dosis);
          this.pendingOperation.set(null);
          this.activeRecoveryMarker.set(null);
          this.lastSubmittedPayload.set(null);
          this.currentIdempotencyKey.set(generarIdempotencyKey());
          this.modalError.set(detail);
        } else if (status === 409) {
          this.modalError.set(
            detail || 'Existe una operación en curso o conflicto con los datos enviados.'
          );
        } else if (status === 0) {
          this.modalError.set(
            'Sin conexión con el servidor al iniciar intento. El resultado de la operación sigue siendo incierto; no se puede registrar una nueva toma hasta que se restablezca la conexión y se confirme el estado.'
          );
        } else {
          this.modalError.set(
            `${detail} No se pudo asegurar el intento en el servidor. La operación continúa en estado incierto.`
          );
        }
      },
    });
  }

  showToast(type: 'success' | 'error' | 'info', text: string): void {
    this.toastMessage.set({ type, text });
    setTimeout(() => {
      if (this.toastMessage()?.text === text) {
        this.toastMessage.set(null);
      }
    }, 4000);
  }
}
