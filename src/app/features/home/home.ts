import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Header } from '../../shared/components/header/header';
import { Footer } from '../../shared/components/footer/footer';

interface Step {
  icon: string;
  title: string;
  description: string;
}

interface Feature {
  icon: string;
  title: string;
  description: string;
}

interface SecurityItem {
  icon: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-home',
  imports: [CommonModule, MatIconModule, Header, Footer],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home {
  readonly steps: Step[] = [
    {
      icon: 'smart_toy',
      title: '1. Triaje Inteligente',
      description: 'Responde un breve cuestionario asistido por IA para orientar tu atención.'
    },
    {
      icon: 'calendar_month',
      title: '2. Agenda tu Cita',
      description: 'Elige al especialista, fecha y hora. Recibe recordatorios automáticos.'
    },
    {
      icon: 'videocam',
      title: '3. Videoconsulta Segura',
      description: 'Ingresa a la sala de espera virtual y conéctate por WebRTC sin salir de casa.'
    },
    {
      icon: 'receipt_long',
      title: '4. Receta Digital',
      description: 'Recibe tu receta en PDF y órdenes de laboratorio directo a tu celular.'
    }
  ];

  readonly features: Feature[] = [
    {
      icon: 'folder_shared',
      title: 'Historia Clínica Dinámica',
      description: 'Tu expediente unificado. El médico tiene acceso a tus antecedentes y estudios en tiempo real.'
    },
    {
      icon: 'videocam',
      title: 'Teleconsulta HD',
      description: 'Sala de espera virtual y videollamada nativa. Habla con tu médico con la mejor calidad de audio y video.'
    },
    {
      icon: 'health_and_safety',
      title: 'Asistencia Inteligente',
      description: 'Seguimiento de tratamientos y recordatorios de medicación impulsados por IA.'
    },
    {
      icon: 'science',
      title: 'Resultados de Laboratorio',
      description: 'Recibe y visualiza tus exámenes médicos directamente en tu expediente digital.'
    },
    {
      icon: 'notifications_active',
      title: 'Lista de Espera Inteligente',
      description: 'Recibe alertas automáticas cuando se liberen turnos de tus especialistas preferidos.'
    },
    {
      icon: 'payments',
      title: 'Pagos en Línea',
      description: 'Paga tus consultas de forma segura y rápida con múltiples métodos de pago integrados.'
    }
  ];

  readonly securityItems: SecurityItem[] = [
    {
      icon: 'lock',
      title: 'Cifrado TLS 1.3',
      description: 'Tus datos viajan protegidos en cada conexión.'
    },
    {
      icon: 'shield',
      title: 'Protección AES-256',
      description: 'Almacenamiento blindado bajo estándares bancarios.'
    },
    {
      icon: 'cloud_sync',
      title: 'Respaldo en la Nube',
      description: 'Tu historial médico siempre disponible y seguro.'
    },
    {
      icon: 'verified_user',
      title: 'Respaldo Institucional',
      description: 'Avalado por la trayectoria del Hospital San Juan de Dios.'
    }
  ];
}
