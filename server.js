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
 * CORS Setup
 * ------------------------------------------------------------------ */

const trimSlash = (s) => s.trim().replace(/\/+$/, "");

const ALLOWED = (process.env.CLIENT_URL || "")
  .split(",")
  .map(trimSlash)
  .filter(Boolean);

function isAllowed(origin) {
  if (!ALLOWED.length) return true;
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
      if (!origin || isAllowed(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  })
);

/* ------------------------------------------------------------------ *
 * Middlewares & Routes
 * ------------------------------------------------------------------ */

app.use(express.json());

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

/* ------------------------------------------------------------------ *
 * The API, as one router
 *
 * It is mounted twice below — at "/api" and at "/" — so the API answers
 * whether or not the "/api" prefix survives the hosting platform's routing.
 * That prefix going missing is what made every request come back as
 * "Not found - /api" on Vercel.
 * ------------------------------------------------------------------ */

const apiRouter = express.Router();

// Answered before the database middleware, so it stays instant and can still
// say what is wrong when MongoDB is unreachable.
apiRouter.get("/health", (req, res) =>
  res.json({
    success: true,
    service: "CookMe API",
    database: ["disconnected", "connected", "connecting", "disconnecting"][
      mongoose.connection.readyState
    ],
    time: new Date().toISOString(),
  })
);

// Make sure the database is up before any route touches it. On Vercel this
// runs per invocation and returns instantly once the instance is warm.
apiRouter.use(async (req, res, next) => {
  let conn = null;
  try {
    conn = await connectDB();
  } catch {
    conn = null;
  }

  // Without a database, say so at once. Letting the request through would
  // make every query buffer and then time out — seconds of waiting for an
  // answer we already know.
  if (!conn) {
    return res.status(503).json({
      success: false,
      message:
        "The database is not reachable. Set MONGO_URI to a MongoDB Atlas " +
        "connection string — localhost is not reachable from a deployed server.",
      database: "disconnected",
    });
  }

  return next();
});

apiRouter.use("/products", productRoutes);
apiRouter.use("/categories", categoryRoutes);
apiRouter.use("/orders", orderRoutes);
apiRouter.use("/users", userRoutes);

app.use("/api", apiRouter);
app.use("/", apiRouter);

// Error Handling Middlewares
app.use(notFound);
app.use(errorHandler);

/* ------------------------------------------------------------------ *
 * Server Start
 * ------------------------------------------------------------------ */

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () =>
    console.log(`CookMe API running on http://localhost:${PORT}`)
  );
}

export default app;