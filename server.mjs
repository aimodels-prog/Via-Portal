import { createServer } from "node:http";
import app from "./dist/server/server.js";

const port = Number(process.env.PORT ?? 8080);
const hostname = "0.0.0.0";

const server = createServer(async (incoming, outgoing) => {
  try {
    const host = incoming.headers.host ?? `localhost:${port}`;
    const url = new URL(incoming.url ?? "/", `http://${host}`);
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
    response.headers.forEach((value, name) => {
      outgoing.setHeader(name, value);
    });

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
