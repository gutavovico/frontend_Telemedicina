# Cierre CU34/CU35 — 2026-11-05

Base origin/main: 2f364f331ca3b6b82fa78896e93e61ae953e4954, incorporada sin conflictos ni merge.
El informe completo y los pasos de migración están en backend:
docs/REVISION-CU34-CU35.md y docs/DESPLIEGUE-CU35.md.

CU34 existente se reutiliza; contrato id_version_plan -> versiones_plan.id.
Renovación manual con versión aceptada, BOB mensual, upgrade tras pago confirmado,
cambio al cierre pagado y cancelación como regresión interna. No cambia Flutter.
La demo, credenciales/configuración, SI2-Grupo3.md personal, capturas, temporales,
dependencias y arreglos Cypress anteriores quedan fuera de la entrega.

Pruebas finales: backend 159 passed / 5 PG skipped; selección PostgreSQL 77 passed
incluyendo concurrencia, worker idempotente y CU18 poblada; frontend 292 passed,
5 skips existentes y build production aprobado. No sumar selecciones superpuestas.
Cadena final cu35_cu18_convergencia_023; CU18 recuperada de main/d952a29c,
sin reescribir revisiones compartidas. No hubo escrituras Neon ni Stripe real.
Anclas de las dos suscripciones Neon resueltas por decisión explícita del
responsable: adoptar día 5 tras verificar aniversario mensual exacto. Mapa privado
fuera de Git; diez regresiones PostgreSQL CU35 aprobadas, incluido cotejo del
esquema y ambos historiales anónimos. No es inferencia de evidencia histórica. Copia Neon identificada, Render Live
SHA/rama, Stripe sandbox y CLI OpenSpec siguen pendientes. doctor/validate no
pudieron ejecutarse: CommandNotFoundException; no se instalaron dependencias.

Respaldo de revisión: backup/review-pre-cierre-20261105-cierre-cu35 y stash
CU35 review preserved before main 20261105-cierre-cu35. Originales intactos.

Terrazas local/remota conserva su historia y cambios Cypress. Diverge de main
con b4d23c4, de5f46d y 76ee538: no se reescribe ni mueve. Commit de entrega limpio
en review/cu34-cu35-integrado. Publicar esa rama permite PR a main sin arrastrar
los arreglos antiguos ni hacer force push; usar Terrazas requiere conciliación
posterior autorizada. Pantalla: /admin/suscripcion, administrador de entidad.
