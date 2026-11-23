export type DoctorEntityLinkState =
  | 'INVITADO'
  | 'ACTIVO'
  | 'SUSPENDIDO'
  | 'RECHAZADO'
  | 'BAJA';

export type DoctorEntityLinkAdminState = Extract<
  DoctorEntityLinkState,
  'ACTIVO' | 'SUSPENDIDO' | 'BAJA'
>;

export type DoctorEntitySearchCriterion =
  | 'correo'
  | 'documento_identidad'
  | 'matricula_profesional';

export interface DoctorEntityCandidate {
  id_usuario: number;
  nombres: string;
  apellidos: string;
  correo: string;
  documento_identidad: string | null;
  matricula_profesional: string | null;
  existe_perfil: boolean;
}

export interface DoctorEntityRole {
  id_rol: number;
  nombre: string;
  es_principal: boolean;
}

export interface DoctorEntitySpecialty {
  id_especialidad: number;
  nombre: string;
  es_principal: boolean;
}

/** Sede del catálogo de CU33 que puede asignarse a un vínculo. */
export interface DoctorEntitySede {
  id: number;
  nombre: string;
  ubicacion: string;
  activa: boolean;
}

export interface DoctorEntityAssignments {
  roles: number[];
  id_rol_principal: number;
  especialidades: Array<{
    id_especialidad: number;
    es_principal: boolean;
  }>;
  sedes: number[];
}

export interface DoctorEntityAssignmentsUpdate extends DoctorEntityAssignments {
  row_version: number;
}

export interface DoctorEntityUserInput {
  nombres: string;
  apellidos: string;
  correo: string;
  telefono?: string | null;
  documento_identidad?: string | null;
}

export interface DoctorEntityLinkCreate {
  modo: 'EXISTENTE' | 'NUEVO';
  id_usuario?: number;
  usuario?: DoctorEntityUserInput;
  asignaciones: DoctorEntityAssignments;
}

export interface DoctorEntityLink {
  id_vinculacion: number;
  id_usuario: number;
  id_medico: number | null;
  estado: DoctorEntityLinkState;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string | null;
  documento_identidad: string | null;
  matricula_profesional: string | null;
  existe_perfil: boolean;
  roles: DoctorEntityRole[];
  especialidades: DoctorEntitySpecialty[];
  sedes: number[];
  fecha_invitacion: string;
  respondido_en: string | null;
  fecha_estado: string;
  motivo_estado: string | null;
  row_version: number;
}

export interface DoctorEntityLinkCreated {
  id_vinculacion: number;
  id_usuario: number;
  id_medico: number | null;
  estado: DoctorEntityLinkState;
}

export interface DoctorEntityTemporaryCredential {
  correo: string;
  password_temporal: string;
  expira_en: string;
}

export interface DoctorEntityLinkCreateResponse {
  vinculacion: DoctorEntityLinkCreated;
  perfil_pendiente: boolean;
  credencial_temporal: DoctorEntityTemporaryCredential | null;
}

export interface DoctorEntityLinkListResponse {
  total: number;
  page: number;
  per_page: number;
  items: DoctorEntityLink[];
}

export interface DoctorEntityLinkHistory {
  id_historial: number;
  tipo_evento: string;
  estado_anterior: DoctorEntityLinkState | null;
  estado_nuevo: DoctorEntityLinkState | null;
  id_usuario_actor: number;
  nombre_actor: string | null;
  motivo: string | null;
  datos: Record<string, unknown>;
  fecha_cambio: string;
}

export interface DoctorEntityLinkDetailResponse {
  vinculacion: DoctorEntityLink;
  historial: DoctorEntityLinkHistory[];
}

export interface DoctorEntityStateUpdate {
  estado: DoctorEntityLinkAdminState;
  motivo?: string | null;
  row_version: number;
}

export interface DoctorEntityRejection {
  motivo: string;
}

export interface DoctorEntityLinkFilters {
  page?: number;
  per_page?: number;
  estado?: DoctorEntityLinkState | null;
  q?: string | null;
}

export interface DoctorEntityAvailableClinic {
  id_clinica: number;
  nombre: string;
}

export interface DoctorEntityAvailableClinicsResponse {
  items: DoctorEntityAvailableClinic[];
}

export interface DoctorEntityMineFilters {
  page?: number;
  per_page?: number;
  estado?: DoctorEntityLinkState | null;
}
