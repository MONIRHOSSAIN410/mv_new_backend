/**
 * Vercel entry point.
 *
 * Vercel turns every file under /api into a serverless function. This one
 * simply hands the request to the Express app in server.js, and vercel.json
 * routes *all* paths here so Express keeps doing its own routing.
 */
import app from "../server.js";

export default app;
