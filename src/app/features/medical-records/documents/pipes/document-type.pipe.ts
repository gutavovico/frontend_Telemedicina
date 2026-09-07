import { Pipe, PipeTransform } from '@angular/core';
import { TipoDocumento } from '../models/clinical-document.models';

const TIPO_LABEL: Record<TipoDocumento, string> = {
  RECETA: 'Receta',
  ORDEN_LAB: 'Orden de Laboratorio',
  RESULTADO_LAB: 'Resultado de Laboratorio',
  CERTIFICADO: 'Certificado Médico',
  INDICACION: 'Indicación Médica'
};

const TIPO_ICON: Record<TipoDocumento, string> = {
  RECETA: 'medication',
  ORDEN_LAB: 'science',
  RESULTADO_LAB: 'lab_profile',
  CERTIFICADO: 'assignment',
  INDICACION: 'healing'
};

@Pipe({
  name: 'documentType',
  standalone: true
})
export class DocumentTypePipe implements PipeTransform {
  transform(value: TipoDocumento | string): string {
    return TIPO_LABEL[value as TipoDocumento] ?? value ?? '';
  }
}

@Pipe({
  name: 'documentIcon',
  standalone: true
})
export class DocumentIconPipe implements PipeTransform {
  transform(value: TipoDocumento | string): string {
    return TIPO_ICON[value as TipoDocumento] ?? 'description';
  }
}