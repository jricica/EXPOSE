# EXPOSE

EXPOSE es una red social anónima y efímera desarrollada como proyecto full stack.  
La aplicación permite que los usuarios publiquen contenido sin perfiles públicos, sin likes y sin screenshots, creando una experiencia enfocada en libertad de expresión y privacidad.

Los posts desaparecen automáticamente después de 24 horas.

---

# Integrantes

- Jan Ricica
- Ana Sofia Eggenberger
- Juan Pablo Madriz
- Victor Saravia

---

# Idea del Proyecto

Actualmente la mayoría de redes sociales giran alrededor de seguidores, popularidad y validación social.  
EXPOSE busca romper con eso creando una plataforma donde:

- No existen perfiles públicos
- Los posts son temporales
- El contenido es anónimo
- Se prioriza la privacidad del usuario

La idea principal es permitir que las personas publiquen pensamientos, opiniones o experiencias sin presión social.

---

# Tecnologías Utilizadas

## Frontend
- React
- TypeScript
- React Router DOM
- CSS
- Lucide React

## Backend
- Node.js
- Express
- TypeScript

## Base de Datos
- DynamoDB

## Cloud & Storage
- Amazon S3
- AWS SDK

## Realtime
- WebSockets

## Testing
- Jest

---

# Arquitectura del Proyecto

El backend sigue una arquitectura basada en capas para mantener una estructura limpia y escalable:

- Controllers
- Services
- Repositories
- Routes
- Models
- Middleware

Esto permite separar responsabilidades y mejorar el mantenimiento del proyecto.

---

# Estructura del Proyecto

```bash
EXPOSE/
│
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── feed/
│   │   │   ├── comments/
│   │   │   ├── admin/
│   │   │   ├── upload/
│   │   │   └── users/
│   │   │
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── middleware/
│   │   ├── config/
│   │   └── server.ts
│   │
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── modules/
│   │   ├── services/
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.tsx
│   │
│   └── package.json
│
└── README.md
```

---

# Seguridad

EXPOSE implementa distintas medidas de seguridad:

- JWT Authentication
- Contraseñas encriptadas con bcrypt
- Validación de MIME Types
- Validación de inputs
- Middleware de autenticación
- Protección de rutas privadas
- UUIDs para nombres seguros de archivos
- Signed URLs para acceso privado a imágenes
- Validación de uploads
- Manejo seguro de sesiones

---

# Flujo General de la Aplicación

1. El usuario se registra o inicia sesión
2. Se genera un JWT Token
3. El usuario puede crear publicaciones
4. Las imágenes se suben a Amazon S3
5. El feed se actualiza en tiempo real
6. Los posts expiran automáticamente después de 1 hora
7. Los administradores pueden moderar contenido reportado

---

# Instalación del Proyecto

## 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/expose.git
```

---

## 2. Entrar al proyecto

```bash
cd expose
```

---

# Backend Setup

## 1. Entrar al backend

```bash
cd backend
```

## 2. Instalar dependencias

```bash
npm install
```

## 3. Crear archivo .env

```env
PORT=3000

JWT_SECRET=your_secret

AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=your_region
AWS_BUCKET_NAME=your_bucket

