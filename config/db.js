import mongoose from "mongoose";

/**
 * One MongoDB connection, reused — and a fast, honest failure when there
 * isn't one.
 *
 * Two things this solves:
 *
 * 1. On Vercel every request may land on a fresh serverless instance. Opening
 *    a new connection each time exhausts the Atlas connection limit within
 *    minutes, so the connection promise is cached on `globalThis` and a warm
 *    instance reuses the socket it already has.
 *
 * 2. When the database is unreachable, the old code let every request pay a
 *    fresh dial plus ten seconds of query buffering. Now one failure is
 *    remembered for a short while and later requests are told immediately.
 */
const store = globalThis;
if (!store.__cookmeMongo) {
  store.__cookmeMongo = { conn: null, promise: null, failedAt: 0 };
}
const cache = store.__cookmeMongo;

/** How long to stop dialling again after a failed attempt. */
const RETRY_AFTER_MS = 20_000;

mongoose.set("strictQuery", true);
// Never sit on a query waiting for a connection that is not coming.
mongoose.set("bufferTimeoutMS", 4000);

export default async function connectDB() {
  // Already connected and still healthy.
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;

  // A recent attempt failed — answer at once instead of hanging again.
  if (cache.failedAt && Date.now() - cache.failedAt < RETRY_AFTER_MS) return null;

  if (!cache.promise) {
    const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/cookme";

    cache.promise = mongoose
      .connect(uri, {
        // Fail fast — a serverless request should not wait 30 seconds for a
        // database that is not there.
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        // Instances are many and short-lived, so each keeps a small pool
        // rather than the default 100.
        maxPoolSize: 5,
      })
      .catch((err) => {
        cache.promise = null;
        throw err;
      });
  }

  try {
    const conn = await cache.promise;

    // mongoose.connect can resolve while the handshake is still in flight —
    // with no server at all it resolves with readyState 0. readyState is the
    // only trustworthy signal, so wait a moment for it rather than trusting
    // the resolved promise, and only then give up.
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("MongoDB did not complete the handshake")),
          4000
        );
        const done = () => {
          clearTimeout(timer);
          resolve();
        };
        mongoose.connection.once("connected", done);
        mongoose.connection.once("error", (e) => {
          clearTimeout(timer);
          reject(e);
        });
      });
    }

    cache.conn = conn;
    cache.failedAt = 0;
    console.log(
      `MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`
    );
    return cache.conn;
  } catch (err) {
    cache.conn = null;
    cache.promise = null;
    cache.failedAt = Date.now();

    console.error(`MongoDB connection failed: ${err.message}`);
    if (!process.env.MONGO_URI) {
      console.error(
        "MONGO_URI is not set. On Vercel add it in Settings → Environment " +
          "Variables (a MongoDB Atlas connection string — localhost is not " +
          "reachable from there)."
      );
    }
    return null;
  }
}
