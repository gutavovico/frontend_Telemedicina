# 🏥 Frontend Telemedicina (SaaS Multitenant)

Frontend web para la plataforma de Telemedicina SaaS Multitenant, desarrollado con **Angular 21 (Standalone Components & Signals)**, TailwindCSS y soporte para aislamiento de tenants por clínica.

---

## 🚀 Inicio Rápido

### 1. Requisitos Previos
* **Node.js**: v18+ o v20+
* **NPM**: v9+
* **Backend FastAPI**: Corriendo en `http://localhost:8000`

### 2. Instalación de Dependencias
```bash
npm install
```

### 3. Servidor de Desarrollo
```bash
ng serve
# o bien
npm start
```
Abre tu navegador en `http://localhost:4200/`.

---

## 🏢 Registro de Nuevas Clínicas (Onboarding Multitenant)

Existen **dos formas** para registrar y dar de alta una clínica en la plataforma:

### Opción A: Registro Público y Autónomo (Onboarding)
Ideal para que nuevos clientes o centros médicos se afilien de forma autónoma:
1. Navega a la ruta pública de registro:  
   👉 **`http://localhost:4200/registro-clinica`**
2. Completa los dos bloques del formulario:
   * **Datos de la Clínica:** Nombre de la clínica, Razón Social, NIT, Teléfono y Dirección.
   * **Administrador Inicial:** Nombres, Apellidos, Correo Electrónico y Contraseña.
3. Haz clic en **"Registrar Clínica"**.
4. El sistema creará la clínica y la cuenta administradora, y te redirigirá a `/login` para iniciar sesión inmediatamente.

---

### Opción B: Alta desde el Panel Super Administrador (SaaS)
Ideal para administración directa por parte del equipo de la plataforma:
1. Inicia sesión con la cuenta de **Super Administrador**:
   * **Correo:** `superadmin@telemedicina.com`
   * **Contraseña:** `superadmin123`
2. Ve al menú lateral 👉 **`Clínicas (SaaS)`** (o accede a `http://localhost:4200/admin/clinicas`).
3. Haz clic en el botón superior **`➕ Nueva Clínica`**.
4. Completa los datos en la ventana modal y haz clic en **"Registrar Clínica"**.
5. La nueva clínica aparecerá al instante en la lista activa del catálogo global.

---

## 🔑 Credenciales Seed para Pruebas

| Rol | Correo | Contraseña | Contexto / Clínica |
| :--- | :--- | :--- | :--- |
| **Super Administrador** | `superadmin@telemedicina.com` | `superadmin123` | Plataforma Global SaaS |
| **Admin Clínica 1** | `admin@sanjuandedios.com` | `admin123` | Hospital San Juan de Dios |
| **Médico Clínica 1** | `doctor@sanjuandedios.com` | `doctor123` | Hospital San Juan de Dios (Medicina General) |
| **Admin Clínica 2** | `admin@santamaria.com` | `admin123` | Centro Médico Santa María |
| **Médico Clínica 2** | `doctor@santamaria.com` | `doctor123` | Centro Médico Santa María (Cardiología) |

---

## 🛠️ Comandos Disponibles

### Compilación para Producción
```bash
npm run build
```
Los archivos optimizados se generarán en la carpeta `dist/`.

### Verificación de Tipos (TypeScript)
```bash
npx tsc --noEmit
```

### Pruebas Unitarias
```bash
npm test
```
