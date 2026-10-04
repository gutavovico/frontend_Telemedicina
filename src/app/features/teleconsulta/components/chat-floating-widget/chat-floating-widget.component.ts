import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TeleconsultaService } from '../../services/teleconsulta.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Cita } from '../../../../core/models/appointment.models';
import { ChatMessageDTO } from '../../../../core/models/teleconsulta.models';

@Component({
  selector: 'app-chat-floating-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-floating-widget.component.html',
  styleUrl: './chat-floating-widget.component.css'
})
export class ChatFloatingWidgetComponent implements OnInit, OnDestroy, OnChanges {
  readonly teleconsultaService = inject(TeleconsultaService);
  readonly authService = inject(AuthService);

  @Input({ required: true }) idCita!: number;
  @Input() citaInfo?: any;
  @Input() interlocutorNombreOverride?: string;
  @Input() interlocutorSubtituloOverride?: string;
  @Input() clinicaNombreOverride?: string;
  @Input() fechaHoraOverride?: string;
  @Input() fichaNumeroOverride?: string;
  @Output() cerrar = new EventEmitter<void>();

  @ViewChild('chatScrollContainer') chatScrollContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  nuevoMensaje = signal<string>('');
  enviando = signal<boolean>(false);
  adjuntoPendiente = signal<{ nombre: string; tamano: string; url: string } | null>(null);

  // Computar el nombre del interlocutor y sus iniciales con seguridad contra nulls
  readonly interlocutor = computed(() => {
    if (this.interlocutorNombreOverride) {
      const nombre = this.interlocutorNombreOverride;
      const clean = nombre.replace(/Dr\(a\)\.\s*|Dr\.\s*|Dra\.\s*/gi, '').trim();
      const parts = clean.split(/\s+/);
      const ini = ((parts[0]?.[0] || 'D') + (parts[1]?.[0] || 'R')).toUpperCase();
      return {
        nombre,
        iniciales: ini,
        subtitulo: this.interlocutorSubtituloOverride || 'Suele responder en 2 h',
        avatarUrl: null
      };
    }

    const userRole = this.authService.userRole();
    const isDoc = userRole === 'doctor' || userRole === 'admin' || this.authService.isDoctor() || this.authService.isAdmin();
    const data = this.teleconsultaService.teleconsulta();

    if (isDoc) {
      // Para el médico o admin, el interlocutor es el PACIENTE
      const pac = data?.paciente;
      const nombre = pac?.nombreCompleto || this.citaInfo?.paciente_nombre || this.citaInfo?.pacienteNombre || 'Paciente';
      const parts = (nombre || 'Paciente').trim().split(/\s+/);
      const ini = ((parts[0]?.[0] || 'P') + (parts[1]?.[0] || 'A')).toUpperCase();
      return {
        nombre,
        iniciales: ini,
        subtitulo: this.interlocutorSubtituloOverride || 'Paciente · Consulta activa',
        avatarUrl: null
      };
    } else {
      // Para el paciente, el interlocutor es el MÉDICO
      const doc = data?.medico;
      const nombre = doc?.nombreCompleto || this.citaInfo?.medico_nombre || this.citaInfo?.medicoNombre || 'Dr(a). Médico Especialista';
      const especialidad = data?.cita?.especialidad || this.citaInfo?.especialidad_nombre || this.citaInfo?.especialidad || 'Medicina General';
      const clean = (nombre || 'Dr').replace(/Dr\(a\)\.\s*|Dr\.\s*|Dra\.\s*/gi, '').trim();
      const parts = clean.split(/\s+/);
      const ini = ((parts[0]?.[0] || 'D') + (parts[1]?.[0] || 'R')).toUpperCase();
      return {
        nombre,
        iniciales: ini,
        subtitulo: this.interlocutorSubtituloOverride || `${especialidad} · Suele responder en 2 h`,
        avatarUrl: doc?.fotoUrl || null
      };
    }
  });

  // Mensajes ordenados y alineados
  readonly mensajes = computed(() => {
    const msgs = this.teleconsultaService.mensajes();
    const user = this.authService.currentUser();
    const currentUserId = user?.id_usuario;

    return msgs.map((m) => ({
      ...m,
      esPropio: currentUserId ? m.idRemitente === currentUserId : m.esPropio
    }));
  });

  constructor() {
    effect(() => {
      // Cada vez que cambian los mensajes, auto-scroll al final
      const _ = this.teleconsultaService.mensajes();
      setTimeout(() => this.scrollToBottom(), 50);
    });
  }

  ngOnInit(): void {
    this.iniciarChat();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['idCita'] && !changes['idCita'].firstChange) {
      this.iniciarChat();
    }
  }

  ngOnDestroy(): void {
    this.teleconsultaService.detenerPolling();
  }

  private iniciarChat(): void {
    if (this.idCita && this.idCita > 0) {
      this.teleconsultaService.cargarTeleconsulta(this.idCita);
      this.teleconsultaService.iniciarPolling(this.idCita, 3500);
    }
  }

  enviar(): void {
    const texto = this.nuevoMensaje().trim();
    const adjunto = this.adjuntoPendiente();

    if (!texto && !adjunto) return;

    this.enviando.set(true);

    this.teleconsultaService.enviarMensaje(texto, this.idCita, adjunto || undefined);

    this.nuevoMensaje.set('');
    this.adjuntoPendiente.set(null);
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }

    setTimeout(() => {
      this.enviando.set(false);
      this.scrollToBottom();
    }, 150);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.enviar();
    }
  }

  seleccionarArchivo(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const tamanoKb = Math.round(file.size / 1024);
      const tamanoStr = tamanoKb > 1024 ? `${(tamanoKb / 1024).toFixed(1)} MB` : `${tamanoKb} KB`;

      this.adjuntoPendiente.set({
        nombre: file.name,
        tamano: tamanoStr,
        url: URL.createObjectURL(file)
      });
    }
  }

  quitarAdjunto(): void {
    this.adjuntoPendiente.set(null);
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  cerrarChat(): void {
    this.teleconsultaService.detenerPolling();
    this.cerrar.emit();
  }

  private scrollToBottom(): void {
    if (this.chatScrollContainer?.nativeElement) {
      this.chatScrollContainer.nativeElement.scrollTop =
        this.chatScrollContainer.nativeElement.scrollHeight;
    }
  }
}
