import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminUser, AdminUserCreate, AdminUserStatusUpdate, AdminUserUpdate, UserRole } from '../../../core/models/user.models';
import { UsersService } from '../../../core/services/users.service';
import { UserForm, UserFormMode, UserFormSubmitEvent } from '../user-form/user-form';

const USERS_PER_PAGE = 6;

@Component({
  selector: 'app-users-page',
  imports: [CommonModule, FormsModule, RouterLink, DatePipe, UserForm],
  templateUrl: './users-page.html',
  styleUrl: './users-page.css'
})
export class UsersPage {
  private readonly usersService = inject(UsersService);

  readonly users = signal<AdminUser[]>([]);
  readonly roles = signal<UserRole[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly forbiddenMessage = signal<string | null>(null);

  readonly searchTerm = signal('');
  readonly selectedRoleId = signal<number | 'all'>('all');
  readonly selectedStatus = signal<'all' | 'activo' | 'inactivo'>('all');
  readonly currentPage = signal(1);

  readonly isFormOpen = signal(false);
  readonly formMode = signal<UserFormMode>('create');
  readonly selectedUser = signal<AdminUser | null>(null);
  readonly formLoading = signal(false);
  readonly formSubmitting = signal(false);
  readonly formErrorMessage = signal<string | null>(null);

  readonly statusMutationId = signal<number | null>(null);
  readonly confirmTarget = signal<AdminUser | null>(null);
  readonly confirmSubmitting = signal(false);

  readonly roleMap = computed(() => {
    const map = new Map<number, string>();
    for (const role of this.roles()) {
      map.set(role.id_rol, role.nombre);
    }
    return map;
  });

  readonly filteredUsers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const selectedRoleId = this.selectedRoleId();
    const selectedStatus = this.selectedStatus();

    return this.users().filter((user) => {
      const matchesSearch = !term || [user.nombres, user.apellidos, user.correo]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term));

      const matchesRole = selectedRoleId === 'all' || user.id_rol === selectedRoleId;
      const matchesStatus = selectedStatus === 'all' || user.estado.toLowerCase() === selectedStatus;

      return matchesSearch && matchesRole && matchesStatus;
    });
  });

  readonly totalPages = computed(() => {
    const total = Math.ceil(this.filteredUsers().length / USERS_PER_PAGE);
    return Math.max(total, 1);
  });

  readonly paginatedUsers = computed(() => {
    const start = (this.currentPage() - 1) * USERS_PER_PAGE;
    return this.filteredUsers().slice(start, start + USERS_PER_PAGE);
  });

  readonly hasActiveFilters = computed(() =>
    this.searchTerm().trim().length > 0 ||
    this.selectedRoleId() !== 'all' ||
    this.selectedStatus() !== 'all'
  );

  constructor() {
    this.loadRoles();
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.forbiddenMessage.set(null);

    this.usersService.getUsers().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
        this.ensureValidPage();
      },
      error: (error) => {
        this.loading.set(false);
        this.errorMessage.set(this.mapErrorMessage(error, 'No fue posible cargar los usuarios.'));
      }
    });
  }

  loadRoles(): void {
    this.usersService.getRoles().subscribe({
      next: (roles) => this.roles.set(roles),
      error: () => {}
    });
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.currentPage.set(1);
  }

  onRoleChange(value: string): void {
    this.selectedRoleId.set(value === 'all' ? 'all' : Number(value));
    this.currentPage.set(1);
  }

  onStatusChange(value: string): void {
    this.selectedStatus.set(value as 'all' | 'activo' | 'inactivo');
    this.currentPage.set(1);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.selectedRoleId.set('all');
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
    this.formMode.set('create');
    this.selectedUser.set(null);
    this.formErrorMessage.set(null);
    this.formLoading.set(false);
    this.isFormOpen.set(true);
  }

  openEditForm(user: AdminUser): void {
    this.formMode.set('edit');
    this.selectedUser.set(null);
    this.formErrorMessage.set(null);
    this.formLoading.set(true);
    this.isFormOpen.set(true);

    this.usersService.getUserById(user.id_usuario).subscribe({
      next: (detail) => {
        this.selectedUser.set(detail);
        this.formLoading.set(false);
      },
      error: (error) => {
        this.formLoading.set(false);
        this.formErrorMessage.set(this.mapErrorMessage(error, 'No fue posible cargar el usuario.'));
      }
    });
  }

  closeForm(): void {
    this.isFormOpen.set(false);
    this.formLoading.set(false);
    this.formSubmitting.set(false);
    this.formErrorMessage.set(null);
  }

  submitForm(event: UserFormSubmitEvent): void {
    this.formSubmitting.set(true);
    this.formErrorMessage.set(null);

    if (event.mode === 'create') {
      this.usersService.createUser(event.payload as AdminUserCreate).subscribe({
        next: (createdUser) => {
          this.users.update((users) => [createdUser, ...users]);
          this.successMessage.set('Usuario creado correctamente.');
          this.formSubmitting.set(false);
          this.closeForm();
          this.currentPage.set(1);
        },
        error: (error) => {
          this.formSubmitting.set(false);
          this.formErrorMessage.set(this.mapErrorMessage(error, 'No fue posible crear el usuario.'));
        }
      });
      return;
    }

    const selectedUser = this.selectedUser();
    if (!selectedUser) {
      this.formSubmitting.set(false);
      this.formErrorMessage.set('No se encontró el usuario a editar.');
      return;
    }

    this.usersService.updateUser(selectedUser.id_usuario, event.payload as AdminUserUpdate).subscribe({
      next: (updatedUser) => {
        this.users.update((users) =>
          users.map((user) => user.id_usuario === updatedUser.id_usuario ? updatedUser : user)
        );
        this.successMessage.set('Usuario actualizado correctamente.');
        this.formSubmitting.set(false);
        this.closeForm();
      },
      error: (error) => {
        this.formSubmitting.set(false);
        this.formErrorMessage.set(this.mapErrorMessage(error, 'No fue posible actualizar el usuario.'));
      }
    });
  }

  askStatusChange(user: AdminUser): void {
    this.confirmTarget.set(user);
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

    const nextStatus: AdminUserStatusUpdate['estado'] =
      target.estado.toLowerCase() === 'activo' ? 'inactivo' : 'activo';

    this.confirmSubmitting.set(true);
    this.statusMutationId.set(target.id_usuario);
    this.errorMessage.set(null);

    this.usersService.updateUserStatus(target.id_usuario, { estado: nextStatus }).subscribe({
      next: (updatedUser) => {
        this.users.update((users) =>
          users.map((user) => user.id_usuario === updatedUser.id_usuario ? updatedUser : user)
        );
        this.successMessage.set(
          nextStatus === 'activo'
            ? 'Usuario habilitado correctamente.'
            : 'Usuario deshabilitado correctamente.'
        );
        this.confirmSubmitting.set(false);
        this.statusMutationId.set(null);
        this.confirmTarget.set(null);
      },
      error: (error) => {
        this.confirmSubmitting.set(false);
        this.statusMutationId.set(null);
        this.errorMessage.set(this.mapErrorMessage(error, 'No fue posible actualizar el estado del usuario.'));
      }
    });
  }

  exportCsv(): void {
    const header = ['Usuario', 'Correo', 'Rol', 'Estado', 'Fecha de registro'];
    const rows = this.filteredUsers().map((user) => [
      `${user.nombres} ${user.apellidos}`.trim(),
      user.correo,
      this.getRoleName(user.id_rol),
      this.getStatusLabel(user.estado),
      this.formatDateForExport(user.fecha_creacion)
    ]);

    const csvContent = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'usuarios.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  getRoleName(idRol: number): string {
    return this.roleMap().get(idRol) ?? `Rol #${idRol}`;
  }

  getStatusLabel(status: string): string {
    return status.toLowerCase() === 'activo' ? 'Activo' : 'Inactivo';
  }

  getRowInitials(user: AdminUser): string {
    const initials = `${user.nombres.charAt(0)}${user.apellidos.charAt(0)}`.trim();
    return initials.toUpperCase() || 'US';
  }

  getRangeStart(): number {
    return this.paginatedUsers().length ? ((this.currentPage() - 1) * USERS_PER_PAGE) + 1 : 0;
  }

  getRangeEnd(): number {
    return ((this.currentPage() - 1) * USERS_PER_PAGE) + this.paginatedUsers().length;
  }

  trackByUserId(_index: number, user: AdminUser): number {
    return user.id_usuario;
  }

  private ensureValidPage(): void {
    if (this.currentPage() > this.totalPages()) {
      this.currentPage.set(this.totalPages());
    }
  }

  private mapErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) {
        this.forbiddenMessage.set('No tienes permisos para administrar usuarios.');
        return 'No tienes permisos para administrar usuarios.';
      }
      if (error.status === 404) {
        return 'El recurso solicitado no existe.';
      }
      if (error.status === 409) {
        return 'El correo electrónico ya está registrado.';
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

  private formatDateForExport(value?: string | null): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
