import { CommonModule } from '@angular/common';
import { Component, computed, effect, input, output, signal } from '@angular/core';
import { Permission, Role } from '../../../../core/models/role.models';

@Component({
  selector: 'app-role-permissions-form',
  imports: [CommonModule],
  templateUrl: './role-permissions-form.html',
  styleUrl: './role-permissions-form.css'
})
export class RolePermissionsForm {
  readonly visible = input<boolean>(false);
  readonly role = input<Role | null>(null);
  readonly permissions = input<Permission[]>([]);
  readonly selectedPermissionIds = input<number[]>([]);
  readonly loadingCatalog = input<boolean>(false);
  readonly loadingAssignments = input<boolean>(false);
  readonly submitting = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);

  readonly cancel = output<void>();
  readonly submitted = output<number[]>();

  readonly localSelection = signal<number[]>([]);

  readonly isLoading = computed(() => this.loadingCatalog() || this.loadingAssignments());

  readonly title = computed(() => {
    const role = this.role();
    return role ? `Permisos de ${role.nombre}` : 'Permisos del rol';
  });

  constructor() {
    effect(() => {
      this.localSelection.set([...this.selectedPermissionIds()]);
    });
  }

  close(): void {
    if (!this.submitting()) {
      this.cancel.emit();
    }
  }

  isSelected(idPermiso: number): boolean {
    return this.localSelection().includes(idPermiso);
  }

  togglePermission(idPermiso: number): void {
    const current = this.localSelection();
    if (current.includes(idPermiso)) {
      this.localSelection.set(current.filter((id) => id !== idPermiso));
      return;
    }

    this.localSelection.set([...current, idPermiso]);
  }

  getPermissionLabel(permission: Permission): string {
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

  onSubmit(): void {
    this.submitted.emit([...this.localSelection()]);
  }
}
