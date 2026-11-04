import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackupService } from '../services/backup.service';
import { AuthService } from '../../../../core/services/auth.service';
import { TenantService } from '../../../../core/services/tenant.service';
import {
  BackupConfig,
  BackupFile,
  DIAS_SEMANA,
  DiaSemana,
} from '../models/backup.models';

@Component({
  selector: 'app-backups-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './backups-page.html',
  styleUrl: './backups-page.css',
})
export class BackupsPage implements OnInit {
  private readonly backupService = inject(BackupService);
  private readonly authService = inject(AuthService);
  readonly tenantService = inject(TenantService);

  readonly archivos = signal<BackupFile[]>([]);
  /** Copias hechas con "Generar copia ahora" (origen manual o sin origen legacy). */
  readonly manuales = computed(() =>
    this.archivos().filter((a) => (a.origen ?? 'manual') === 'manual'),
  );
  /** Copias hechas por la programación automática. */
  readonly automaticas = computed(() =>
    this.archivos().filter((a) => a.origen === 'automatica'),
  );
  readonly isLoading = signal<boolean>(false);
  readonly isGenerating = signal<boolean>(false);
  readonly isRestoring = signal<boolean>(false);
  readonly isSavingConfig = signal<boolean>(false);
  readonly mensaje = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly config = signal<BackupConfig | null>(null);
  hora: string = '02:00';
  dias: Record<DiaSemana, boolean> = {
    lun: true, mar: true, mie: true, jue: true, vie: true, sab: true, dom: true,
  };
  activo: boolean = true;
  retencionDias: number = 7;

  readonly diasDisponibles = DIAS_SEMANA;
  restoreArmed = false;

  ngOnInit(): void {
    this.cargar();
    this.cargarConfig();
  }

  get puedeGestionar(): boolean {
    return !this.tenantService.isSuperAdmin() && this.authService.isAdmin();
  }

  cargar(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.backupService.listar().subscribe({
      next: (res) => {
        this.archivos.set(res.data ?? []);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(this.backupService.errorMessage(err));
        this.isLoading.set(false);
      },
    });
  }

  generar(): void {
    this.isGenerating.set(true);
    this.mensaje.set(null);
    this.errorMessage.set(null);
    this.backupService.generar().subscribe({
      next: (res) => {
        const nombre = this.backupService.filename(res, `backup_${this.fechaHoy()}.sql`);
        this.backupService.download(res, nombre);
        this.mensaje.set(`Copia generada y descargada: ${nombre}`);
        this.isGenerating.set(false);
        this.cargar();
        this.cargarConfig();
      },
      error: (err) => {
        this.errorMessage.set(this.backupService.errorMessage(err));
        this.isGenerating.set(false);
      },
    });
  }

  descargar(archivo: BackupFile): void {
    this.errorMessage.set(null);
    this.backupService.descargar(archivo.nombre).subscribe({
      next: (res) => this.backupService.download(res, archivo.nombre),
      error: (err) => this.errorMessage.set(this.backupService.errorMessage(err)),
    });
  }

  onArchivoRestore(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    if (!archivo.name.endsWith('.sql')) {
      this.errorMessage.set('El archivo debe tener extensión .sql');
      return;
    }
    if (!this.restoreArmed) {
      this.restoreArmed = true;
      this.mensaje.set(
        `Vas a restaurar la base completa desde ${archivo.name}. Vuelve a elegir el archivo para confirmar.`,
      );
      this.pendingRestore.set(archivo);
      return;
    }
    this.ejecutarRestore(archivo);
  }

  private readonly pendingRestore = signal<File | null>(null);

  private ejecutarRestore(archivo: File): void {
    this.restoreArmed = false;
    this.pendingRestore.set(null);
    this.isRestoring.set(true);
    this.mensaje.set(null);
    this.errorMessage.set(null);
    this.backupService.restaurar(archivo).subscribe({
      next: (res) => {
        this.mensaje.set(res.mensaje);
        this.isRestoring.set(false);
      },
      error: (err) => {
        this.errorMessage.set(this.backupService.errorMessage(err));
        this.isRestoring.set(false);
      },
    });
  }

  cargarConfig(): void {
    this.backupService.getConfig().subscribe({
      next: (cfg) => {
        this.config.set(cfg);
        this.hora = cfg.hora;
        this.activo = cfg.activo;
        this.retencionDias = cfg.retencion_dias;
        for (const d of DIAS_SEMANA) this.dias[d.valor] = cfg.dias_semana.includes(d.valor);
      },
      error: () => undefined,
    });
  }

  guardarConfig(): void {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(this.hora)) {
      this.errorMessage.set('Hora inválida. Usa formato HH:MM de 24h (ej. 02:00, hora Bolivia).');
      return;
    }
    const dias = DIAS_SEMANA.filter((d) => this.dias[d.valor]).map((d) => d.valor);
    if (dias.length === 0) {
      this.errorMessage.set('Elige al menos un día de la semana.');
      return;
    }
    if (this.retencionDias < 1) {
      this.errorMessage.set('La retención mínima es 1 día.');
      return;
    }
    this.isSavingConfig.set(true);
    this.mensaje.set(null);
    this.errorMessage.set(null);
    this.backupService
      .updateConfig({ hora: this.hora, dias_semana: dias, activo: this.activo, retencion_dias: this.retencionDias })
      .subscribe({
        next: (cfg) => {
          this.config.set(cfg);
          this.mensaje.set(`Programación guardada: ${cfg.hora} (hora Bolivia).`);
          this.isSavingConfig.set(false);
        },
        error: (err) => {
          this.errorMessage.set(this.backupService.errorMessage(err));
          this.isSavingConfig.set(false);
        },
      });
  }

  formatoTamanio(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  private fechaHoy(): string {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
  }
}
