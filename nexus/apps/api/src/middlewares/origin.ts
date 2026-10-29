import cors from "cors";
import type { RequestHandler } from "express";

export function originPolicy(): RequestHandler {
  return (req, res, next) => {
    const allowed = new Set(
      (
        process.env.FRONTEND_ORIGINS ??
        "http://localhost:5173,http://127.0.0.1:5173"
      )
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );
    const origin = req.headers.origin;
    // Non-browser clients still need a valid JWT and database authorization.
    if (origin && !allowed.has(origin)) {
      res.status(403).json({ error: "Origem não autorizada." });
      return;
    }
    cors({
      origin: origin || false,
      methods: ["GET", "POST", "PATCH", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type"],
      exposedHeaders: ["Content-Disposition", "Retry-After"],
      credentials: false,
      maxAge: 600,
    })(req, res, next);
  };
}
