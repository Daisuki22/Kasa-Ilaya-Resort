# Split deployment: Vercel frontend + Render backend

The project is separated into two deployable folders:

- `frontend/` - Vite/React app for Vercel
- `backend/` - PHP/MySQL API for Render

## Frontend on Vercel

Deploy from the `frontend/` folder.

Vercel settings:

- Root Directory: `frontend`
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

Set this Vercel environment variable:

```env
VITE_API_BASE_URL=https://your-render-service.onrender.com/api
```

## Backend on Render

Deploy from the `backend/` folder.

Render should use:

- `backend/render.yaml`
- `backend/Dockerfile`
- `backend/deploy/render/nginx.conf.template`

Set these Render environment variables:

```env
KASA_API_PATH=/api
KASA_FRONTEND_URL=https://your-vercel-site.vercel.app

MYSQLHOST=your-mysql-host
MYSQLPORT=3306
MYSQLDATABASE=kasa_ilaya_resort
MYSQLUSER=your-mysql-user
MYSQLPASSWORD=your-mysql-password
```

Optional production variables:

```env
KASA_MAIL_ENABLED=true
KASA_SMS_ENABLED=true
SEMAPHORE_API_KEY=your-key
```

After Render deploys, check:

```text
https://your-render-service.onrender.com/api/health.php
```

If login or API calls fail:

- Confirm Vercel `VITE_API_BASE_URL` points to the Render `/api` URL.
- Confirm Render `KASA_FRONTEND_URL` exactly matches the Vercel site origin, without a trailing slash.
- Confirm the MySQL credentials are correct and reachable from Render.

## Local development

Frontend:

```bash
cd frontend
npm run dev
```

Backend stays under:

```text
backend/api
```

The frontend dev server proxies `/api` to:

```text
http://localhost/Kasa-Ilaya-Resort/backend/api
```
