import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { SpecialistSearchService } from './services/specialist-search.service';
import { SpecialistSearchComponent } from './specialist-search.component';
import { FormBuilder } from '@angular/forms';
import { SpecialistSearchResponse } from './models/specialist-search.model';

describe('CU06 Specialist Search Frontend', () => {
  let service: SpecialistSearchService;
  let mockHttp: any;

  beforeEach(() => {
    mockHttp = {
      get: vi.fn(),
    };
    service = new SpecialistSearchService(mockHttp);
  });

  it('construye parámetros de búsqueda correctamente', () => {
    mockHttp.get.mockReturnValue(of({ total: 0, page: 1, per_page: 20, items: [] }));

    service.buscarEspecialistas({
      nombre: 'Elena',
      modalidad: 'TELECONSULTA',
      costo_min: 100,
      costo_max: 300,
      fecha_inicio: '2026-04-10',
      fecha_fin: '2026-04-12',
    }).subscribe();

    expect(mockHttp.get).toHaveBeenCalledWith(
      'http://localhost:8000/especialistas/buscar',
      expect.objectContaining({
        params: expect.anything(),
      })
    );
  });

  it('obtiene disponibilidad por médico', () => {
    mockHttp.get.mockReturnValue(of({ id_medico: 10, nombre_completo: 'Elena Ríos', disponibilidad: [] }));

    service.obtenerDisponibilidad(10, '2026-04-10', '2026-04-15', 5).subscribe();

    expect(mockHttp.get).toHaveBeenCalledWith(
      'http://localhost:8000/especialistas/10/disponibilidad',
      expect.objectContaining({
        params: expect.anything(),
      })
    );
  });

  it('componente inicializa y maneja respuesta vacía', () => {
    const mockSearchResponse: SpecialistSearchResponse = {
      total: 0,
      page: 1,
      per_page: 20,
      items: [],
    };
    mockHttp.get.mockReturnValue(of(mockSearchResponse));

    const fb = new FormBuilder();
    const comp = new SpecialistSearchComponent(fb, service);

    comp.searchForm.patchValue({
      nombre: '',
      especialidad_id: '',
      modalidad: 'AMBAS',
      costo_min: '',
      costo_max: '',
      fecha_inicio: '2026-04-10',
      fecha_fin: '2026-04-15',
    });

    comp.onBuscar();

    expect(comp.loading()).toBe(false);
    expect(comp.results()?.total).toBe(0);
    expect(comp.results()?.items.length).toBe(0);
    expect(comp.errorMessage()).toBeNull();
  });

  it('componente no permite que una respuesta vieja sobreescriba una nueva', () => {
    const fb = new FormBuilder();
    const comp = new SpecialistSearchComponent(fb, service);

    comp.searchForm.patchValue({
      nombre: '',
      especialidad_id: '',
      modalidad: 'AMBAS',
      costo_min: '',
      costo_max: '',
      fecha_inicio: '2026-04-10',
      fecha_fin: '2026-04-15',
    });

    const response1: SpecialistSearchResponse = {
      total: 1,
      page: 1,
      per_page: 20,
      items: [{
        id_medico: 1,
        nombre_completo: 'Doctor Viejo',
        foto_url: null,
        matricula_profesional: 'MAT-1',
        especialidades: [],
        servicios: [],
        disponibilidad: [],
      }],
    };

    const response2: SpecialistSearchResponse = {
      total: 1,
      page: 1,
      per_page: 20,
      items: [{
        id_medico: 2,
        nombre_completo: 'Doctor Nuevo',
        foto_url: null,
        matricula_profesional: 'MAT-2',
        especialidades: [],
        servicios: [],
        disponibilidad: [],
      }],
    };

    let subject1Callback: any;
    mockHttp.get.mockReturnValueOnce({
      subscribe: (observer: any) => {
        subject1Callback = observer;
      },
    });

    // Disparar búsqueda 1
    comp.onBuscar();

    // Disparar búsqueda 2 inmediatamente que resuelve rápido
    mockHttp.get.mockReturnValueOnce(of(response2));
    comp.onBuscar();

    expect(comp.results()?.items[0].nombre_completo).toBe('Doctor Nuevo');

    // Ahora responde la búsqueda 1 retrasada
    subject1Callback.next(response1);

    // Debe seguir siendo el Doctor Nuevo!
    expect(comp.results()?.items[0].nombre_completo).toBe('Doctor Nuevo');
  });
});
