const WebSocket = require("ws");
const http = require("http");
const express = require("express");

const { sendCompressed, receiveCompressed } = require("./websocket");
const apis = require("./manager");

const port = process.env.AGENT_PORT || 3000;
const reconnectInterval = 5000; // milliseconds

const app = express();

app.use(express.json());
app.use(express.static("./src/public"));
app.use(express.urlencoded({ extended: true }));
const { getTunnelBySubdomain, getTunnelSubdomains, registerTunnelChange } =
  apis(app);

const connect = () => {
  const ws = new WebSocket(
    `ws://${process.env.MASTER_HOST}:${process.env.MASTER_PORT}`
  );

  ws.on("open", () => {
    console.log("✅ Connected to Master");
    sendCompressed(ws, { type: "register", subdomains: getTunnelSubdomains() });
  });

  registerTunnelChange(({ type, subdomain }) => {
    sendCompressed(ws, { type, subdomains: [subdomain] });
  });

  ws.on("message", (compressedMessage) => {
    receiveCompressed(compressedMessage, (request) => {
      const { transactionId, method, url, headers, body } = request;
      console.log(`🔄 Received ${method} request: ${url}`);

      const subdomain = headers.host.split(".")[0];
      const targetServer =
        (() => {
          const config = getTunnelBySubdomain(subdomain);
          return `http://${config?.host}:${config?.port}`;
        })() || "http://localhost:3000";

      const options = { method, headers };

      const proxyReq = http.request(
        `${targetServer}${url}`,
        options,
        (proxyRes) => {
          let responseBody = "";
          proxyRes.on("data", (chunk) => (responseBody += chunk));
          proxyRes.on("end", () => {
            sendCompressed(ws, {
              type: "response",
              transactionId,
              status: proxyRes.statusCode,
              headers: proxyRes.headers,
              body: responseBody,
            });
          });
        }
      );

      if (["POST", "PUT", "PATCH"].includes(method) && body)
        proxyReq.write(body);

      proxyReq.on("error", () => {
        sendCompressed(ws, {
          type: "response",
          transactionId,
          status: 500,
          body: "Error",
        });
      });

      proxyReq.end();
    });
  });

  ws.on("close", () => {
    console.log("❌ Disconnected from Master");
    sendCompressed(ws, {
      type: "unregister",
      subdomains: getTunnelSubdomains(),
    });
    console.log(
      `Attempting to reconnect in ${reconnectInterval / 1000} seconds...`
    );
    setTimeout(connect, reconnectInterval);
  });

  ws.on("error", (err) => {
    console.error("⚠️ WebSocket Error:", err.message);
    console.log(
      `Attempting to reconnect in ${reconnectInterval / 1000} seconds...`
    );
    setTimeout(connect, reconnectInterval);
  });
};

connect();

app.listen(port, () => console.log(`🖥️ Agent running on port ${port}`));

module.exports = app;
