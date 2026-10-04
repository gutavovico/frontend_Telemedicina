import { Component, inject } from '@angular/core';
import { InactivityService } from '../../../core/services/inactivity.service';

/**
 * Aviso de cierre por inactividad con cuenta regresiva (CU23).
 *
 * Se monta en la raíz de la aplicación para que el aviso aparezca sobre
 * cualquier ruta, y solo se renderiza cuando el contador está activo.
 */
@Component({
  selector: 'app-inactivity-warning',
  templateUrl: './inactivity-warning.html',
  styleUrl: './inactivity-warning.css'
})
export class InactivityWarning {
  readonly inactivity = inject(InactivityService);

  continue(): void {
    this.inactivity.continueSession();
  }
}
