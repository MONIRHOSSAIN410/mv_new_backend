import mongoose from "mongoose";

/**
 * One MongoDB connection, reused.
 *
 * On Vercel every request may land on a fresh serverless instance. Opening a
 * new connection each time exhausts the Atlas connection limit within minutes,
 * so the connection promise is cached on `globalThis` — a warm instance then
 * reuses the socket it already has instead of dialling again.
 */
const store = globalThis;
if (!store.__cookmeMongo) store.__cookmeMongo = { conn: null, promise: null };
const cache = store.__cookmeMongo;

export default async function connectDB() {
  if (cache.conn) return cache.conn;

  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/cookme";

  if (!cache.promise) {
    mongoose.set("strictQuery", true);
    cache.promise = mongoose
      .connect(uri, {
        // Fail fast — a serverless request should not hang for 30 seconds
        // waiting for a database that is unreachable.
        serverSelectionTimeoutMS: 5000,
        // Serverless instances are many and short-lived, so each one keeps a
        // small pool rather than the default 100.
        maxPoolSize: 5,
      })
      .catch((err) => {
        // Clear the cached promise so the next request can try again.
        cache.promise = null;
        throw err;
      });
  }

  try {
    cache.conn = await cache.promise;
    console.log(
      `MongoDB connected: ${cache.conn.connection.host}/${cache.conn.connection.name}`
    );
    return cache.conn;
  } catch (err) {
    console.error(`MongoDB connection failed: ${err.message}`);
    if (!process.env.MONGO_URI) {
      console.error(
        "MONGO_URI is not set. On Vercel add it in Settings → Environment Variables " +
          "(a MongoDB Atlas connection string — localhost is not reachable from there)."
      );
    }
    return null;
  }
}
