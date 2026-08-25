export interface Role {
  id_rol: number;
  nombre: string;
  descripcion?: string | null;
  estado?: string | null;
}

export interface RoleCreate {
  nombre: string;
  descripcion?: string | null;
}

export interface RoleUpdate {
  nombre: string;
  descripcion?: string | null;
}

export interface RoleStatusUpdate {
  estado: string;
}

export interface Permission {
  id_permiso: number;
  nombre?: string | null;
  descripcion?: string | null;
  codigo?: string | null;
  estado?: string | null;
}

export interface RolePermissionAssignment {
  id_permiso: number;
  nombre?: string | null;
  descripcion?: string | null;
  codigo?: string | null;
  estado?: string | null;
}

export type RolePermissionsUpdate = number[];
