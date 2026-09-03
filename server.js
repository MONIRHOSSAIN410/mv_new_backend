import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";

import connectDB from "./config/db.js";
import productRoutes from "./routes/productRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

dotenv.config();

const app = express();

/* ------------------------------------------------------------------ *
 * CORS
 *
 * CLIENT_URL is a comma-separated list of the sites allowed to call this
 * API, for example:
 *
 *   CLIENT_URL=http://localhost:5173,https://cookme.vercel.app
 *
 * An entry may start with "*." to allow a whole subdomain, which is handy
 * for Vercel preview deployments:
 *
 *   CLIENT_URL=https://cookme.vercel.app,*.vercel.app
 *
 * Leaving CLIENT_URL unset allows every origin — fine while developing,
 * worth tightening once the site is live.
 * ------------------------------------------------------------------ */

const trimSlash = (s) => s.trim().replace(/\/+$/, "");

const ALLOWED = (process.env.CLIENT_URL || "")
  .split(",")
  .map(trimSlash)
  .filter(Boolean);

function isAllowed(origin) {
  if (!ALLOWED.length) return true; // not configured -> open
  const clean = trimSlash(origin);
  const host = (() => {
    try {
      return new URL(clean).host;
    } catch {
      return "";
    }
  })();

  return ALLOWED.some((entry) => {
    if (entry.startsWith("*.")) return host.endsWith(entry.slice(1));
    return entry === clean;
  });
}

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header: curl, server-to-server, same-origin requests.
      if (!origin) return callback(null, true);
      if (isAllowed(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  })
);

app.use(express.json());
if (process.env.NODE_ENV === "development") app.use(morgan("dev"));

/**
 * Answered before the database middleware below, so it stays instant and can
 * still say what is wrong when MongoDB is unreachable.
 */
app.get("/api/health", (req, res) =>
  res.json({
    success: true,
    service: "CookMe API",
    database: ["disconnected", "connected", "connecting", "disconnecting"][
      mongoose.connection.readyState
    ],
    time: new Date().toISOString(),
  })
);

/**
 * Make sure the database is up before any route touches it. On Vercel this
 * runs on every invocation and returns instantly once the instance is warm.
 */
app.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch {
    /* connectDB already logged it; the route will answer with its own error */
  }
  next();
});

app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);

app.use(notFound);
app.use(errorHandler);

// On Vercel the platform serves the app (see api/index.js), so there is no
// port to listen on. Locally `npm start` still runs a normal server.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`CookMe API running on http://localhost:${PORT}`));
}

export default app;
