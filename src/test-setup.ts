// Setup global mínimo para Vitest + Angular (CU28).
// Carga el compilador JIT antes de importar cualquier símbolo de
// @angular/common/@angular/router. Sin esto, la evaluación de
// `PlatformLocation` falla con:
// "The injectable 'PlatformLocation' needs to be compiled using the JIT
//  compiler, but '@angular/compiler' is not available."
// No incluye mocks globales: no oculta errores de Angular ni del Router.
import '@angular/compiler';
