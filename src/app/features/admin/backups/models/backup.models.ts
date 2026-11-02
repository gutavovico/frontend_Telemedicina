/** Modelos tipados del contrato openspec/contracts/backup.md. Sin `any`. */

export type BackupOrigen = 'manual' | 'automatica';

export interface BackupFile {
  nombre: string;
  tamanio: number;
  fecha: string;
  /** Origen informado por el backend (auditoría CU21). Opcional por compatibilidad. */
  origen?: BackupOrigen;
}

export interface BackupListResponse {
  data: BackupFile[];
}

export type DiaSemana = 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom';

export interface BackupConfig {
  hora: string;
  dias_semana: DiaSemana[];
  activo: boolean;
  retencion_dias: number;
  ultima_ejecucion: string | null;
  ultimo_estado: string | null;
}

export interface BackupConfigUpdate {
  hora: string;
  dias_semana: DiaSemana[];
  activo: boolean;
  retencion_dias: number;
}

export interface RestoreResponse {
  mensaje: string;
}

export const DIAS_SEMANA: { valor: DiaSemana; etiqueta: string }[] = [
  { valor: 'lun', etiqueta: 'Lun' },
  { valor: 'mar', etiqueta: 'Mar' },
  { valor: 'mie', etiqueta: 'Mié' },
  { valor: 'jue', etiqueta: 'Jue' },
  { valor: 'vie', etiqueta: 'Vie' },
  { valor: 'sab', etiqueta: 'Sáb' },
  { valor: 'dom', etiqueta: 'Dom' },
];
