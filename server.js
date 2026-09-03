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

// Health Check Route
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

// DB Connection Enforcement Middleware
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

// API Routes
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);

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