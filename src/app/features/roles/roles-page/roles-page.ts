import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  Permission,
  Role,
  RoleCreate,
  RolePermissionAssignment,
  RolePermissionsUpdate,
  RoleStatusUpdate,
  RoleUpdate
} from '../../../core/models/role.models';
import { PermissionsService } from '../../../core/services/permissions.service';
import { RolesService } from '../../../core/services/roles.service';
import { RoleForm, RoleFormMode, RoleFormSubmitEvent } from '../role-form/role-form';
import { RolePermissionsForm } from '../role-permissions-form/role-permissions-form';

const ROLES_PER_PAGE = 6;

@Component({
  selector: 'app-roles-page',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RoleForm,
    RolePermissionsForm
  ],
  templateUrl: './roles-page.html',
  styleUrl: './roles-page.css'
})
export class RolesPage {
  private readonly rolesService = inject(RolesService);
  private readonly permissionsService = inject(PermissionsService);

  readonly roles = signal<Role[]>([]);
  readonly loadingRoles = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly forbiddenMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly searchTerm = signal('');
  readonly selectedStatus = signal<'all' | 'ACTIVO' | 'INACTIVO'>('all');
  readonly currentPage = signal(1);

  readonly isRoleFormOpen = signal(false);
  readonly roleFormMode = signal<RoleFormMode>('create');
  readonly selectedRole = signal<Role | null>(null);
  readonly savingRole = signal(false);
  readonly roleFormErrorMessage = signal<string | null>(null);

  readonly confirmTarget = signal<Role | null>(null);
  readonly updatingRoleStatus = signal<number | null>(null);
  readonly confirmSubmitting = signal(false);

  readonly isPermissionsFormOpen = signal(false);
  readonly permissionsTargetRole = signal<Role | null>(null);
  readonly permissionsCatalog = signal<Permission[]>([]);
  readonly rolePermissionIds = signal<number[]>([]);
  readonly loadingPermissions = signal(false);
  readonly savingPermissions = signal(false);
  readonly permissionsErrorMessage = signal<string | null>(null);

  readonly cachedRolePermissions = signal<Record<number, Permission[]>>({});

  readonly filteredRoles = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const selectedStatus = this.selectedStatus();

    return this.roles().filter((role) => {
      const matchesSearch = !term || [role.nombre, role.descripcion ?? '']
        .some((value) => value.toLowerCase().includes(term));

      const roleStatus = this.getNormalizedRoleStatus(role.estado);
      const matchesStatus = selectedStatus === 'all' || roleStatus === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  });

  readonly totalPages = computed(() => {
    const total = Math.ceil(this.filteredRoles().length / ROLES_PER_PAGE);
    return Math.max(total, 1);
  });

  readonly paginatedRoles = computed(() => {
    const start = (this.currentPage() - 1) * ROLES_PER_PAGE;
    return this.filteredRoles().slice(start, start + ROLES_PER_PAGE);
  });

  readonly hasActiveFilters = computed(() =>
    this.searchTerm().trim().length > 0 || this.selectedStatus() !== 'all'
  );

  constructor() {
    this.loadRoles();
  }