DYNAMODB_REGION=your_region
```

## 4. Correr backend

```bash
npm run dev
```

---

# Frontend Setup

## 1. Entrar al frontend

```bash
cd frontend
```

## 2. Instalar dependencias

```bash
npm install
```

## 3. Correr frontend

```bash
npm run dev
```

---

# Variables de Entorno

## Backend

| Variable | Descripción |
|---|---|
| PORT | Puerto del servidor |
| JWT_SECRET | Clave secreta para JWT |
| AWS_ACCESS_KEY_ID | Access Key de AWS |
| AWS_SECRET_ACCESS_KEY | Secret Key de AWS |
| AWS_REGION | Región de AWS |
| AWS_BUCKET_NAME | Nombre del bucket S3 |
| DYNAMODB_REGION | Región de DynamoDB |

---

# API Endpoints Principales

## Auth

| Método | Endpoint |
|---|---|
| POST | /api/auth/register |
| POST | /api/auth/login |
| GET | /api/auth/me |

---

## Feed

| Método | Endpoint |
|---|---|
| GET | /api/feed |
| POST | /api/feed |
| DELETE | /api/feed/:id |

---

## Comments

| Método | Endpoint |
|---|---|
| POST | /api/comments |
| DELETE | /api/comments/:id |

---

## Uploads

| Método | Endpoint |
|---|---|
| POST | /api/upload |

---

# Testing

## Ejecutar tests backend

```bash
npm run test
```

---

# Diseño del Frontend

El frontend fue diseñado con una interfaz moderna inspirada en aplicaciones sociales actuales:

- Glassmorphism
- Floating Navigation
- Diseño responsive
- Experiencia minimalista
- Colores oscuros
- Componentes reutilizables
- Navegación intuitiva

---

# Instalación y ejecución local

## Requisitos

- Node.js
- npm
- MySQL
- Git

---

## 1. Clonar repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd EXPOSE
```

---

## 2. Instalar dependencias

### Frontend

```bash
cd frontend
npm install
```

### Backend

```bash
cd backend
npm install
```

---

## 3. Configurar variables de entorno

Crear un archivo `.env` dentro de `/backend`.

Ejemplo:

```env
PORT=3000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=expose
DB_PORT=3306

JWT_SECRET=supersecret
```

---

## 4. Inicializar base de datos

```bash
npm run db:init
```

---

## 5. Ejecutar backend

```bash
npm run dev
```

---

## 6. Ejecutar frontend

En otra terminal:

```bash
cd frontend
npm run dev
```

---

## 7. Abrir aplicación

Frontend:
```txt
http://localhost:5173
```

Backend:
```txt
http://localhost:3000
```

---

# Decisiones Técnicas Importantes

## DynamoDB
Se utilizó DynamoDB por su escalabilidad y velocidad de lectura/escritura para manejar publicaciones y comentarios en tiempo real.

## Amazon S3
Las imágenes se almacenan en S3 para separar el almacenamiento multimedia del backend principal y mejorar escalabilidad.

## WebSockets
Se implementaron WebSockets para mantener el feed actualizado en tiempo real sin necesidad de refrescar la página.

## Arquitectura por capas
La separación entre controllers, services y repositories mejora la organización del código y facilita mantenimiento y testing.

---

# Aprendizajes del Proyecto

Durante el desarrollo del proyecto aprendimos sobre:

- Arquitectura full stack
- React con TypeScript
- APIs REST
- WebSockets
- Seguridad web
- AWS S3
- DynamoDB
- Testing con Jest
- Manejo de autenticación
- Diseño responsive
- Clean Architecture
- Validación de uploads
- Manejo de estado frontend
- Integración cloud

---

# Retos del Proyecto

Algunos retos importantes fueron:

- Implementar tiempo real
- Manejar uploads seguros
- Integrar AWS S3
- Diseñar expiración automática de posts
- Mantener sincronización frontend/backend
- Manejo de autenticación segura
- Validar tipos de archivos correctamente
- Diseñar un frontend moderno y consistente

---

# Futuras Mejoras

- Sistema de notificaciones
- Chat en tiempo real
- Mejor sistema de moderación
- Algoritmo personalizado para feed
- Mobile App
- Soporte para videos
- Sistema de tendencias
- Mejoras de accesibilidad
- Sistema avanzado de reportes

---

# Preview

## Login
![Login](./assets/login.png)

## Dashboard
![Dashboard](./assets/dashboard.png)

## Feed
![Feed](./assets/feed.png)

---

# Licencia

Proyecto académico desarrollado para fines educativos.

---

# Comandos Útiles

## Backend

```bash
npm run dev
npm run build
npm run test
```

## Frontend

```bash
npm run dev
npm run build
```

---

# Estado del Proyecto

Proyecto actualmente funcional con:

- Autenticación
- Feed
- Comentarios
- Uploads
- Moderación
- Tiempo real
- Dashboard administrativo
- Responsive Design
- Integración cloud

---

# Autor

Proyecto desarrollado como parte del curso de Desarrollo de Software / Ingeniería de Software
