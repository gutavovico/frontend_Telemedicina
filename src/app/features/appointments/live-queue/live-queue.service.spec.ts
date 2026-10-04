import { describe, it, expect } from 'vitest';
import { mapColaOperativa, mapMiTurno } from './live-queue.service';
import { etiquetaEstadoCola } from '../../../core/models/live-queue.models';

describe('CU08 Live Queue (mapeo snake_case → camelCase)', () => {
  it('mapea mi-turno del backend al contrato TS', () => {
    const dto = mapMiTurno({
      id_cita: 102,
      hora: '09:20',
      estado: 'PENDIENTE',
      posicion: 2,
      eta_minutos: 20,
      delante: 1,
      proximo: true,
      estado_cola: 'NORMAL',
      mensaje_cola: null,
      medico_nombre: 'Roberto Gómez',
      fecha: '2026-10-04',
    });
    expect(dto).toEqual({
      idCita: 102,
      hora: '09:20',
      estado: 'PENDIENTE',
      posicion: 2,
      etaMinutos: 20,
      delante: 1,
      proximo: true,
      estadoCola: 'NORMAL',
      mensajeCola: null,
      medicoNombre: 'Roberto Gómez',
      fecha: '2026-10-04',
    });
  });

  it('mapea la cola operativa con sus entradas', () => {
    const dto = mapColaOperativa({
      id_medico: 20,
      medico_nombre: 'Roberto Gómez',
      fecha: '2026-10-04',
      estado_cola: 'PAUSADA',
      mensaje_cola: 'Atención pausada hasta las 09:30 por Limpieza',
      duracion_promedio_min: 20,
      total_pendientes: 2,
      entradas: [
        {
          id_cita: 101,
          hora: '09:00',
          estado: 'EN_CURSO',
          posicion: 1,
          eta_minutos: 0,
          paciente_nombre: 'Ana Perez',
          check_in: null,
        },
      ],
    });
    expect(dto.idMedico).toBe(20);
    expect(dto.estadoCola).toBe('PAUSADA');
    expect(dto.entradas).toHaveLength(1);
    expect(dto.entradas[0]).toEqual({
      idCita: 101,
      hora: '09:00',
      estado: 'EN_CURSO',
      posicion: 1,
      etaMinutos: 0,
      pacienteNombre: 'Ana Perez',
      checkIn: null,
    });
  });

  it('tolera entradas ausentes', () => {
    const dto = mapColaOperativa({
      id_medico: 20,
      medico_nombre: 'Roberto Gómez',
      fecha: '2026-10-04',
      estado_cola: 'SIN_TURNOS',
      mensaje_cola: 'No hay turnos pendientes para esta fecha.',
      duracion_promedio_min: 20,
      total_pendientes: 0,
      entradas: [],
    });
    expect(dto.entradas).toEqual([]);
  });

  it('etiqueta los estados de cola en español', () => {
    expect(etiquetaEstadoCola('NORMAL')).toBe('Atención normal');
    expect(etiquetaEstadoCola('PAUSADA')).toBe('Atención pausada');
    expect(etiquetaEstadoCola('DEMORADA')).toBe('Con demora');
    expect(etiquetaEstadoCola('SIN_TURNOS')).toBe('Sin turnos');
  });
});
