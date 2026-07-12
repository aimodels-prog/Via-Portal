import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import app from "./dist/server/server.js";

const port = Number(process.env.PORT ?? 8080);
const hostname = "0.0.0.0";
const clientRoot = resolve(process.cwd(), "dist", "client");

const server = createServer(async (incoming, outgoing) => {
  try {
    if (incoming.url === "/health") {
      outgoing.statusCode = 200;
      outgoing.setHeader("content-type", "text/plain; charset=utf-8");
      outgoing.end("ok");
      return;
    }

    const host = incoming.headers.host ?? `localhost:${port}`;
    const forwardedProtocol = incoming.headers["x-forwarded-proto"];
    const protocol = Array.isArray(forwardedProtocol)
      ? forwardedProtocol[0]
      : forwardedProtocol || "http";
    const url = new URL(incoming.url ?? "/", `${protocol}://${host}`);

    if (incoming.method === "GET" || incoming.method === "HEAD") {
      const served = serveStaticAsset(url.pathname, outgoing);
      if (served) return;
    }

    const headers = new Headers();

    for (const [name, value] of Object.entries(incoming.headers)) {
      if (Array.isArray(value)) {
        for (const item of value) headers.append(name, item);
      } else if (value != null) {
        headers.set(name, value);
      }
    }

    const request = new Request(url, {
      method: incoming.method,
      headers,
      body: incoming.method === "GET" || incoming.method === "HEAD" ? undefined : incoming,
      duplex: "half",
    });

    const response = await app.fetch(request, {}, {});

    outgoing.statusCode = response.status;
    outgoing.statusMessage = response.statusText;
    const setCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];

    response.headers.forEach((value, name) => {
      if (name.toLowerCase() !== "set-cookie") {
        outgoing.setHeader(name, value);
      }
    });

    if (setCookies.length > 0) {
      outgoing.setHeader("set-cookie", setCookies);
    } else {
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) {
        outgoing.setHeader("set-cookie", splitCombinedSetCookie(setCookie));
      }
    }

    if (response.body) {
      for await (const chunk of response.body) {
        outgoing.write(chunk);
      }
    }
    outgoing.end();
  } catch (error) {
    console.error(error);
    outgoing.statusCode = 500;
    outgoing.setHeader("content-type", "text/plain; charset=utf-8");
    outgoing.end("Internal Server Error");
  }
});

server.listen(port, hostname, () => {
  console.log(`VIA Portal listening on http://${hostname}:${port}`);
});

function serveStaticAsset(pathname, outgoing) {
  if (
    pathname !== "/favicon.svg" &&
    pathname !== "/via-logo.png" &&
    !pathname.startsWith("/assets/")
  ) {
    return false;
  }

  const relativePath = normalize(pathname.replace(/^\/+/, ""));
  const filePath = resolve(join(clientRoot, relativePath));

  if (!filePath.startsWith(clientRoot) || !existsSync(filePath)) {
    return false;
  }

  outgoing.statusCode = 200;
  outgoing.setHeader("content-type", getContentType(filePath));
  outgoing.setHeader("cache-control", pathname.startsWith("/assets/")
    ? "public, max-age=31536000, immutable"
    : "public, max-age=3600");
  createReadStream(filePath).pipe(outgoing);
  return true;
}

function getContentType(filePath) {
  switch (extname(filePath)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

function splitCombinedSetCookie(value) {
  return value.split(/,(?=\s*[^;,]+=)/g).map((cookie) => cookie.trim());
}
