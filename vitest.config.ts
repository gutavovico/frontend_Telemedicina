import { defineConfig } from 'vitest/config';

// Configuración mínima y explícita para ejecutar pruebas unitarias Angular
// con `npx vitest run` (sin el builder `@angular/build:unit-test`).
// - environment jsdom: requerido por componentes Angular.
// - setupFiles: carga `@angular/compiler` (JIT) antes de los specs para
//   evitar el fallo de `PlatformLocation` parcialmente compilado.
// El spec raíz generado por Angular depende del runner del CLI para resolver
// `templateUrl` y `styleUrl`; se ejecuta por separado con `ng test`.
// Vitest cubre los specs del código de la aplicación y de CU16.
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    exclude: ['src/app/app.spec.ts'],
  },
});
