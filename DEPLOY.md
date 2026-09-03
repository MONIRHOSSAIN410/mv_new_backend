# Deploying the CookMe API to Vercel

The API is an Express app. On Vercel it runs as a serverless function:
`api/index.js` hands every request to `server.js`, and `vercel.json` routes all
paths there so Express keeps doing its own routing.

## 1. A database Vercel can reach

`mongodb://127.0.0.1:27017` is **your own computer** — Vercel cannot reach it.
Create a free MongoDB Atlas cluster and take its connection string:

```
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/cookme?retryWrites=true&w=majority
```

In Atlas → **Network Access**, allow `0.0.0.0/0`. Vercel's functions do not have
a fixed IP address, so a narrower rule will block them.

## 2. Deploy this folder

Push `backend/` to its own GitHub repository, then import it on Vercel.
If the backend lives inside a larger repo, set **Root Directory** to `backend`.

## 3. Environment variables (Vercel → Settings → Environment Variables)

| Name | Value |
|---|---|
| `MONGO_URI` | the Atlas string from step 1 |
| `JWT_SECRET` | a long random string |
| `JWT_EXPIRES_IN` | `30d` |
| `NODE_ENV` | `production` |
| `CLIENT_URL` | `https://<your-frontend>.vercel.app,*.vercel.app` |

`CLIENT_URL` is the CORS allow-list. It is comma-separated, and an entry may
start with `*.` to allow a whole subdomain — `*.vercel.app` keeps preview
deployments working, since their URL changes on every push.

## 4. Check it

```
https://<your-backend>.vercel.app/api/health
https://<your-backend>.vercel.app/api/products
```

`/api/health` answers even when the database is down, and reports the
connection state — useful when something is misconfigured:

```json
{ "success": true, "service": "CookMe API", "database": "connected", ... }
```

If it says `"database": "disconnected"`, the problem is `MONGO_URI` or the
Atlas network rule, not the deployment.

## 5. Fill the database

The seeder runs from your own machine against Atlas:

```
# PowerShell
$env:MONGO_URI="mongodb+srv://...";  npm run seed
```

Until it is seeded, `/api/products` returns an empty list and the storefront
falls back to its bundled offline catalogue.

## 6. Point the frontend at it

In the **frontend** Vercel project set:

```
VITE_API_URL=https://<your-backend>.vercel.app/api
```

Then redeploy the frontend — Vite bakes the value in at build time, so an
env-var change only takes effect on the next build.
