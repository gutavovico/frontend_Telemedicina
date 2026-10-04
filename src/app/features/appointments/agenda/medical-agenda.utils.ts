import { HttpErrorResponse } from '@angular/common/http';
import { BloqueoAgenda, DisponibilidadAgenda, ServicioAgenda, SlotAgenda } from './medical-agenda.models';

export const DIAS_AGENDA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export function fechaBolivia(offset = 0, now = new Date()): string {
  return new Date(now.getTime() - 4 * 3600000 + offset * 86400000).toISOString().slice(0, 10);
}
export function minutos(hora: string): number {
  const [h, m, s = '0'] = hora.split(':');
  return Number(h) * 60 + Number(m) + Number(s) / 60;
}
export function limitesServicio(servicio?: ServicioAgenda): string[] {
  if (!servicio || servicio.duracion_minutos <= 0) return [];
  const horas: string[] = [];
  for (let n = minutos(servicio.hora_inicio); n <= minutos(servicio.hora_fin); n += servicio.duracion_minutos) {
    horas.push(`${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`);
  }
  return horas;
}
export function errorAgenda(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const body: unknown = error.error;
    if (body && typeof body === 'object' && 'detail' in body) {
      const detail: unknown = body.detail;
      if (typeof detail === 'string') return detail;
      if (Array.isArray(detail)) {
        const messages = detail.filter((v): v is { msg: string } =>
          !!v && typeof v === 'object' && 'msg' in v && typeof v.msg === 'string').map(v => v.msg);
        if (messages.length) return messages.join('. ');
      }
    }
    if (error.status === 0) return 'No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.';
    if (error.status === 403) return 'Tu sesión no tiene permiso para esta operación.';
    if (error.status === 404) return 'El recurso no existe o no pertenece a tu clínica.';
    if (error.status === 409) return 'Los datos cambiaron o existe un conflicto. Actualiza e inténtalo de nuevo.';
    if (error.status === 401) return 'Tu sesión ha caducado. Inicia sesión nuevamente.';
  }
  return 'No se pudo completar la operación. Inténtalo de nuevo.';
}
export function etiquetaSlot(slot: SlotAgenda, agenda: DisponibilidadAgenda, bloqueos: BloqueoAgenda[]): string {
  if (!agenda.citas_verificadas) return 'Sin verificar';
  if (slot.disponible) return 'Disponible';
  const bloqueo = bloqueos.find(b => b.id_medico === agenda.id_medico && b.id_servicio === agenda.id_servicio &&
    b.fecha === agenda.fecha && ['PENDIENTE', 'APROBADO'].includes(b.estado) &&
    minutos(b.hora_inicio) < minutos(slot.hora_fin) && minutos(b.hora_fin) > minutos(slot.hora_inicio));
  if (bloqueo) return bloqueo.estado === 'PENDIENTE' ? 'Bloqueo pendiente' : 'Bloqueado';
  return 'No disponible'; // El contrato no permite atribuirlo con certeza a una cita.
}
