# `_legacy/` — restos archivados

Esta carpeta **no es código de producción**. No la compila el build de Angular
(nada la importa) y no está registrada en `app.routes.ts`.

Guarda restos a medio hacer que se convertían en una trampa para quien retomara
el trabajo.

---

## `patients/patient-detail/patient-detail.html`

**Caso de uso:** CU03 — Gestión de Pacientes. **No es parte de CU10, CU12 ni CU23.**

**Estado:** plantilla Angular huérfana de 285 líneas (17 KB) **sin clase de
componente**. No existe `patient-detail.ts` ni `patient-detail.css`.

### Por qué era una trampa

El template es markup completo y plausible, con tabs, tarjetas de datos y
formularios. Pero depende de cosas que **nunca se escribieron**:

| Símbolo usado en el template | Existe en el repositorio |
|---|---|
| `patientService.isLoading()` | No |
| `patientService.selectedPatient()` | No |
| `activeTab()` | No |
| `setTab()` | No |
| `calculateAge()` | No |

No hay ningún `PatientService` en todo el proyecto. Conectar este template
directamente en `app.routes.ts` rompe la compilación de TypeScript de inmediato.

Además enlaza a rutas que tampoco existen: `/pacientes/:id/documentos` y
`/pacientes/:id/editar`.

### Cómo retomarlo

Implementar el componente completo a partir del contrato:

```
openspec/contracts/patients.md
openspec/specs/patient-management/spec.md
```

y después crear `patient-detail.ts` con los miembros que el template ya
invoca: `patientService`, `activeTab()`, `setTab()`, `calculateAge()`.
