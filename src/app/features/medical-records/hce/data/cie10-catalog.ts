import { Cie10Item } from '../../../../core/models/hce.models';

export const CIE10_CATALOGO: Cie10Item[] = [
  // Enfermedades Infecciosas y Respiratorias
  { codigo: 'J00', descripcion: 'Rinofaringitis aguda [resfriado común]', categoria: 'Respiratorio' },
  { codigo: 'J01.9', descripcion: 'Sinusitis aguda, no especificada', categoria: 'Respiratorio' },
  { codigo: 'J02.9', descripcion: 'Faringitis aguda, no especificada', categoria: 'Respiratorio' },
  { codigo: 'J03.9', descripcion: 'Amigdalitis aguda, no especificada', categoria: 'Respiratorio' },
  { codigo: 'J06.9', descripcion: 'Infección aguda de las vías respiratorias superiores, no especificada', categoria: 'Respiratorio' },
  { codigo: 'J12.9', descripcion: 'Neumonía viral, no especificada', categoria: 'Respiratorio' },
  { codigo: 'J18.9', descripcion: 'Neumonía, no especificada', categoria: 'Respiratorio' },
  { codigo: 'J20.9', descripcion: 'Bronquitis aguda, no especificada', categoria: 'Respiratorio' },
  { codigo: 'J44.9', descripcion: 'Enfermedad pulmonar obstructiva crónica (EPOC), no especificada', categoria: 'Respiratorio' },
  { codigo: 'J45.9', descripcion: 'Asma, no especificada', categoria: 'Respiratorio' },

  // Enfermedades Cardiovasculares
  { codigo: 'I10', descripcion: 'Hipertensión esencial (primaria)', categoria: 'Cardiovascular' },
  { codigo: 'I11.9', descripcion: 'Enfermedad cardíaca hipertensiva sin insuficiencia cardíaca', categoria: 'Cardiovascular' },
  { codigo: 'I20.9', descripcion: 'Angina de pecho, no especificada', categoria: 'Cardiovascular' },
  { codigo: 'I21.9', descripcion: 'Infarto agudo del miocardio, sin otra especificación', categoria: 'Cardiovascular' },
  { codigo: 'I50.9', descripcion: 'Insuficiencia cardíaca, no especificada', categoria: 'Cardiovascular' },
  { codigo: 'I83.9', descripcion: 'Venas varicosas de los miembros inferiores sin úlcera ni inflamación', categoria: 'Cardiovascular' },

  // Enfermedades Endocrinas, Nutricionales y Metabólicas
  { codigo: 'E10.9', descripcion: 'Diabetes mellitus tipo 1 sin mención de complicación', categoria: 'Metabólico' },
  { codigo: 'E11.9', descripcion: 'Diabetes mellitus tipo 2 sin mención de complicación', categoria: 'Metabólico' },
  { codigo: 'E03.9', descripcion: 'Hipotiroidismo, no especificado', categoria: 'Metabólico' },
  { codigo: 'E05.9', descripcion: 'Tirotoxicosis [hipertiroidismo], no especificada', categoria: 'Metabólico' },
  { codigo: 'E66.0', descripcion: 'Obesidad debida a exceso de calorías', categoria: 'Metabólico' },
  { codigo: 'E78.0', descripcion: 'Hipercolesterolemia pura', categoria: 'Metabólico' },
  { codigo: 'E78.2', descripcion: 'Hiperlipidemia mixta', categoria: 'Metabólico' },

  // Enfermedades del Aparato Digestivo
  { codigo: 'K21.9', descripcion: 'Enfermedad por reflujo gastroesofágico sin esofagitis', categoria: 'Digestivo' },
  { codigo: 'K29.7', descripcion: 'Gastritis, no especificada', categoria: 'Digestivo' },
  { codigo: 'K30', descripcion: 'Dispepsia funcional', categoria: 'Digestivo' },
  { codigo: 'K52.9', descripcion: 'Gastroenteritis y colitis no infecciosas, no especificadas', categoria: 'Digestivo' },
  { codigo: 'K58.9', descripcion: 'Síndrome del colon irritable sin diarrea', categoria: 'Digestivo' },
  { codigo: 'K80.2', descripcion: 'Cálculo de la vesícula biliar sin colecistitis', categoria: 'Digestivo' },

  // Enfermedades del Sistema Osteomuscular y Tejido Conectivo
  { codigo: 'M54.5', descripcion: 'Lumbago no especificado [dolor lumbar]', categoria: 'Osteomuscular' },
  { codigo: 'M54.2', descripcion: 'Cervicalgia', categoria: 'Osteomuscular' },
  { codigo: 'M25.5', descripcion: 'Dolor articular [artralgia]', categoria: 'Osteomuscular' },
  { codigo: 'M19.9', descripcion: 'Artrostris, no especificada', categoria: 'Osteomuscular' },
  { codigo: 'M79.1', descripcion: 'Mialgia', categoria: 'Osteomuscular' },

  // Sistema Nervioso y Salud Mental
  { codigo: 'G43.9', descripcion: 'Migraña, no especificada', categoria: 'Neurología' },
  { codigo: 'G44.2', descripcion: 'Cefalea debida a tensión', categoria: 'Neurología' },
  { codigo: 'F41.1', descripcion: 'Trastorno de ansiedad generalizada', categoria: 'Salud Mental' },
  { codigo: 'F32.9', descripcion: 'Episodio depresivo, no especificado', categoria: 'Salud Mental' },
  { codigo: 'G47.0', descripcion: 'Trastornos del inicio y del mantenimiento del sueño [insomnio]', categoria: 'Neurología' },

  // Enfermedades del Sistema Genitourinario
  { codigo: 'N39.0', descripcion: 'Infección del tracto urinario, sitio no especificado', categoria: 'Genitourinario' },
  { codigo: 'N20.0', descripcion: 'Cálculo del riñón [nefrolitiasis]', categoria: 'Genitourinario' },

  // Síntomas Generales y Exámenes Preventivos
  { codigo: 'R50.9', descripcion: 'Fiebre, no especificada', categoria: 'Síntomas Generales' },
  { codigo: 'R51', descripcion: 'Cefalea', categoria: 'Síntomas Generales' },
  { codigo: 'R53', descripcion: 'Malestar y fatiga', categoria: 'Síntomas Generales' },
  { codigo: 'R10.4', descripcion: 'Otros dolores abdominales y los no especificados', categoria: 'Síntomas Generales' },
  { codigo: 'R42', descripcion: 'Mareo y desvanecimiento [vértigo]', categoria: 'Síntomas Generales' },
  { codigo: 'Z00.0', descripcion: 'Examen médico general [control de salud de rutina]', categoria: 'Control y Chequeo' },
  { codigo: 'Z01.0', descripcion: 'Examen de ojos y de la visión', categoria: 'Control y Chequeo' }
];

export function buscarCie10(termino: string): Cie10Item[] {
  if (!termino || termino.trim().length < 2) {
    return [];
  }
  const t = termino.toLowerCase().trim();
  return CIE10_CATALOGO.filter(
    item =>
      item.codigo.toLowerCase().includes(t) ||
      item.descripcion.toLowerCase().includes(t) ||
      item.categoria.toLowerCase().includes(t)
  ).slice(0, 10);
}