  loadRoles(): void {
    this.loadingRoles.set(true);
    this.errorMessage.set(null);
    this.forbiddenMessage.set(null);

    this.rolesService.getRoles().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.loadingRoles.set(false);
        this.ensureValidPage();
      },
      error: (error) => {
        this.loadingRoles.set(false);
        this.errorMessage.set(this.mapErrorMessage(error, 'No fue posible cargar los roles.'));
      }
    });
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.currentPage.set(1);
  }

  onStatusChange(value: string): void {
    this.selectedStatus.set(value as 'all' | 'ACTIVO' | 'INACTIVO');
    this.currentPage.set(1);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.selectedStatus.set('all');
    this.currentPage.set(1);
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update((page) => page - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update((page) => page + 1);
    }
  }

  openCreateForm(): void {
    this.roleFormMode.set('create');
    this.selectedRole.set(null);
    this.roleFormErrorMessage.set(null);
    this.isRoleFormOpen.set(true);
  }

  openEditForm(role: Role): void {
    this.roleFormMode.set('edit');
    this.selectedRole.set(role);
    this.roleFormErrorMessage.set(null);
    this.isRoleFormOpen.set(true);
  }

  closeRoleForm(): void {
    this.isRoleFormOpen.set(false);
    this.savingRole.set(false);
    this.roleFormErrorMessage.set(null);
  }

  submitRoleForm(event: RoleFormSubmitEvent): void {
    this.savingRole.set(true);
    this.roleFormErrorMessage.set(null);

    if (event.mode === 'create') {
      this.rolesService.createRole(event.payload as RoleCreate).subscribe({
        next: (createdRole) => {
          this.roles.update((roles) => [createdRole, ...roles]);
          this.successMessage.set('Rol creado correctamente.');
          this.savingRole.set(false);
          this.closeRoleForm();
          this.currentPage.set(1);
        },
        error: (error) => {
          this.savingRole.set(false);
          this.roleFormErrorMessage.set(this.mapErrorMessage(error, 'No fue posible crear el rol.'));
        }
      });
      return;
    }

    const selectedRole = this.selectedRole();
    if (!selectedRole) {
      this.savingRole.set(false);
      this.roleFormErrorMessage.set('No se encontró el rol a editar.');
      return;
    }

    this.rolesService.updateRole(selectedRole.id_rol, event.payload as RoleUpdate).subscribe({
      next: (updatedRole) => {
        this.roles.update((roles) =>
          roles.map((role) => role.id_rol === updatedRole.id_rol ? updatedRole : role)
        );
        this.successMessage.set('Rol actualizado correctamente.');
        this.savingRole.set(false);
        this.closeRoleForm();
      },
      error: (error) => {
        this.savingRole.set(false);
        this.roleFormErrorMessage.set(this.mapErrorMessage(error, 'No fue posible actualizar el rol.'));
      }
    });
  }

  askStatusChange(role: Role): void {
    this.confirmTarget.set(role);
  }

  closeStatusConfirm(): void {
    if (!this.confirmSubmitting()) {
      this.confirmTarget.set(null);
    }
  }

  confirmStatusChange(): void {
    const target = this.confirmTarget();
    if (!target) {
      return;
    }

    const currentStatus = this.getNormalizedRoleStatus(target.estado);
    if (currentStatus === 'DESCONOCIDO') {
      this.confirmSubmitting.set(false);
      this.errorMessage.set('No fue posible determinar el estado actual del rol.');
      return;
    }

    const nextStatus: RoleStatusUpdate['estado'] =
      currentStatus === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';

    this.confirmSubmitting.set(true);
    this.updatingRoleStatus.set(target.id_rol);
    this.errorMessage.set(null);

    this.rolesService.updateRoleStatus(target.id_rol, { estado: nextStatus }).subscribe({
      next: (updatedRole) => {
        this.roles.update((roles) =>
          roles.map((role) => role.id_rol === updatedRole.id_rol ? updatedRole : role)
        );
        this.successMessage.set(
          nextStatus === 'ACTIVO'
            ? 'Rol habilitado correctamente.'
            : 'Rol deshabilitado correctamente.'
        );
        this.confirmSubmitting.set(false);
        this.updatingRoleStatus.set(null);
        this.confirmTarget.set(null);
      },
      error: (error) => {
        this.confirmSubmitting.set(false);
        this.updatingRoleStatus.set(null);
        this.errorMessage.set(this.mapErrorMessage(error, 'No fue posible actualizar el estado del rol.'));
      }
    });
  }

  openPermissionsForm(role: Role): void {
    this.permissionsTargetRole.set(role);
    this.permissionsErrorMessage.set(null);
    this.loadingPermissions.set(true);
    this.savingPermissions.set(false);
    this.isPermissionsFormOpen.set(true);

    forkJoin({
      permissions: this.permissionsService.getPermissions(),
      assignments: this.permissionsService.getRolePermissions(role.id_rol)
    }).subscribe({
      next: ({ permissions, assignments }) => {
        const normalizedCatalog = this.normalizePermissions(permissions);
        const selectedIds = this.normalizeRolePermissionIds(assignments);
        this.permissionsCatalog.set(normalizedCatalog);
        this.rolePermissionIds.set(selectedIds);
        this.cachePermissionsForRole(role.id_rol, normalizedCatalog, selectedIds);
        this.loadingPermissions.set(false);
      },
      error: (error) => {
        this.loadingPermissions.set(false);
        this.permissionsErrorMessage.set(
          this.mapErrorMessage(error, 'No fue posible cargar los permisos del rol.')
        );
      }
    });
  }

  closePermissionsForm(): void {
    this.isPermissionsFormOpen.set(false);
    this.permissionsTargetRole.set(null);
    this.loadingPermissions.set(false);
    this.savingPermissions.set(false);
    this.permissionsErrorMessage.set(null);
  }

  submitPermissions(permissionIds: number[]): void {
    const role = this.permissionsTargetRole();
    if (!role) {
      return;
    }

    this.savingPermissions.set(true);
    this.permissionsErrorMessage.set(null);

    const payload: RolePermissionsUpdate = permissionIds;

    this.permissionsService.updateRolePermissions(role.id_rol, payload).subscribe({
      next: () => {
        this.rolePermissionIds.set(permissionIds);
        this.cachePermissionsForRole(role.id_rol, this.permissionsCatalog(), permissionIds);
        this.successMessage.set('Permisos actualizados correctamente.');
        this.savingPermissions.set(false);
        this.closePermissionsForm();
      },
      error: (error) => {
        this.savingPermissions.set(false);
        this.permissionsErrorMessage.set(
          this.mapErrorMessage(error, 'No fue posible actualizar los permisos del rol.')
        );
      }
    });
  }

  exportCsv(): void {
    const header = ['Rol', 'Descripción', 'Estado'];
    const rows = this.filteredRoles().map((role) => [
      role.nombre,
      role.descripcion ?? '',
      this.getStatusLabel(role.estado)
    ]);

    const csvContent = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'roles.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  getStatusLabel(status?: string | null): string {
    const normalized = this.getNormalizedRoleStatus(status);
    if (normalized === 'ACTIVO') {
      return 'Activo';
    }
    if (normalized === 'INACTIVO') {
      return 'Inactivo';
    }
    return 'No disponible';
  }

  getStatusBadgeClasses(status?: string | null): string[] {
    const normalized = this.getNormalizedRoleStatus(status);
    if (normalized === 'ACTIVO') {
      return ['bg-secondary-container/60', 'text-secondary', 'border-secondary/15'];
    }
    if (normalized === 'INACTIVO') {
      return ['bg-error-container/70', 'text-red-600', 'border-error/15'];
    }
    return ['bg-surface-container', 'text-on-surface-variant', 'border-outline-variant/20'];
  }

  getStatusActionClasses(status?: string | null): string[] {
    const normalized = this.getNormalizedRoleStatus(status);
    if (normalized === 'ACTIVO') {
      return ['text-red-600', 'hover:bg-error-container/45'];
    }
    if (normalized === 'INACTIVO') {
      return ['text-secondary', 'hover:bg-secondary-container/45'];
    }
    return ['text-on-surface-variant'];
  }

  getStatusActionLabel(status?: string | null): string {
    const normalized = this.getNormalizedRoleStatus(status);
    if (normalized === 'ACTIVO') {
      return 'Deshabilitar rol';
    }
    if (normalized === 'INACTIVO') {
      return 'Habilitar rol';
    }
    return 'Estado no disponible';
  }

  getStatusActionIcon(status?: string | null): string {
    const normalized = this.getNormalizedRoleStatus(status);
    if (normalized === 'ACTIVO') {
      return 'toggle_off';
    }
    if (normalized === 'INACTIVO') {
      return 'toggle_on';
    }
    return 'help';
  }

  canToggleStatus(status?: string | null): boolean {
    return this.getNormalizedRoleStatus(status) !== 'DESCONOCIDO';
  }

  getRoleInitials(role: Role): string {
    const words = role.nombre.trim().split(/\s+/).filter(Boolean);
    const initials = words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join('');
    return initials || 'RL';
  }

  getRoleDescription(role: Role): string {
    return role.descripcion?.trim() || 'Sin descripción disponible.';
  }

  getPermissionsSummary(roleId: number): Permission[] {
    return this.cachedRolePermissions()[roleId] ?? [];
  }

  getVisiblePermissionsSummary(roleId: number): Permission[] {
    return this.getPermissionsSummary(roleId).slice(0, 3);
  }

  getRemainingPermissionsCount(roleId: number): number {
    const permissions = this.getPermissionsSummary(roleId);
    return permissions.length > 3 ? permissions.length - 3 : 0;
  }

  getPermissionDisplayName(permission: Permission): string {
    const nombre = permission.nombre?.trim();
    if (nombre) {
      return nombre;
    }

    const codigo = permission.codigo?.trim();
    if (codigo) {
      return codigo;
    }

    return `ID ${permission.id_permiso}`;
  }

  getRangeStart(): number {
    return this.paginatedRoles().length ? ((this.currentPage() - 1) * ROLES_PER_PAGE) + 1 : 0;
  }

  getRangeEnd(): number {
    return ((this.currentPage() - 1) * ROLES_PER_PAGE) + this.paginatedRoles().length;
  }

  trackByRoleId(_index: number, role: Role): number {
    return role.id_rol;
  }

  hasPermissionCache(roleId: number): boolean {
    return Object.prototype.hasOwnProperty.call(this.cachedRolePermissions(), roleId);
  }

  private ensureValidPage(): void {
    if (this.currentPage() > this.totalPages()) {
      this.currentPage.set(this.totalPages());
    }
  }

  getNormalizedRoleStatus(status?: string | null): 'ACTIVO' | 'INACTIVO' | 'DESCONOCIDO' {
    if (!status) {
      return 'DESCONOCIDO';
    }

    const normalized = status.toUpperCase();
    if (normalized === 'ACTIVO') {
      return 'ACTIVO';
    }
    if (normalized === 'INACTIVO') {
      return 'INACTIVO';
    }
    return 'DESCONOCIDO';
  }

  private normalizePermissions(items: Permission[]): Permission[] {
    return items
      .filter((item): item is Permission => !!item && typeof item.id_permiso === 'number')
      .map((item) => ({
        id_permiso: item.id_permiso,
        nombre: item.nombre ?? null,
        descripcion: item.descripcion ?? null,
        codigo: item.codigo ?? null,
        estado: item.estado ?? null
      }));
  }

  private normalizeRolePermissionIds(items: Array<RolePermissionAssignment | Permission | number>): number[] {
    const ids = items.map((item) => {
      if (typeof item === 'number') {
        return item;
      }

      if (item && typeof item.id_permiso === 'number') {
        return item.id_permiso;
      }

      return null;
    }).filter((id): id is number => id !== null);

    return [...new Set(ids)];
  }

  private cachePermissionsForRole(roleId: number, catalog: Permission[], selectedIds: number[]): void {
    const permissions = catalog.filter((permission) => selectedIds.includes(permission.id_permiso));
    this.cachedRolePermissions.update((current) => ({
      ...current,
      [roleId]: permissions
    }));
  }

  private mapErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) {
        this.forbiddenMessage.set('No tienes permisos para administrar roles y permisos.');
        return 'No tienes permisos para administrar roles y permisos.';
      }
      if (error.status === 404) {
        return 'El recurso solicitado no existe.';
      }
      if (error.status === 409) {
        return typeof error.error?.detail === 'string'
          ? error.error.detail
          : 'Ya existe un rol con ese nombre.';
      }
      if (error.status === 422) {
        const detail = error.error?.detail;
        if (Array.isArray(detail)) {
          return detail
            .map((item: { msg?: string }) => item.msg)
            .filter((msg: string | undefined): msg is string => !!msg)
            .join(', ');
        }
        if (typeof detail === 'string') {
          return detail;
        }
        return 'Revisa los datos enviados.';
      }
      if (error.status >= 500) {
        return 'Ocurrió un error inesperado. Intenta nuevamente.';
      }
    }

    return fallback;
  }
}
