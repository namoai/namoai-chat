import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://localhost:3000",
  "https://127.0.0.1:3000",
  "https://namos-chat.netlify.app",
  "https://namos-chat-v1.netlify.app",
]
  .filter(Boolean)
  .map((origin) => origin.toLowerCase());

const envAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...envAllowedOrigins]));

const ALLOWED_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization, X-Requested-With, Accept, apikey";
const EXPOSED_HEADERS = "Content-Length, Content-Type";
const MAX_AGE = "86400"; // 24h

const isAllowedOrigin = (origin: string | null): string | null => {
  if (!origin) return null;
  const normalized = origin.toLowerCase();
  return allowedOrigins.includes(normalized) ? origin : null;
};

export const applyCorsHeaders = (response: NextResponse, request: NextRequest): NextResponse => {
  const origin = request.headers.get("origin");
  const allowedOrigin = isAllowedOrigin(origin);

  if (allowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    response.headers.append("Vary", "Origin");
  }

  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
  response.headers.set(
    "Access-Control-Allow-Headers",
    request.headers.get("Access-Control-Request-Headers") || ALLOWED_HEADERS
  );
  response.headers.set("Access-Control-Expose-Headers", EXPOSED_HEADERS);
  response.headers.set("Access-Control-Max-Age", MAX_AGE);

  return response;
};

export const handlePreflight = (request: NextRequest): NextResponse => {
  const origin = request.headers.get("origin");
  const allowedOrigin = isAllowedOrigin(origin);

  if (!allowedOrigin) {
    return new NextResponse(null, { status: 403 });
  }

  const response = new NextResponse(null, { status: 204 });
  return applyCorsHeaders(response, request);
};

export const isApiRoute = (pathname: string) => pathname.startsWith("/api");


