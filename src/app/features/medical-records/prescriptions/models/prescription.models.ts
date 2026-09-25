// Modelos CU16 — Recetas médicas digitales.
// Derivados de specs/openspec/contracts/prescriptions.md v1.0.0
// (Backend b8f7b1b, especificaciones backend d70af58).
// Fuente backend verificada: backend/app/modules/medical_records/prescriptions/schemas.py
// Prohibido agregar campos de tenant en bodies o tipos `any`.

export type EstadoReceta = 'EMITIDA' | 'ANULADA';

export type EstadoPublicoReceta = EstadoReceta | 'VENCIDA' | 'NO_ENCONTRADA';

export type ViaAdministracion =
  | 'ORAL'
  | 'SUBLINGUAL'
  | 'INTRAMUSCULAR'
  | 'INTRAVENOSA'
  | 'TOPICA'
  | 'OFTALMICA'
  | 'INHALATORIA'
  | 'RECTAL'
  | 'OTRA';

export const VIAS_ADMINISTRACION: ViaAdministracion[] = [
  'ORAL',
  'SUBLINGUAL',
  'INTRAMUSCULAR',
  'INTRAVENOSA',
  'TOPICA',
  'OFTALMICA',
  'INHALATORIA',
  'RECTAL',
  'OTRA',
];

export interface Medicamento {
  id_medicamento: number;
  nombre: string;
  principio_activo: string | null;
  concentracion: string | null;
  forma_farmaceutica: string | null;
  descripcion: string | null;
  estado: 'ACTIVO' | 'INACTIVO';
}

export interface MedicamentoCreateRequest {
  nombre: string;
  principio_activo: string | null;
  concentracion: string | null;
  forma_farmaceutica: string | null;
  descripcion: string | null;
}

export interface MedicamentoListResponse {
  items: Medicamento[];
  total: number;
}

export interface MedicamentoQueryParams {
  query?: string;
  estado?: string;
  skip?: number;
  limit?: number;
}

export interface RecetaDetalleCreate {
  id_medicamento: number | null;
  nombre_medicamento_manual: string | null;
  dosis: string;
  frecuencia: string;
  duracion: string;
  via_administracion: ViaAdministracion;
  cantidad: number;
  indicaciones: string | null;
}

export interface RecetaCreateRequest {
  id_consulta: number;
  id_paciente: number;
  fecha_vencimiento: string;
  indicaciones_generales: string | null;
  detalles: RecetaDetalleCreate[];
}

export interface RecetaAnulacionRequest {
  motivo_anulacion: string;
  observaciones_anulacion: string | null;
  id_receta_sustituta: number | null;
}

export interface RecetaDetalleResponse {
  id_receta_detalle: number;
  id_medicamento: number | null;
  nombre_medicamento_manual: string | null;
  medicamento_nombre: string;
  principio_activo: string | null;
  concentracion: string | null;
  forma_farmaceutica: string | null;
  dosis: string;
  frecuencia: string;
  duracion: string;
  via_administracion: ViaAdministracion;
  cantidad: number;
  indicaciones: string | null;
  posicion: number;
}

export interface MedicoResumen {
  id_medico: number;
  nombre_completo: string;
  matricula_profesional: string;
  especialidad: string | null;
}

export interface PacienteResumen {
  id_paciente: number;
  nombre_completo: string;
}

export interface RecetaResponse {
  id_receta: number;
  id_clinica: number;
  id_consulta: number;
  id_paciente: number;
  id_medico: number;
  id_documento: number | null;
  id_receta_sustituta: number | null;
  folio: string;
  pdf_url: string;
  indicaciones_generales: string | null;
  algoritmo_firma: 'ED25519';
  key_id: string;
  version_payload: number;
  hash_pdf: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  esta_vencida: boolean;
  estado: EstadoReceta;
  motivo_anulacion: string | null;
  observaciones_anulacion: string | null;
  fecha_anulacion: string | null;
  medico: MedicoResumen;
  paciente: PacienteResumen;
  detalles: RecetaDetalleResponse[];
}

export interface RecetaListResponse {
  items: RecetaResponse[];
  total: number;
}

export interface RecetaQueryParams {
  id_paciente?: number;
  id_medico?: number;
  estado?: EstadoReceta;
  desde?: string;
  hasta?: string;
  skip?: number;
  limit?: number;
}

