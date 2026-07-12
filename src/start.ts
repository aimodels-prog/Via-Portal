import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import {
  getPortalSession,
  handleAuthRoute,
  isAuthRoute,
  renderSignInPage,
} from "./lib/google-auth";

const authMiddleware = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);

  if (isAuthRoute(url.pathname)) {
    return await handleAuthRoute(request);
  }

  if (isProtectedPortalRequest(request) && !getPortalSession(request)) {
    return renderSignInPage(request);
  }

  return next();
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, authMiddleware],
}));

function isProtectedPortalRequest(request: Request) {
  const url = new URL(request.url);
  if (request.method !== "GET") return false;
  if (url.pathname === "/favicon.svg") return false;
  if (url.pathname.startsWith("/assets/")) return false;
  if (url.pathname.startsWith("/@")) return false;
  if (url.pathname.startsWith("/__")) return false;
  if (url.pathname.includes(".")) return false;

  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html") || accept === "*/*";
}
