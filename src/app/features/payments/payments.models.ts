export interface Comprobante {
  id_comprobante: number;
  id_pago: number;
  numero_comprobante: string;
  tipo_comprobante: string;
  fecha_emision: string | null;
  archivo_url: string | null;
  estado: string;
}

export interface Pago {
  id_pago: number;
  id_usuario: number;
  id_cita: number | null;
  monto: number | string;
  moneda: string;
  metodo_pago: string | null;
  pasarela: string | null;
  referencia_transaccion: string | null;
  fecha_pago: string | null;
  estado: string;
  url_checkout: string | null;
  expira_en: string | null;
  created_at: string | null;
  cita_fecha: string | null;
  cita_hora: string | null;
  medico_nombre: string | null;
  especialidad_nombre: string | null;
  tipo_consulta: string | null;
  comprobante: Comprobante | null;
}

export interface CheckoutResponse extends Pago {
  qr_url: string | null;
  qr_payload: string | null;
  simulado: boolean;
}

export interface PagoListResponse {
  total: number;
  items: Pago[];
}

export interface CitaPendientePago {
  id_cita: number;
  fecha_cita: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  medico_nombre: string | null;
  especialidad_nombre: string | null;
  tipo_consulta: string | null;
  estado_cita: string | null;
  monto: number | string;
  moneda: string;
  estado_pago: string | null;
  id_pago: number | null;
}

export interface CitaPendienteListResponse {
  total: number;
  items: CitaPendientePago[];
}

export interface EstadoPasarela {
  habilitada: boolean;
  modo: string;
  moneda: string;
  pasarela: string;
}
