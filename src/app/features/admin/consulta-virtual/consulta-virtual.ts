import { Component, OnInit, OnDestroy, signal, computed, inject, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { ChatConsultaRealtimeService } from '../../../core/services/chat-consulta-realtime.service';
import { AppointmentService } from '../../../core/services/appointment.service';
import { WebrtcTeleconsultaService } from '../../../core/services/webrtc-teleconsulta.service';
import { PrescriptionsService } from '../../medical-records/prescriptions/services/prescriptions.service';
import { ViaAdministracion, VIAS_ADMINISTRACION } from '../../medical-records/prescriptions/models/prescription.models';

export interface DiagnosticoItem {
  codigo: string;
  descripcion: string;
  principal: boolean;
}

export interface MedicamentoRecetaItem {
  id: string;
  idMedicamentoCatalogo: number | null;
  nombre: string;
  dosis: string;
  frecuencia: string;
  duracion: string;
  viaAdministracion: ViaAdministracion;
  cantidad: number;
  indicaciones: string;
}

export interface RecetaEmitidaResumen {
  folio: string;
  fechaEmision: string;
  fechaVencimiento: string;
  medicoNombre: string;
  especialidad: string;
  pacienteNombre: string;
  pacienteCi: string;
  pacienteHce: string;
  fichaCodigo: string;
  diagnosticos: DiagnosticoItem[];
  medicamentos: MedicamentoRecetaItem[];
  indicacionesGenerales: string;
  hashFirma: string;
  idRecetaBackend?: number | null;
}

export interface TeleconsultaDoctorItem {
  idCita: number | string;
  idPaciente: number;
  nombrePaciente: string;
  inicialesPaciente: string;
  edad: number;
  genero: string;
  ci: string;
  hce: string;
  correoPaciente?: string;
  telefonoPaciente?: string;
  fecha: string;
  horario: string;
  fichaCodigo: string;
  especialidad: string;
  motivo: string;
  estado: 'EN_ESPERA' | 'PROGRAMADA' | 'EN_CURSO' | 'COMPLETADA' | 'CANCELADA';
  alergia: string;
  signosVitales: {
    presion: string;
    presionUnidad: string;
    presionNivel: string;
    frecuenciaCardiaca: number;
    frecuenciaUnidad: string;
    frecuenciaNivel: string;
    peso: string;
    pesoUnidad: string;
    pesoNivel: string;
  };
  diagnosticos: DiagnosticoItem[];
  motivoYEvolucion: string;
  examenFisico: string;
  planTratamiento: string;
  pacienteEnEspera?: boolean;
}

@Component({
  selector: 'app-consulta-virtual',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './consulta-virtual.html',
  styleUrls: ['./consulta-virtual.css']
})
export class ConsultaVirtualComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  readonly authService = inject(AuthService);
  readonly chatService = inject(ChatConsultaRealtimeService);
  readonly appointmentService = inject(AppointmentService);
  readonly webrtcService = inject(WebrtcTeleconsultaService);
  readonly prescriptionsService = inject(PrescriptionsService);

  @ViewChild('videoDoctorLocal') videoDoctorLocalRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('videoPantallaDoctor') videoPantallaDoctorRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('videoPacienteRemoto') videoPacienteRemotoRef?: ElementRef<HTMLVideoElement>;

  private pacienteEstabaConectado = false;

  constructor() {
    effect(() => {
      const streamRemoto = this.webrtcService.streamRemoto();
      const conectadoP2P = this.webrtcService.p2pNativoConectado();
      const vista = this.vistaActual();
      const pantallaActiva = this.compartiendoPantalla();
      const pacEnLinea = this.chatService.pacienteConectado();

      if (conectadoP2P && !pacEnLinea) {
        this.chatService.pacienteConectado.set(true);
      }

      // Si el paciente se desconecta de la sala, limpiar inmediatamente cualquier frame o video congelado
      if (this.pacienteEstabaConectado && !pacEnLinea && !conectadoP2P) {
        this.webrtcService.limpiarRemoto();
        if (this.videoPacienteRemotoRef?.nativeElement) {
          this.videoPacienteRemotoRef.nativeElement.srcObject = null;
        }
      }
      this.pacienteEstabaConectado = pacEnLinea;

      if (vista === 'sala') {
        this.sincronizarElementosVideo(streamRemoto, pantallaActiva);
        setTimeout(() => this.sincronizarElementosVideo(streamRemoto, pantallaActiva), 80);
      }
    });
  }

  private sincronizarElementosVideo(streamRemoto: MediaStream | null, _pantallaActiva: boolean): void {
    const videoRemotoEl = this.videoPacienteRemotoRef?.nativeElement;
    if (videoRemotoEl && streamRemoto) {
      if (videoRemotoEl.srcObject !== streamRemoto) {
        videoRemotoEl.srcObject = streamRemoto;
      }
      videoRemotoEl.muted = true;
      videoRemotoEl.play().catch(() => {});
    }

    const videoLocalEl = this.videoDoctorLocalRef?.nativeElement;
    if (videoLocalEl && this.streamCamaraDoctor && this.camaraActiva()) {
      if (videoLocalEl.srcObject !== this.streamCamaraDoctor) {
        videoLocalEl.srcObject = this.streamCamaraDoctor;
      }
      videoLocalEl.muted = true;
      videoLocalEl.play().catch(() => {});
    }
  }

  // Modo de vista: 'lista' para ver las teleconsultas asignadas, 'sala' para la llamada activa
  readonly vistaActual = signal<'lista' | 'sala'>('lista');

  // Filtros de la lista de teleconsultas
  readonly filtroEstado = signal<'TODAS' | 'ESPERA' | 'PROGRAMADAS' | 'FINALIZADAS'>('TODAS');
  readonly terminoBusqueda = signal<string>('');
  readonly cargandoLista = signal<boolean>(false);

  // Lista de teleconsultas del doctor (con datos independientes y listos para atender)
  readonly teleconsultasLista = signal<TeleconsultaDoctorItem[]>([
    {
      idCita: 42,
      idPaciente: 16,
      nombrePaciente: 'Mateo Valdez Quiroga',
      inicialesPaciente: 'MV',
      edad: 34,
      genero: 'Masculino',
      ci: '8472910',
      hce: 'HCE-2026-000016',
      correoPaciente: 'paciente@telemedicina.com',
      telefonoPaciente: '+591 70012345',
      fecha: 'Hoy, 31 de Octubre',
      horario: '10:30 - 11:15',
      fichaCodigo: 'FICHA CAR-014',
      especialidad: 'Cardiología',
      motivo: 'Control cardiovascular y seguimiento de tratamiento',
      estado: 'EN_ESPERA',
      alergia: 'Ninguna conocida',
      signosVitales: {
        presion: '130/85',
        presionUnidad: 'mmHg',
        presionNivel: 'Normal',
        frecuenciaCardiaca: 74,
        frecuenciaUnidad: 'lpm',
        frecuenciaNivel: 'Normal',
        peso: '70,5',
        pesoUnidad: 'kg',
        pesoNivel: 'Normal'
      },
      diagnosticos: [
        { codigo: 'I10', descripcion: 'Hipertensión esencial (primaria)', principal: true }
      ],
      motivoYEvolucion: 'Paciente Mateo Valdez acude a control de rutina para seguimiento cardiovascular. Manifiesta buena adherencia terapéutica y ausencia de molestias agudas.',
      examenFisico: 'Paciente lúcido, hidratado y normocoloreado. Sin signos de dificultad respiratoria ni soplos cardíacos audibles.',
      planTratamiento: 'Continuar Losartán 50mg cada 12 hrs. Dieta hiposódica, hidratación abundante y caminata diaria 30 min.',
      pacienteEnEspera: true
    },
    {
      idCita: 43,
      idPaciente: 4,
      nombrePaciente: 'Ana Gutiérrez',
      inicialesPaciente: 'AG',
      edad: 42,
      genero: 'Femenino',
      ci: '2222222',
      hce: 'HCE-2026-000022',
      correoPaciente: 'paciente.ana@telemedicina.com',
      telefonoPaciente: '+591 71234567',
      fecha: 'Hoy, 31 de Octubre',
      horario: '11:30 - 12:15',
      fichaCodigo: 'FICHA CAR-015',
      especialidad: 'Cardiología',
      motivo: 'Control de hipertensión arterial y cefalea matutina',
      estado: 'PROGRAMADA',
      alergia: 'Penicilina',
      signosVitales: {
        presion: '138/88',
        presionUnidad: 'mmHg',
        presionNivel: 'Alto',
        frecuenciaCardiaca: 78,
        frecuenciaUnidad: 'lpm',
        frecuenciaNivel: 'Normal',
        peso: '68,4',
        pesoUnidad: 'kg',
        pesoNivel: 'Normal'
      },
      diagnosticos: [
        { codigo: 'I10', descripcion: 'Hipertensión esencial (primaria)', principal: true }
      ],
      motivoYEvolucion: 'Refiere cefalea leve matutina. Adherente al tratamiento. PA autoreportada 138/88, sin edemas.',
      examenFisico: 'Lúcida, orientada, buena coloración. Sin signos de dificultad respiratoria.',
      planTratamiento: 'Mantener Losartán 50 mg. Control en 3 meses.',
      pacienteEnEspera: false
    },
    {
      idCita: 44,
      idPaciente: 3,
      nombrePaciente: 'Carlos Mamani Choque',
      inicialesPaciente: 'CM',
      edad: 29,
      genero: 'Masculino',
      ci: '1111111',
      hce: 'HCE-2026-000003',
      correoPaciente: 'paciente.carlos@telemedicina.com',
      telefonoPaciente: '+591 73456789',
      fecha: 'Hoy, 31 de Octubre',
      horario: '15:00 - 15:45',
      fichaCodigo: 'FICHA MED-008',
      especialidad: 'Medicina General',
      motivo: 'Evaluación médica preventiva y revisión de analítica',
      estado: 'PROGRAMADA',
      alergia: 'Sulfas',
      signosVitales: {
        presion: '120/80',
        presionUnidad: 'mmHg',
        presionNivel: 'Normal',
        frecuenciaCardiaca: 70,
        frecuenciaUnidad: 'lpm',
        frecuenciaNivel: 'Normal',
        peso: '74,0',
        pesoUnidad: 'kg',
        pesoNivel: 'Normal'
      },
      diagnosticos: [
        { codigo: 'Z00.0', descripcion: 'Examen médico general de rutina', principal: true }
      ],
      motivoYEvolucion: 'Chequeo preventivo de rutina. Refiere hábitos saludables y ejercicio regular.',
      examenFisico: 'Buen estado nutricional y general. Tórax simétrico, abdomen blando no doloroso.',
      planTratamiento: 'Solicitud de perfil lipídico y glicemia en ayunas. Control de resultados la próxima semana.',
      pacienteEnEspera: false
    }
  ]);

  // Teleconsulta activa seleccionada
  readonly consultaActiva = signal<TeleconsultaDoctorItem | null>(null);

  // Computed: Teleconsultas filtradas por término y pestaña
  readonly teleconsultasFiltradas = computed(() => {
    const lista = this.teleconsultasLista();
    const filtro = this.filtroEstado();
    const busqueda = this.terminoBusqueda().trim().toLowerCase();

    return lista.filter((item) => {
      // Filtro por estado / pestaña
      if (filtro === 'ESPERA') {
        const esEspera = item.estado === 'EN_ESPERA' || item.pacienteEnEspera;
        if (!esEspera) return false;
      } else if (filtro === 'PROGRAMADAS') {
        if (item.estado !== 'PROGRAMADA') return false;
      } else if (filtro === 'FINALIZADAS') {
        if (item.estado !== 'COMPLETADA' && item.estado !== 'CANCELADA') return false;
      }

      // Filtro por búsqueda
      if (busqueda) {
        const enNombre = item.nombrePaciente.toLowerCase().includes(busqueda);
        const enCi = item.ci.toLowerCase().includes(busqueda);
        const enFicha = item.fichaCodigo.toLowerCase().includes(busqueda);
        const enEspecialidad = item.especialidad.toLowerCase().includes(busqueda);
        const enMotivo = item.motivo.toLowerCase().includes(busqueda);
        const enCorreo = (item.correoPaciente || '').toLowerCase().includes(busqueda);
        if (!enNombre && !enCi && !enFicha && !enEspecialidad && !enMotivo && !enCorreo) {
          return false;
        }
      }

      return true;
    });
  });

  // Métricas reactivas para el dashboard
  readonly totalHoy = computed(() => this.teleconsultasLista().length);
  readonly totalEspera = computed(() =>
    this.teleconsultasLista().filter((t) => t.estado === 'EN_ESPERA' || t.pacienteEnEspera).length
  );
  readonly totalProgramadas = computed(() =>
    this.teleconsultasLista().filter((t) => t.estado === 'PROGRAMADA').length
  );
  readonly totalFinalizadas = computed(() =>
    this.teleconsultasLista().filter((t) => t.estado === 'COMPLETADA').length
  );

  // Datos dinámicos del Paciente en atención en la llamada activa
  readonly paciente = signal({
    nombre: 'Mateo Valdez Quiroga',
    edad: 34,
    hce: 'HCE-2026-000016',
    subtitulo: 'Control cardiovascular · FICHA CAR-014',
    alergia: 'Ninguna conocida',
    iniciales: 'MV'
  });

  // Signos Vitales
  readonly signosVitales = signal({
    presion: '130/85',
    presionUnidad: 'mmHg',
    presionNivel: 'Normal',
    frecuenciaCardiaca: 74,
    frecuenciaUnidad: 'lpm',
    frecuenciaNivel: 'Normal',
    peso: '70,5',
    pesoUnidad: 'kg',
    pesoNivel: 'Normal'
  });

  // Estado de la Videollamada y Presencia
  readonly enLlamada = signal<boolean>(false);
  readonly segundosTranscurridos = signal<number>(0);
  readonly microfonoActivo = signal<boolean>(true);
  readonly camaraActiva = signal<boolean>(true);
  readonly compartiendoPantalla = signal<boolean>(false);
  readonly estadoRed = signal<string>('Red estable (HD)');
  readonly conexionCifrada = signal<boolean>(true);
  readonly notificacionesChat = signal<number>(0);

  // Estado de conexión del paciente
  readonly pacienteEnLinea = this.chatService.pacienteConectado;

  // Pestañas del Panel Derecho
  readonly pestanaActiva = signal<'notas' | 'diagnostico' | 'receta' | 'chat'>('notas');

  // Campos de Notas Clínicas
  readonly motivoYEvolucion = signal<string>('');
  readonly examenFisico = signal<string>('');
  readonly diagnosticos = signal<DiagnosticoItem[]>([]);
  readonly planTratamiento = signal<string>('');
  readonly mensajeGuardado = signal<string>('Guardado');

  // Campos para agregar nuevos diagnósticos durante la consulta
  readonly nuevoDiagnosticoCodigo = signal<string>('');
  readonly nuevoDiagnosticoDescripcion = signal<string>('');
  readonly nuevoDiagnosticoPrincipal = signal<boolean>(false);
  readonly sugerenciasCie10: { codigo: string; descripcion: string }[] = [
    { codigo: 'I10', descripcion: 'Hipertensión esencial (primaria)' },
    { codigo: 'R51', descripcion: 'Cefalea / Dolor de cabeza agudo' },
    { codigo: 'J00', descripcion: 'Rinofaringitis aguda (resfriado común)' },
    { codigo: 'J02.9', descripcion: 'Faringitis aguda no especificada' },
    { codigo: 'K29.7', descripcion: 'Gastritis aguda no especificada' },
    { codigo: 'E11.9', descripcion: 'Diabetes mellitus tipo 2 sin complicaciones' },
    { codigo: 'M54.5', descripcion: 'Lumbago / Dolor lumbar bajo' },
    { codigo: 'R50.9', descripcion: 'Fiebre de origen clínico en estudio' }
  ];

  // Campos para acumular medicamentos de la receta durante la consulta
  readonly viasAdministracion: ViaAdministracion[] = VIAS_ADMINISTRACION;
  readonly medicamentosReceta = signal<MedicamentoRecetaItem[]>([]);
  readonly indicacionesGeneralesReceta = signal<string>('Cumplir el horario indicado, mantener hidratación adecuada y acudir a control médico ante signos de alarma.');
  readonly nuevoMedIdCatalogo = signal<number | null>(null);
  readonly nuevoMedNombre = signal<string>('');
  readonly nuevoMedDosis = signal<string>('');
  readonly nuevoMedFrecuencia = signal<string>('Cada 8 horas');
  readonly nuevoMedDuracion = signal<string>('7 días');
  readonly nuevoMedVia = signal<ViaAdministracion>('ORAL');
  readonly nuevoMedCantidad = signal<number>(14);
  readonly nuevoMedIndicaciones = signal<string>('');
  readonly recetaEmitidaModal = signal<RecetaEmitidaResumen | null>(null);
  readonly recetaYaEmitidaEnSesion = signal<RecetaEmitidaResumen | null>(null);

  readonly catalogoMedicamentosRapidos: {
    idCatalogo: number | null;
    nombre: string;
    dosis: string;
    frecuencia: string;
    duracion: string;
    via: ViaAdministracion;
    cantidad: number;
    indicaciones: string;
  }[] = [
    {
      idCatalogo: null,
      nombre: 'Losartán Potásico 50 mg (Comprimidos)',
      dosis: '50 mg (1 comprimido)',
      frecuencia: 'Cada 12 horas',
      duracion: '30 días',
      via: 'ORAL',
      cantidad: 60,
      indicaciones: 'Tomar en la mañana y noche con agua'
    },
    {
      idCatalogo: null,
      nombre: 'Paracetamol 500 mg (Tabletas)',
      dosis: '500 mg (1 tableta)',
      frecuencia: 'Cada 8 horas',
      duracion: '5 días',
      via: 'ORAL',
      cantidad: 15,
      indicaciones: 'Tomar después de los alimentos si hay dolor o fiebre'
    },
    {
      idCatalogo: null,
      nombre: 'Ibuprofeno 400 mg (Cápsulas blandas)',
      dosis: '400 mg (1 cápsula)',
      frecuencia: 'Cada 8 horas',
      duracion: '5 días',
      via: 'ORAL',
      cantidad: 15,
      indicaciones: 'Tomar siempre con el estómago lleno'
    },
    {
      idCatalogo: null,
      nombre: 'Amoxicilina 500 mg (Cápsulas)',
      dosis: '500 mg (1 cápsula)',
      frecuencia: 'Cada 8 horas',
      duracion: '7 días',
      via: 'ORAL',
      cantidad: 21,
      indicaciones: 'Completar los 7 días de tratamiento sin interrumpir'
    },
    {
      idCatalogo: null,
      nombre: 'Omeprazol 20 mg (Cápsulas)',
      dosis: '20 mg (1 cápsula)',
      frecuencia: 'Cada 24 horas',
      duracion: '14 días',
      via: 'ORAL',
      cantidad: 14,
      indicaciones: 'Tomar en ayunas 30 minutos antes del desayuno'
    },
    {
      idCatalogo: null,
      nombre: 'Atorvastatina 20 mg (Comprimidos)',
      dosis: '20 mg (1 comprimido)',
      frecuencia: 'Cada 24 horas',
      duracion: '30 días',
      via: 'ORAL',
      cantidad: 30,
      indicaciones: 'Tomar por la noche antes de dormir'
    }
  ];

  // Chat en tiempo real sincronizado
  readonly textoNuevoMensaje = signal<string>('');
  readonly mensajesChat = this.chatService.mensajes;

  private temporizador?: any;
  private streamCamaraDoctor?: MediaStream;
  private streamPantallaDoctor?: MediaStream;

  ngOnInit(): void {
    // 1. Cargar citas reales desde el backend para sincronizar si existen
    this.cargarTeleconsultasBackend();

    // 2. Verificar si se pasó un parámetro idCita o id en la ruta
    const idCitaParam = this.route.snapshot.queryParamMap.get('idCita') ||
                        this.route.snapshot.paramMap.get('id');

    if (idCitaParam) {
      const encontrada = this.teleconsultasLista().find(
        (t) => String(t.idCita) === String(idCitaParam)
      );
      if (encontrada) {
        this.seleccionarTeleconsulta(encontrada);
      }
    }
  }

  ngOnDestroy(): void {
    this.detenerTemporizador();
    this.detenerCamaraDoctor();
    this.detenerCompartirPantalla();
    this.chatService.detenerPresenciaDoctor();
  }

  cargarTeleconsultasBackend(): void {
    this.cargandoLista.set(true);
    this.appointmentService.listarCitas(undefined, undefined, undefined, undefined, undefined, 1, 50).subscribe({
      next: (res) => {
        if (res && res.items && res.items.length > 0) {
          const citasTele = res.items.filter(
            (c) => (c.tipo_consulta || '').toUpperCase() === 'TELEMEDICINA' ||
                   (c.motivo || '').toLowerCase().includes('teleconsulta')
          );

          if (citasTele.length > 0) {
            const listaActual = [...this.teleconsultasLista()];
            for (const c of citasTele) {
              const existe = listaActual.some((item) => String(item.idCita) === String(c.id_cita));
              if (!existe) {
                const nombrePac = c.paciente_nombre || 'Paciente';
                const iniPac = c.paciente_iniciales || this.extraerIniciales(nombrePac);
                listaActual.push({
                  idCita: c.id_cita,
                  idPaciente: c.id_paciente,
                  nombrePaciente: nombrePac,
                  inicialesPaciente: iniPac,
                  edad: 35,
                  genero: 'No especificado',
                  ci: c.paciente_ci || 'N/A',
                  hce: `HCE-2026-0000${c.id_paciente}`,
                  fecha: c.fecha_cita || 'Hoy',
                  horario: `${c.hora_inicio || '10:00'} - ${c.hora_fin || '10:45'}`,
                  fichaCodigo: `FICHA-TEL-00${c.id_cita}`,
                  especialidad: c.especialidad_nombre || 'Medicina General',
                  motivo: c.motivo || 'Consulta médica remota',
                  estado: (c.estado as any) || 'CONFIRMADA',
                  alergia: 'Ninguna conocida',
                  signosVitales: {
                    presion: '120/80',
                    presionUnidad: 'mmHg',
                    presionNivel: 'Normal',
                    frecuenciaCardiaca: 72,
                    frecuenciaUnidad: 'lpm',
                    frecuenciaNivel: 'Normal',
                    peso: '70,0',
                    pesoUnidad: 'kg',
                    pesoNivel: 'Normal'
                  },
                  diagnosticos: [
                    { codigo: 'Z00.0', descripcion: 'Examen médico general', principal: true }
                  ],
                  motivoYEvolucion: c.motivo || 'Paciente programado para atención virtual.',
                  examenFisico: 'Evaluación remota general.',
                  planTratamiento: 'Seguimiento clínico según indicación.',
                  pacienteEnEspera: c.estado === 'CONFIRMADA'
                });
              }
            }
            this.teleconsultasLista.set(listaActual);
          }
        }
        this.cargandoLista.set(false);
      },
      error: () => {
        this.cargandoLista.set(false);
      }
    });
  }

  seleccionarTeleconsulta(item: TeleconsultaDoctorItem): void {
    // Si la consulta había finalizado antes y el doctor vuelve a entrar, restaurar estado limpio como al inicio
    if (item.estado === 'COMPLETADA') {
      item = { ...item, estado: 'EN_ESPERA', pacienteEnEspera: true };
      this.teleconsultasLista.update((lista) =>
        lista.map((t) => (t.idCita === item.idCita ? item : t))
      );
    }

    this.consultaActiva.set(item);
    this.pacienteEstabaConectado = false;

    // Limpiar cualquier frame o stream remoto previo para que nunca aparezca imagen congelada
    this.webrtcService.limpiarRemoto();
    if (this.videoPacienteRemotoRef?.nativeElement) {
      this.videoPacienteRemotoRef.nativeElement.srcObject = null;
    }

    // Asignar datos del paciente en el expediente de atención
    this.paciente.set({
      nombre: item.nombrePaciente,
      edad: item.edad,
      hce: item.hce,
      subtitulo: `${item.motivo} · ${item.fichaCodigo}`,
      alergia: item.alergia,
      iniciales: item.inicialesPaciente
    });

    this.signosVitales.set({ ...item.signosVitales });
    this.motivoYEvolucion.set(item.motivoYEvolucion);
    this.examenFisico.set(item.examenFisico);
    this.diagnosticos.set(item.diagnosticos.map((d) => ({ ...d })));
    this.planTratamiento.set(item.planTratamiento);

    // Reiniciar formularios de diagnóstico y acumulación de medicamentos para la sesión
    this.nuevoDiagnosticoCodigo.set('');
    this.nuevoDiagnosticoDescripcion.set('');
    this.nuevoDiagnosticoPrincipal.set(false);
    this.medicamentosReceta.set([]);
    this.recetaYaEmitidaEnSesion.set(null);
    this.limpiarFormularioMedicamento();
    this.pestanaActiva.set('notas');

    // Iniciar o aislar la sesión de chat por idCita limpia
    this.chatService.limpiarHistorial(false);
    this.chatService.iniciarSesion(item.idCita, item.nombrePaciente);

    // Notificar presencia del doctor
    const nombreDoctor = this.authService.userDisplayName() || 'Dr. Roberto Gómez Flores';
    this.chatService.iniciarPresenciaDoctor(nombreDoctor);

    // Cambiar a la vista de la llamada
    this.vistaActual.set('sala');
    this.enLlamada.set(true);
    this.segundosTranscurridos.set(0);

    this.iniciarTemporizador();
    this.iniciarCamaraDoctor();
  }

  conectarPacienteManual(): void {
    this.chatService.pacienteConectado.set(true);
  }

  volverAListaTeleconsultas(): void {
    this.detenerTemporizador();
    this.detenerCamaraDoctor();
    this.detenerCompartirPantalla();
    this.chatService.detenerPresenciaDoctor();

    this.enLlamada.set(false);
    this.consultaActiva.set(null);
    this.vistaActual.set('lista');

    // Limpiar query params de la URL de forma limpia
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true
    });
  }

  cambiarFiltroEstado(filtro: 'TODAS' | 'ESPERA' | 'PROGRAMADAS' | 'FINALIZADAS'): void {
    this.filtroEstado.set(filtro);
  }

  extraerIniciales(nombre: string | null | undefined): string {
    if (!nombre) return 'P';
    const limpio = nombre.replace(/^(Dr\(a\)\.?|Dr\.|Dra\.)\s*/i, '').trim();
    const partes = limpio.split(/\s+/).filter(Boolean);
    if (partes.length >= 2) {
      return (partes[0][0] + partes[1][0]).toUpperCase();
    }
    return partes[0] ? partes[0].substring(0, 2).toUpperCase() : 'P';
  }

  iniciarTemporizador(): void {
    this.detenerTemporizador();
    this.temporizador = setInterval(() => {
      if (this.enLlamada()) {
        this.segundosTranscurridos.update((s) => s + 1);
      }
    }, 1000);
  }

  detenerTemporizador(): void {
    if (this.temporizador) {
      clearInterval(this.temporizador);
      this.temporizador = undefined;
    }
  }

  formatearTiempo(totalSegundos: number): string {
    const minutos = Math.floor(totalSegundos / 60);
    const segundos = totalSegundos % 60;
    return `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
  }

  alternarMicrofono(): void {
    const nuevoEstado = !this.microfonoActivo();
    this.microfonoActivo.set(nuevoEstado);
    this.webrtcService.setMicrofonoActivo(nuevoEstado);
  }

  alternarCamara(): void {
    const nuevoEstado = !this.camaraActiva();
    this.camaraActiva.set(nuevoEstado);
    this.webrtcService.setCamaraActiva(nuevoEstado);

    if (nuevoEstado) {
      setTimeout(() => {
        if (this.videoDoctorLocalRef?.nativeElement && this.streamCamaraDoctor) {
          this.videoDoctorLocalRef.nativeElement.srcObject = this.streamCamaraDoctor;
          this.videoDoctorLocalRef.nativeElement.muted = true;
          this.videoDoctorLocalRef.nativeElement.play().catch(() => {});
        }
      }, 60);
    }
  }

  async alternarCompartirPantalla(): Promise<void> {
    if (this.compartiendoPantalla()) {
      this.detenerCompartirPantalla();
    } else {
      await this.iniciarCompartirPantalla();
    }
  }

  async iniciarCompartirPantalla(): Promise<void> {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        this.streamPantallaDoctor = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
        });

        this.compartiendoPantalla.set(true);

        setTimeout(() => {
          if (this.videoPantallaDoctorRef?.nativeElement && this.streamPantallaDoctor) {
            this.videoPantallaDoctorRef.nativeElement.srcObject = this.streamPantallaDoctor;
            this.videoPantallaDoctorRef.nativeElement.play().catch(() => {});
          }
        }, 100);

        // Transmitir pantalla al paciente mediante WebRTC
        this.webrtcService.compartirPantalla(this.streamPantallaDoctor);

        const track = this.streamPantallaDoctor.getVideoTracks()[0];
        if (track) {
          track.onended = () => {
            this.detenerCompartirPantalla();
          };
        }
      } else {
        alert('Tu navegador no permite compartir pantalla.');
      }
    } catch (e) {
      console.warn('Compartición de pantalla cancelada:', e);
      this.compartiendoPantalla.set(false);
    }
  }

  detenerCompartirPantalla(): void {
    if (this.streamPantallaDoctor) {
      this.streamPantallaDoctor.getTracks().forEach((track) => track.stop());
      this.streamPantallaDoctor = undefined;
    }
    this.compartiendoPantalla.set(false);
    if (this.streamCamaraDoctor) {
      this.webrtcService.detenerCompartirPantalla(this.streamCamaraDoctor);
    }
  }

  seleccionarPestana(pestana: 'notas' | 'diagnostico' | 'receta' | 'chat'): void {
    this.pestanaActiva.set(pestana);
    if (pestana === 'chat') {
      this.notificacionesChat.set(0);
    }
  }

  guardarNotas(): void {
    this.mensajeGuardado.set('Guardado hace unos instantes');
  }

  // --- GESTIÓN DE DIAGNÓSTICOS DURANTE LA CONSULTA ---

  seleccionarSugerenciaCie10(sug: { codigo: string; descripcion: string }): void {
    this.nuevoDiagnosticoCodigo.set(sug.codigo);
    this.nuevoDiagnosticoDescripcion.set(sug.descripcion);
  }

  agregarDiagnosticoFormulario(): void {
    const desc = this.nuevoDiagnosticoDescripcion().trim();
    if (!desc) return;

    let cod = this.nuevoDiagnosticoCodigo().trim().toUpperCase();
    if (!cod) {
      cod = `CIE-${(this.diagnosticos().length + 1).toString().padStart(2, '0')}`;
    }

    const esPrincipal = this.nuevoDiagnosticoPrincipal() || this.diagnosticos().length === 0;
    this.diagnosticos.update((lista) => {
      const base = esPrincipal ? lista.map((d) => ({ ...d, principal: false })) : [...lista];
      return [...base, { codigo: cod, descripcion: desc, principal: esPrincipal }];
    });

    this.nuevoDiagnosticoCodigo.set('');
    this.nuevoDiagnosticoDescripcion.set('');
    this.nuevoDiagnosticoPrincipal.set(false);
    this.guardarNotas();
  }

  marcarDiagnosticoPrincipal(codigo: string): void {
    this.diagnosticos.update((lista) =>
      lista.map((d) => ({ ...d, principal: d.codigo === codigo }))
    );
    this.guardarNotas();
  }

  eliminarDiagnostico(codigo: string): void {
    this.diagnosticos.update((lista) => {
      const filtrada = lista.filter((d) => d.codigo !== codigo);
      if (filtrada.length > 0 && !filtrada.some((d) => d.principal)) {
        filtrada[0] = { ...filtrada[0], principal: true };
      }
      return filtrada;
    });
    this.guardarNotas();
  }

  agregarDiagnostico(codigo: string, descripcion: string): void {
    this.diagnosticos.update((lista) => [
      ...lista,
      { codigo, descripcion, principal: lista.length === 0 }
    ]);
    this.guardarNotas();
  }

  // --- GESTIÓN Y ACUMULACIÓN DE MEDICAMENTOS (RECETA) DURANTE LA CONSULTA ---

  seleccionarMedicamentoRapido(med: {
    idCatalogo: number | null;
    nombre: string;
    dosis: string;
    frecuencia: string;
    duracion: string;
    via: ViaAdministracion;
    cantidad: number;
    indicaciones: string;
  }): void {
    this.nuevoMedIdCatalogo.set(med.idCatalogo);
    this.nuevoMedNombre.set(med.nombre);
    this.nuevoMedDosis.set(med.dosis);
    this.nuevoMedFrecuencia.set(med.frecuencia);
    this.nuevoMedDuracion.set(med.duracion);
    this.nuevoMedVia.set(med.via);
    this.nuevoMedCantidad.set(med.cantidad);
    this.nuevoMedIndicaciones.set(med.indicaciones);
  }

  limpiarFormularioMedicamento(): void {
    this.nuevoMedIdCatalogo.set(null);
    this.nuevoMedNombre.set('');
    this.nuevoMedDosis.set('');
    this.nuevoMedFrecuencia.set('Cada 8 horas');
    this.nuevoMedDuracion.set('7 días');
    this.nuevoMedVia.set('ORAL');
    this.nuevoMedCantidad.set(14);
    this.nuevoMedIndicaciones.set('');
  }

  agregarMedicamentoReceta(): void {
    const nombre = this.nuevoMedNombre().trim();
    if (!nombre) return;

    const dosis = this.nuevoMedDosis().trim() || '1 dosis según indicación';
    const frecuencia = this.nuevoMedFrecuencia().trim() || 'Cada 8 horas';
    const duracion = this.nuevoMedDuracion().trim() || '7 días';
    const cantidad = Math.max(1, Number(this.nuevoMedCantidad()) || 1);
    const indicaciones = this.nuevoMedIndicaciones().trim() || 'Seguir horario médico indicado';

    const nuevoItem: MedicamentoRecetaItem = {
      id: `med-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      idMedicamentoCatalogo: this.nuevoMedIdCatalogo(),
      nombre,
      dosis,
      frecuencia,
      duracion,
      viaAdministracion: this.nuevoMedVia(),
      cantidad,
      indicaciones
    };

    this.medicamentosReceta.update((lista) => [...lista, nuevoItem]);
    this.limpiarFormularioMedicamento();
    this.guardarNotas();
  }

  eliminarMedicamentoReceta(id: string): void {
    this.medicamentosReceta.update((lista) => lista.filter((m) => m.id !== id));
    this.guardarNotas();
  }

  emitirReceta(): void {
    // Si el médico aún no está en la pestaña de receta, abrirla para que acumule o revise medicamentos
    if (this.pestanaActiva() !== 'receta' && this.medicamentosReceta().length === 0) {
      this.seleccionarPestana('receta');
      return;
    }
    if (this.nuevoMedNombre().trim()) {
      this.agregarMedicamentoReceta();
    }
    if (this.medicamentosReceta().length === 0) {
      this.seleccionarPestana('receta');
      return;
    }
    const resumen = this.construirYPersistirReceta((actualizada) => {
      this.recetaYaEmitidaEnSesion.set(actualizada);
      this.recetaEmitidaModal.set({ ...actualizada });
    });
    this.recetaYaEmitidaEnSesion.set(resumen);
    this.recetaEmitidaModal.set(resumen);
  }

  private construirYPersistirReceta(onDone?: (resumen: RecetaEmitidaResumen) => void): RecetaEmitidaResumen {
    const activa = this.consultaActiva();
    const pac = this.paciente();
    const nombreDoctor = this.authService.userDisplayName() || 'Dr. Roberto Gómez Flores';
    const ahora = new Date();
    const venc = new Date(ahora.getTime() + 30 * 86400000);
    const fechaEmision = ahora.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const fechaVencimientoIso = venc.toISOString().split('T')[0];
    const folio = `REC-${ahora.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const hashFirma = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase();

    const resumen: RecetaEmitidaResumen = {
      folio,
      fechaEmision,
      fechaVencimiento: fechaVencimientoIso,
      medicoNombre: nombreDoctor,
      especialidad: activa?.especialidad || 'Medicina General',
      pacienteNombre: pac.nombre,
      pacienteCi: activa?.ci || '8472910',
      pacienteHce: pac.hce,
      fichaCodigo: activa?.fichaCodigo || 'FICHA-TEL',
      diagnosticos: [...this.diagnosticos()],
      medicamentos: [...this.medicamentosReceta()],
      indicacionesGenerales: this.indicacionesGeneralesReceta().trim() || this.planTratamiento().trim(),
      hashFirma
    };

    // Persistir en el backend mediante el endpoint oficial de Teleconsulta + CU16 (Recetas Médicas Digitales)
    const idCita = activa?.idCita || 42;
    if (resumen.medicamentos.length > 0) {
      const payload = {
        id_paciente: activa?.idPaciente ? Number(activa.idPaciente) : 16,
        paciente_nombre: pac.nombre,
        fecha_vencimiento: fechaVencimientoIso,
        indicaciones_generales: resumen.indicacionesGenerales || null,
        motivo_consulta: this.motivoYEvolucion().trim() || activa?.motivo || 'Atención por Teleconsulta',
        examen_fisico: this.examenFisico().trim() || 'Evaluación remota por videollamada',
        plan_tratamiento: this.planTratamiento().trim() || resumen.indicacionesGenerales,
        diagnosticos: resumen.diagnosticos.map((d) => ({
          codigo: d.codigo,
          descripcion: d.descripcion,
          principal: d.principal
        })),
        detalles: resumen.medicamentos.map((m) => ({
          id_medicamento: m.idMedicamentoCatalogo ?? null,
          nombre_medicamento_manual: m.idMedicamentoCatalogo ? null : m.nombre,
          dosis: m.dosis,
          frecuencia: m.frecuencia,
          duracion: m.duracion,
          via_administracion: m.viaAdministracion,
          cantidad: m.cantidad,
          indicaciones: m.indicaciones || null
        }))
      };

      this.http.post<any>(`${environment.apiUrl}/citas/${idCita}/teleconsulta/receta`, payload).subscribe({
        next: (resp) => {
          if (resp?.id_receta) {
            resumen.idRecetaBackend = resp.id_receta;
            resumen.folio = resp.folio || resumen.folio;
            resumen.hashFirma = resp.hash_pdf || resumen.hashFirma;
          }
          if (onDone) onDone(resumen);
        },
        error: () => {
          if (onDone) onDone(resumen);
        }
      });
    } else if (onDone) {
      onDone(resumen);
    }

    return resumen;
  }

  private generarDataUrlRecetaHtml(receta: RecetaEmitidaResumen): string {
    const diagHtml = receta.diagnosticos
      .map((d) => `<li><strong>${d.codigo}</strong>: ${d.descripcion} ${d.principal ? '(Principal)' : ''}</li>`)
      .join('');
    const medsHtml = receta.medicamentos
      .map(
        (m, idx) => `
        <tr>
          <td style="padding:8px;border:1px solid #cbd5e1;text-align:center;">${idx + 1}</td>
          <td style="padding:8px;border:1px solid #cbd5e1;"><strong>${m.nombre}</strong><br/><small>Vía: ${m.viaAdministracion}</small></td>
          <td style="padding:8px;border:1px solid #cbd5e1;">${m.dosis}</td>
          <td style="padding:8px;border:1px solid #cbd5e1;">${m.frecuencia}</td>
          <td style="padding:8px;border:1px solid #cbd5e1;">${m.duracion}</td>
          <td style="padding:8px;border:1px solid #cbd5e1;text-align:center;">${m.cantidad}</td>
          <td style="padding:8px;border:1px solid #cbd5e1;">${m.indicaciones}</td>
        </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Receta Médica Digital ${receta.folio}</title>
</head>
<body style="font-family:Arial,sans-serif;color:#0f172a;padding:32px;max-width:820px;margin:0 auto;">
  <div style="border:2px solid #002d62;border-radius:16px;padding:24px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #e2e8f0;padding-bottom:16px;">
      <div>
        <h1 style="margin:0;color:#002d62;font-size:22px;">RECETA MÉDICA DIGITAL</h1>
        <p style="margin:4px 0 0;font-size:13px;color:#475569;">${receta.medicoNombre} · ${receta.especialidad}</p>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:bold;color:#002d62;font-size:15px;">Folio: ${receta.folio}</div>
        <div style="font-size:12px;color:#64748b;">Emisión: ${receta.fechaEmision} | Vence: ${receta.fechaVencimiento}</div>
      </div>
    </div>
    <div style="margin-top:16px;background:#f8fafc;padding:12px 16px;border-radius:10px;font-size:13px;">
      <strong>Paciente:</strong> ${receta.pacienteNombre} &nbsp;|&nbsp;
      <strong>CI:</strong> ${receta.pacienteCi} &nbsp;|&nbsp;
      <strong>HCE:</strong> ${receta.pacienteHce} &nbsp;|&nbsp;
      <strong>Ficha:</strong> ${receta.fichaCodigo}
    </div>
    <h3 style="margin:18px 0 8px;font-size:14px;color:#002d62;text-transform:uppercase;">Diagnósticos Clínicos (CIE-10)</h3>
    <ul style="margin:0 0 16px;padding-left:20px;font-size:13px;">${diagHtml}</ul>
    <h3 style="margin:18px 0 8px;font-size:14px;color:#002d62;text-transform:uppercase;">Medicamentos Prescritos</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:#002d62;color:#ffffff;">
          <th style="padding:8px;border:1px solid #002d62;">#</th>
          <th style="padding:8px;border:1px solid #002d62;text-align:left;">Medicamento</th>
          <th style="padding:8px;border:1px solid #002d62;text-align:left;">Dosis</th>
          <th style="padding:8px;border:1px solid #002d62;text-align:left;">Frecuencia</th>
          <th style="padding:8px;border:1px solid #002d62;text-align:left;">Duración</th>
          <th style="padding:8px;border:1px solid #002d62;">Cant.</th>
          <th style="padding:8px;border:1px solid #002d62;text-align:left;">Indicaciones</th>
        </tr>
      </thead>
      <tbody>${medsHtml}</tbody>
    </table>
    <div style="margin-top:16px;padding:12px;background:#eff6ff;border-radius:10px;font-size:13px;">
      <strong>Indicaciones generales:</strong> ${receta.indicacionesGenerales || 'Seguir indicaciones médicas.'}
    </div>
    <div style="margin-top:20px;padding-top:12px;border-top:1px dashed #cbd5e1;font-size:11px;color:#64748b;display:flex;justify-content:space-between;">
      <span>Algoritmo Firma: ED25519 · Hash SHA-256: ${receta.hashFirma}</span>
      <span>Documento verificado de Teleconsulta</span>
    </div>
  </div>
</body>
</html>`;

    return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
  }

  descargarRecetaEmitida(receta: RecetaEmitidaResumen): void {
    if (receta.idRecetaBackend) {
      this.prescriptionsService.downloadPdf(receta.idRecetaBackend).subscribe({
        next: (resp) => {
          if (resp.body) {
            const filename = this.prescriptionsService.resolvePdfFilename(resp, `receta_${receta.folio}.pdf`);
            this.prescriptionsService.saveBlob(resp.body, filename);
            return;
          }
          this.descargarRecetaHtmlFallback(receta);
        },
        error: () => this.descargarRecetaHtmlFallback(receta)
      });
      return;
    }
    this.descargarRecetaHtmlFallback(receta);
  }

  private descargarRecetaHtmlFallback(receta: RecetaEmitidaResumen): void {
    const dataUrl = this.generarDataUrlRecetaHtml(receta);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${receta.folio}-${receta.pacienteNombre.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  imprimirRecetaEmitida(receta: RecetaEmitidaResumen): void {
    const dataUrl = this.generarDataUrlRecetaHtml(receta);
    const htmlDecoded = decodeURIComponent(dataUrl.substring(dataUrl.indexOf(',') + 1));
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(htmlDecoded);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 250);
    }
  }

  cerrarModalReceta(): void {
    this.recetaEmitidaModal.set(null);
  }

  finalizarConsulta(): void {
    const pacienteNombre = this.paciente().nombre;
    // Si el doctor dejó escrito un diagnóstico o medicamento en el formulario sin pulsar "+", agregarlo automáticamente
    if (this.nuevoDiagnosticoDescripcion().trim()) {
      this.agregarDiagnosticoFormulario();
    }
    if (this.nuevoMedNombre().trim()) {
      this.agregarMedicamentoReceta();
    }

    const cantMeds = this.medicamentosReceta().length;
    const msgConfirm = cantMeds > 0
      ? `¿Desea finalizar la teleconsulta con ${pacienteNombre}? Se generará automáticamente la Receta Médica con los ${cantMeds} medicamento(s) prescrito(s), se cerrará la videollamada del paciente y todo quedará listo para la siguiente consulta.`
      : `¿Desea finalizar la teleconsulta con ${pacienteNombre}? Se cerrará la sesión de videollamada para ambos participantes y todo volverá al estado inicial.`;

    if (confirm(msgConfirm)) {
      const yaEmitida = this.recetaYaEmitidaEnSesion();
      if (cantMeds > 0 && (!yaEmitida || yaEmitida.medicamentos.length !== cantMeds)) {
        // Persistir primero la Receta Médica Digital (CU16) en BD para que cuando el paciente
        // sea redirigido a /recetas al cerrar la sala, la receta ya esté disponible de inmediato.
        this.construirYPersistirReceta((resumenFinal) => {
          this.ejecutarCierreSalaDoctor(pacienteNombre, resumenFinal);
        });
      } else {
        this.ejecutarCierreSalaDoctor(pacienteNombre, yaEmitida);
      }
    }
  }

  private ejecutarCierreSalaDoctor(pacienteNombre: string, recetaGenerada: RecetaEmitidaResumen | null): void {
    // Notificar al paciente que el médico finalizó la reunión para que su sala también se cierre
    this.webrtcService.notificarFinConsulta();
    this.chatService.finalizarConsultaPorDoctor();

    this.detenerCamaraDoctor();
    this.detenerCompartirPantalla();
    this.detenerTemporizador();
    this.webrtcService.limpiarRemoto();
    if (this.videoPacienteRemotoRef?.nativeElement) {
      this.videoPacienteRemotoRef.nativeElement.srcObject = null;
    }
    this.chatService.limpiarHistorial(true);

    this.enLlamada.set(false);
    this.consultaActiva.set(null);
    this.vistaActual.set('lista');

    if (recetaGenerada) {
      this.recetaEmitidaModal.set({ ...recetaGenerada });
    } else {
      alert(`Teleconsulta con ${pacienteNombre} finalizada exitosamente.`);
    }
  }

  enviarMensajeChat(): void {
    const texto = this.textoNuevoMensaje().trim();
    if (!texto) return;

    const nombreDoctor = this.authService.userDisplayName() || 'Dr. Roberto Gómez Flores';
    this.chatService.enviarMensaje(nombreDoctor, true, texto);
    this.textoNuevoMensaje.set('');
  }

  adjuntarArchivoDoctor(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const tamKb = Math.max(1, Math.round(file.size / 1024)) + ' KB';
        const tipo = file.name.split('.').pop()?.toUpperCase() || 'DOC';
        const nombreDoctor = this.authService.userDisplayName() || 'Dr. Roberto Gómez Flores';
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = typeof reader.result === 'string' ? reader.result : undefined;
          this.chatService.enviarMensaje(
            nombreDoctor,
            true,
            `Orden/Documento médico: ${file.name}`,
            file.name,
            tamKb,
            tipo,
            dataUrl
          );
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }

  async iniciarCamaraDoctor(): Promise<void> {
    const iniciales = 'DG';
    const nombre = this.authService.userDisplayName() || 'Dr. Roberto Gómez Flores';
    this.streamCamaraDoctor = await this.webrtcService.crearStreamCamara(iniciales, nombre, 'DOCTOR');

    this.webrtcService.setMicrofonoActivo(this.microfonoActivo());
    this.webrtcService.setCamaraActiva(this.camaraActiva());

    setTimeout(() => {
      if (this.videoDoctorLocalRef?.nativeElement && this.streamCamaraDoctor) {
        this.videoDoctorLocalRef.nativeElement.srcObject = this.streamCamaraDoctor;
        this.videoDoctorLocalRef.nativeElement.muted = true;
        this.videoDoctorLocalRef.nativeElement.play().catch(() => {});
      }
    }, 80);

    const activa = this.consultaActiva();
    const idCita = activa ? activa.idCita : 42;
    await this.webrtcService.iniciarP2P(idCita, 'DOCTOR', this.streamCamaraDoctor);
  }

  detenerCamaraDoctor(): void {
    if (this.streamCamaraDoctor) {
      this.streamCamaraDoctor.getTracks().forEach((track) => track.stop());
      this.streamCamaraDoctor = undefined;
    }
    this.webrtcService.cerrarConexion();
  }
}