export interface MedicoValidacionPublica {
  nombre: string;
  matricula: string;
  especialidad: string | null;
}

export interface PacienteValidacionPublica {
  nombre: string;
  documento_identidad: string;
}

export interface MedicamentoValidacionPublica {
  medicamento: string;
  posologia: string;
  cantidad: number;
  indicaciones: string | null;
}

export interface RecetaValidacionPublicaEncontrada {
  valida: boolean;
  estado: Exclude<EstadoPublicoReceta, 'NO_ENCONTRADA'>;
  folio: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  esta_vencida: boolean | null;
  institucion: string | null;
  medico_emisor: MedicoValidacionPublica | null;
  paciente: PacienteValidacionPublica | null;
  medicamentos_prescritos: MedicamentoValidacionPublica[] | null;
}

export interface RecetaValidacionPublicaNoEncontrada {
  valida: false;
  estado: 'NO_ENCONTRADA';
}

export type RecetaValidacionPublicaResponse =
  RecetaValidacionPublicaEncontrada | RecetaValidacionPublicaNoEncontrada;

export interface PrescriptionApiError {
  detail: string;
  code: string;
}

export function esRespuestaNoEncontrada(
  respuesta: RecetaValidacionPublicaResponse,
): respuesta is RecetaValidacionPublicaNoEncontrada {
  return respuesta.estado === 'NO_ENCONTRADA';
}

export function esLineaCatalogo(
  linea: Pick<RecetaDetalleCreate, 'id_medicamento' | 'nombre_medicamento_manual'>,
): boolean {
  return linea.id_medicamento !== null && linea.id_medicamento !== undefined;
}

export function esLineaXorValida(
  linea: Pick<RecetaDetalleCreate, 'id_medicamento' | 'nombre_medicamento_manual'>,
): boolean {
  const tieneCatalogo = linea.id_medicamento !== null && linea.id_medicamento !== undefined;
  const manual = (linea.nombre_medicamento_manual ?? '').trim();
  const tieneManual = manual.length > 0;
  return (tieneCatalogo && !tieneManual) || (!tieneCatalogo && tieneManual);
}

export function esCantidadPositiva(cantidad: number): boolean {
  return Number.isInteger(cantidad) && cantidad > 0;
}

export function diasHastaVencimiento(fechaVencimientoISO: string, hoyISO?: string): number | null {
  if (!fechaVencimientoISO) {
    return null;
  }
  const vencimiento = new Date(`${fechaVencimientoISO}T00:00:00`);
  const base = hoyISO ? new Date(`${hoyISO}T00:00:00`) : new Date();
  base.setHours(0, 0, 0, 0);
  if (Number.isNaN(vencimiento.getTime()) || Number.isNaN(base.getTime())) {
    return null;
  }
  const diffMs = vencimiento.getTime() - base.getTime();
  return Math.round(diffMs / 86400000);
}

export function esVigenciaLocalValida(fechaVencimientoISO: string, hoyISO?: string): boolean {
  const dias = diasHastaVencimiento(fechaVencimientoISO, hoyISO);
  return dias !== null && dias >= 1 && dias <= 90;
}

export function generarIdempotencyKey(): string {
  try {
    const cryptoObj = globalThis.crypto;
    if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
      return cryptoObj.randomUUID();
    }
  } catch {
    // Continúa con el generador de respaldo.
  }
  const segmento = (): string =>
    Math.floor(Math.random() * 0xffff)
      .toString(16)
      .padStart(4, '0');
  return `${segmento()}${segmento()}-${segmento()}-4${segmento().slice(1)}-a${segmento().slice(1)}-${segmento()}${segmento()}${segmento()}`;
}

export function extraerNombrePdfDesdeContentDisposition(
  contentDisposition: string | null,
  fallback: string,
): string {
  if (!contentDisposition) {
    return fallback;
  }
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utf8Match && utf8Match[1]) {
    try {
      const decodificado = decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ''));
      if (decodificado) {
        return decodificado;
      }
    } catch {
      // Usa el siguiente formato disponible.
    }
  }
  const simpleMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
  if (simpleMatch && simpleMatch[1]) {
    const nombre = simpleMatch[1].trim();
    if (nombre) {
      return nombre;
    }
  }
  return fallback;
}
