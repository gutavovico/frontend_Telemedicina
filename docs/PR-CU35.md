CU35: gestionar cambios de plan sobre suscripciones versionadas CU31/CU34

Reutiliza /admin/suscripcion y el catálogo CU34: tarjetas mensuales BOB, condiciones contratadas separadas de la oferta actual, cotización backend y resumen antes de confirmar. Conserva Pago pendiente hasta confirmación, destino/fecha de cambio programado, revisión de renovación e historial. Cancelación queda cubierta como regresión interna, fuera del guion de presentación.

Solo pantalla, tipos, cliente HTTP y pruebas de suscripción. No incorpora cambios antiguos de auth, CI o Cypress de Terrazas ni datos/controles de demo. Requiere API backend CU35 y migración convergente 023; desplegar después de la API compatible.

Validación: 292 pruebas aprobadas, 5 skips existentes; build production aprobado con dependencias existentes. Pagos simulados en las pruebas; Stripe sandbox real pendiente. Sin cambios Flutter.

La entrega usa review/cu34-cu35-integrado desde main: Terrazas diverge con tres commits anteriores y mantiene cambios locales ajenos. No se reescribió esa rama ni se hizo force push. Revisar la API, el mapa de ancla original y la copia Neon antes del despliegue.
