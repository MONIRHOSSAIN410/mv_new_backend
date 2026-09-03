/**
 * Catch-all Vercel function: /api/products, /api/users/register, and every
 * other API path land here with the request URL intact.
 *
 * This replaces the old vercel.json rewrite of "/(.*)" -> "/api", which threw
 * the real path away — Express only ever saw "/api", so every request came
 * back as "Not found - /api".
 */
import app from "../server.js";

export default app;
