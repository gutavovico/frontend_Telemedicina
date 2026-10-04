export interface PatientSummaryDTO {
  idPaciente: number;
  nombreCompleto: string;
  identificacionId: string;       // ej. "12345678X"
  inicialesAvatar: string;        // ej. "CP"
  seguroProveedor: string;        // ej. "Sanitas Plus"
  seguroPoliza: string;           // ej. "Sanitas Plus"
}

export interface AppointmentDetailsDTO {
  idCita: number;
  nombreMedico: string;
  especialidad: string;
  rangoFechas: string;            // ej. "02/09/2024 - 01/02/2024"
  horaTeleconsulta: string;       // ej. "17:00 h"
  modalidad: 'TELEMEDICINA' | 'PRESENCIAL';
  estado: 'PENDIENTE' | 'CONFIRMADA' | 'EN_CURSO' | 'FINALIZADA';
}

export interface DoctorProfileSummaryDTO {
  idMedico: number;
  nombreCompleto: string;
  cargoEtiqueta: string;          // ej. "Su Médico"
  biografia: string;
  fotoUrl: string | null;
  estadoDisponibilidad: 'DISPONIBLE' | 'EN_CONSULTA' | 'DESCONECTADO';
}

export interface ChatMessageDTO {
  idMensaje: number;
  idRemitente: number;
  nombreRemitente: string;
  rolRemitente: 'MEDICO' | 'PACIENTE' | 'SISTEMA';
  contenido: string;
  horaDisplay: string;            // ej. "17:00 h"
  avatarUrl?: string | null;
  esPropio: boolean;
  leido: boolean;
  adjuntoNombre?: string | null;
  adjuntoTamano?: string | null;
  adjuntoUrl?: string | null;
}

export interface SendChatMessageCommand {
  idCita: number;
  contenido: string;
  adjuntoNombre?: string | null;
  adjuntoTamano?: string | null;
  adjuntoUrl?: string | null;
}

export interface TeleconsultaViewDTO {
  nombreClinica: string;          // "Hospital San Juan de Dios"
  usuarioActivo: {
    idUsuario: number;
    nombre: string;
    iniciales: string;
  };
  paciente: PatientSummaryDTO;
  cita: AppointmentDetailsDTO;
  medico: DoctorProfileSummaryDTO;
  mensajes: ChatMessageDTO[];
}
