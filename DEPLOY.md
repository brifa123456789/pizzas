# 🚀 Despliegue gratuito de Bella Napoli (GitHub + TiDB Cloud + Netlify)

Arquitectura: **Netlify** (frontend + API serverless, gratis) + **TiDB Cloud
Serverless** (MySQL, 25GB gratis). Sin tarjeta de crédito.

La API Express corre como **función serverless de Netlify**
(`netlify/functions/api.mjs`), así que no hace falta un hosting de Node aparte.

---

## 1) Base de datos — TiDB Cloud (gratis, sin tarjeta)

1. Entra a **https://tidbcloud.com** y crea una cuenta.
2. **Create Cluster → TiDB Cloud Serverless** (plan Free). Región cercana (ej. `us-east-1`).
3. Pulsa **Connect** → "Connect With: General" → **Generate Password**.
   Copia `host`, `port` (4000), `user` (termina en `.root`) y la password.
4. Edita `backend/.env` con esos datos y `DB_SSL=true`:

   ```
   DB_HOST=gateway01.us-east-1.prod.aws.tidbcloud.com
   DB_PORT=4000
   DB_USER=xxxxxxxx.root
   DB_PASSWORD=tu_password_de_tidb
   DB_NAME=bellanapoli
   DB_SSL=true
   ```
5. Inicializa desde tu PC (crea tablas, datos y el admin):

   ```bash
   cd backend
   npm install
   npm run init-db
   ```

---

## 2) Subir a GitHub

En la raíz de la carpeta `pizzas`:

```bash
git init
git add .
git commit -m "Bella Napoli: sitio + panel admin"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/pizzas.git
git push -u origin main
```

> El `.gitignore` ya excluye `node_modules/`, `.env` y `dist/`, así que tus
> credenciales no se suben.

---

## 3) Frontend + API — Netlify (gratis)

1. Entra a **https://app.netlify.com** → **Add new site → Import an existing
   project** → conecta el repo de GitHub. Netlify lee el `netlify.toml` de la raíz:
   compila el frontend, publica `frontend/dist` y despliega la función `api`.
2. En **Site configuration → Environment variables**, agrega:

   ```
   DB_HOST     = (host de TiDB)
   DB_PORT     = 4000
   DB_USER     = (usuario de TiDB, termina en .root)
   DB_PASSWORD = (password de TiDB)
   DB_NAME     = bellanapoli
   DB_SSL      = true
   JWT_SECRET  = (cadena larga y aleatoria)
   ```

   > Si las agregas después del primer deploy: **Deploys → Trigger deploy →
   > Deploy site** para que tomen efecto.
3. Listo. Tu sitio queda en `https://tu-sitio.netlify.app` y la API en
   `https://tu-sitio.netlify.app/api/health` (debe responder `{"ok":true,...}`).

El frontend llama a la API en el **mismo dominio** (`/api`), así que no hay que
configurar `VITE_API_URL` ni CORS.

---

## 4) Verificación final

- Abre el sitio → debe cargar el catálogo (datos desde TiDB).
- **Admin** → inicia sesión → crea/edita un producto con foto, talles y etiqueta.
- Recarga la vista pública → el cambio debe verse.

---

## Límites de los planes gratis

- **TiDB:** 25 GB, 250M RUs/mes, sin vencimiento, sin tarjeta.
- **Netlify:** 100 GB de ancho de banda/mes y 125.000 llamadas a funciones/mes.
