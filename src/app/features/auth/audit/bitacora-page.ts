import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditService } from '../../../core/services/audit.service';
import { AuditLogEntry, AuditLogFilters, AuditLogListResponse } from '../../../core/models/audit.models';

@Component({
  selector: 'app-bitacora-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bitacora-page.html',
  styleUrls: ['./bitacora-page.css']
})
export class BitacoraPage implements OnInit {
  private readonly auditService = inject(AuditService);

  // State signals
  readonly logs = signal<AuditLogEntry[]>([]);
  readonly total = signal<number>(0);
  readonly page = signal<number>(1);
  readonly pageSize = signal<number>(15);
  readonly totalPages = signal<number>(1);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  // Detail Modal signals
  readonly selectedLog = signal<AuditLogEntry | null>(null);
  readonly isDetailOpen = signal<boolean>(false);

  // Exporting signals
  readonly isExportingPdf = signal<boolean>(false);
  readonly isExportingExcel = signal<boolean>(false);

  // Filter models
  busqueda: string = '';
  accionFiltro: string = '';
  tablaFiltro: string = '';
  fechaInicio: string = '';
  fechaFin: string = '';

  // Options
  readonly accionesDisponibles = [
    { label: 'Todas las acciones', value: '' },
    { label: 'INSERT (Creación)', value: 'INSERT' },
    { label: 'UPDATE (Modificación)', value: 'UPDATE' },
    { label: 'DELETE (Baja / Eliminación)', value: 'DELETE' },
    { label: 'SELECT (Lectura)', value: 'SELECT' },
    { label: 'LOGIN (Inicio de sesión)', value: 'LOGIN' },
    { label: 'LOGOUT (Cierre de sesión)', value: 'LOGOUT' },
  ];

  readonly tablasDisponibles = [
    { label: 'Todas las tablas', value: '' },
    { label: 'Pacientes (pacientes)', value: 'pacientes' },
    { label: 'Usuarios (usuarios)', value: 'usuarios' },
    { label: 'Roles y Permisos (roles)', value: 'roles' },
    { label: 'Médicos (medicos)', value: 'medicos' },
    { label: 'Historias Clínicas (historias_clinicas)', value: 'historias_clinicas' },
    { label: 'Citas (citas)', value: 'citas' },
    { label: 'Fichas Clínicas (fichas_clinicas)', value: 'fichas_clinicas' },
    { label: 'Documentos Clínicos (documentos_clinicos)', value: 'documentos_clinicos' },
  ];

  ngOnInit(): void {
    this.loadLogs();
  }

  private buildCurrentFilters(): AuditLogFilters {
    const filters: AuditLogFilters = {};
    if (this.busqueda.trim()) filters.busqueda = this.busqueda.trim();
    if (this.accionFiltro) filters.accion = this.accionFiltro;
    if (this.tablaFiltro) filters.tabla_afectada = this.tablaFiltro;
    if (this.fechaInicio) filters.fecha_inicio = this.fechaInicio;
    if (this.fechaFin) filters.fecha_fin = this.fechaFin;
    return filters;
  }

  loadLogs(pageToLoad: number = this.page()): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const filters = this.buildCurrentFilters();

    this.auditService.getAuditLogs(filters, pageToLoad, this.pageSize()).subscribe({
      next: (res) => {
        this.logs.set(res.data || []);
        this.total.set(res.total || 0);
        this.page.set(res.page || 1);
        this.totalPages.set(res.total_pages || 1);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar la bitácora:', err);
        this.errorMessage.set('No se pudo cargar los registros de auditoría. Intente nuevamente.');
        this.isLoading.set(false);
      }
    });
  }

  applyFilters(): void {
    this.page.set(1);
    this.loadLogs(1);
  }

  clearFilters(): void {
    this.busqueda = '';
    this.accionFiltro = '';
    this.tablaFiltro = '';
    this.fechaInicio = '';
    this.fechaFin = '';
    this.page.set(1);
    this.loadLogs(1);
  }

  setPage(targetPage: number): void {
    if (targetPage < 1 || targetPage > this.totalPages() || targetPage === this.page()) {
      return;
    }
    this.loadLogs(targetPage);
  }

  openDetail(log: AuditLogEntry): void {
    this.selectedLog.set(log);
    this.isDetailOpen.set(true);
  }

  closeDetail(): void {
    this.isDetailOpen.set(false);
    this.selectedLog.set(null);
  }

  exportPdf(): void {
    if (this.isExportingPdf()) return;
    this.isExportingPdf.set(true);
    const filters = this.buildCurrentFilters();

    this.auditService.exportPdf(filters).subscribe({
      next: (blob) => {
        const timestamp = new Date().toISOString().slice(0, 10);
        this.auditService.downloadBlob(blob, `bitacora_auditoria_${timestamp}.pdf`);
        this.isExportingPdf.set(false);
      },
      error: (err) => {
        console.error('Error al exportar PDF:', err);
        alert('Error al generar el archivo PDF de auditoría.');
        this.isExportingPdf.set(false);
      }
    });
  }

  exportExcel(): void {
    if (this.isExportingExcel()) return;
    this.isExportingExcel.set(true);
    const filters = this.buildCurrentFilters();

    this.auditService.exportExcel(filters).subscribe({
      next: (blob) => {
        const timestamp = new Date().toISOString().slice(0, 10);
        this.auditService.downloadBlob(blob, `bitacora_auditoria_${timestamp}.xlsx`);
        this.isExportingExcel.set(false);
      },
      error: (err) => {
        console.error('Error al exportar Excel:', err);
        alert('Error al generar el archivo Excel de auditoría.');
        this.isExportingExcel.set(false);
      }
    });
  }

  getActionBadgeClass(accion: string): string {
    const act = (accion || '').toUpperCase();
    switch (act) {
      case 'INSERT':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 ring-emerald-600/10';
      case 'UPDATE':
        return 'bg-blue-50 text-blue-700 border-blue-200/80 ring-blue-600/10';
      case 'DELETE':
        return 'bg-rose-50 text-rose-700 border-rose-200/80 ring-rose-600/10';
      case 'SELECT':
        return 'bg-purple-50 text-purple-700 border-purple-200/80 ring-purple-600/10';
      case 'LOGIN':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 ring-emerald-600/10';
      case 'LOGOUT':
        return 'bg-amber-50 text-amber-700 border-amber-200/80 ring-amber-600/10';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200/80 ring-slate-600/10';
    }
  }

  formatJson(data: unknown): string {
    if (data === null || data === undefined) return 'Sin datos';
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return data;
      }
    }
    return JSON.stringify(data, null, 2);
  }

  hasData(data: unknown): boolean {
    if (data === null || data === undefined) return false;
    if (typeof data === 'object' && Object.keys(data).length === 0) return false;
    return true;
  }
}
