# 🍕 Bella Napoli — Sitio web + Panel de administración

Pizzería artesanal: una **vista pública** con el catálogo y carrito de compras, y un
**panel de administración** protegido donde cargás productos, categorías, tamaños y
los textos del sitio sin tocar código.

## Tecnologías

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Base de datos:** MySQL / TiDB Cloud
- **Autenticación:** JWT + contraseñas encriptadas (bcrypt)

## Estructura

```
bellanapoli-app/
├── backend/          API REST (Node + Express + MySQL)
│   ├── routes/       endpoints: auth, items, categories, site
│   ├── middleware/   validación del token
│   ├── scripts/      inicialización de la base de datos
│   ├── schema.sql    estructura + datos de ejemplo
│   └── server.js
├── frontend/         React (vista pública + panel admin)
│   └── src/
│       ├── api.js    todas las llamadas al backend
│       └── App.jsx   la aplicación
└── netlify/          función serverless que envuelve la API
```

---

## Puesta en marcha (local)

### Requisitos previos
- Node.js 18 o superior
- MySQL 8 (o MariaDB) corriendo en tu máquina

### 1) Backend

```bash
cd backend
cp .env.example .env      # edita .env con tus datos de MySQL
npm install
npm run init-db           # crea la base de datos, tablas, datos y el admin
npm run dev               # levanta la API en http://localhost:4000
```

> `npm run init-db` crea la base de datos completa y el usuario administrador
> con la clave que pusiste en `.env` (por defecto `admin` / `pizza2025`).

### 2) Frontend

En otra terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev               # abre http://localhost:5173
```

Entra a **Admin** (arriba a la derecha) con `admin` / `pizza2025`.

---

## Campos de cada producto

- **Nombre, descripción, precio, categoría** (obligatorios los tres primeros y la categoría)
- **Subcategoría** (ej: Clásicas, Especiales)
- **Tamaños** (texto libre: `Chica, Mediana, Grande`)
- **Etiqueta**: Nuevo / Oferta, con texto opcional (ej: `-20%`)
- **Foto** opcional (se comprime sola a WebP/JPEG, se guarda en la BD)

---

## Endpoints de la API

| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| POST | `/api/auth/login` | público | Inicia sesión, devuelve el token |
| GET | `/api/items/public` | público | Productos visibles |
| GET | `/api/categories` | público | Categorías |
| GET | `/api/site` | público | Textos del sitio |
| GET | `/api/items` | admin | Todos los productos |
| POST | `/api/items` | admin | Crear producto |
| PUT | `/api/items/:id` | admin | Editar producto |
| PATCH | `/api/items/:id/visible` | admin | Mostrar/ocultar |
| DELETE | `/api/items/:id` | admin | Eliminar producto |
| POST/PUT/DELETE | `/api/categories` | admin | Gestionar categorías |
| PUT | `/api/site` | admin | Guardar textos del sitio |

---

## Desplegar en producción

Ver **DEPLOY.md** — GitHub + TiDB Cloud + Netlify, todo gratis y sin tarjeta.

## Seguridad — antes de publicar

- Cambia `JWT_SECRET` por una cadena larga y aleatoria.
- Cambia la clave del administrador por defecto (`ADMIN_PASSWORD` en `.env`).
- Sirve todo por HTTPS (Netlify ya lo hace).
