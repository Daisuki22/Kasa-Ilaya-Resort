# Split deployment: Vercel frontend + Render backend

The project is separated into two deployable folders:

- `frontend/` - Vite/React app for Vercel
- `backend/` - Node.js/Express API for local development and Render.

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

Create a Render Web Service with:

- Runtime: Node
- Build Command: `npm ci`
- Start Command: `npm start`

The Node server must listen on
`process.env.PORT`; TiDB's `4000` is only the database port.

Set these Render environment variables:

```env
NODE_ENV=production
FRONTEND_URL=https://your-vercel-site.vercel.app

KASA_DB_HOST=gateway01.ap-southeast-1.prod.aws.tidbcloud.com
KASA_DB_PORT=4000
KASA_DB_NAME=kasa_ilaya_resort
KASA_DB_USER=your-tidb-user
KASA_DB_PASS=your-tidb-password
```

Optional SMTP variables are documented in [backend/README.md](backend/README.md).

After Render deploys, check:

```text
https://your-render-service.onrender.com/
```

If login or API calls fail:

- Confirm Vercel `VITE_API_BASE_URL` points to the Render API URL.
- Confirm Render `FRONTEND_URL` exactly matches the Vercel site origin, without a trailing slash.
- Confirm the TiDB credentials are correct and reachable from Render.

## Local development

Frontend:

```bash
cd frontend
npm run dev
```

Start the Node backend in a second terminal:

```bash
cd backend
npm run dev
```

Set local MySQL connection values and a development `JWT_SECRET` in
`backend/.env`. The Vite proxy forwards `/api` requests to `localhost:10000`.

The frontend dev server proxies `/api` to the Node backend at:

```text
http://localhost:10000
```
