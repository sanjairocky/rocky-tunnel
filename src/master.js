const express = require("express");
const WebSocket = require("ws");
const http = require("http");
const { v4: uuidv4 } = require("uuid");
const compression = require("compression");
const { sendCompressed, receiveCompressed } = require("./websocket");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let agents = {}; // Map subdomains to WebSocket clients
let transactions = {}; // Track transactions

wss.on("connection", (ws) => {
  console.log("✅ Agent connected");

  ws.on("message", (compressedMessage) => {
    receiveCompressed(compressedMessage, (data) => {
      if (data.type === "register") {
        data.subdomains.forEach((sub) => (agents[sub] = ws));
        console.log(`✅ Registered subdomains: ${data.subdomains.join(", ")}`);
        sendCompressed(ws, {
          type: "url",
          subdomains: data.subdomains?.map((sd) => ({
            subdomain: sd,
            publicUrl: `http://${sd}.${process.env.MASTER_HOST}:${process.env.MASTER_PORT}`,
          })),
        });
      } else if (data.type === "unregister") {
        data.subdomains.forEach((sub) => delete agents[sub]);
        console.log(
          `❌ Unregistered subdomains: ${data.subdomains.join(", ")}`
        );
      } else if (data.type === "response") {
        if (transactions[data.transactionId]) {
          transactions[data.transactionId](data);
          delete transactions[data.transactionId];
        }
      }
    });
  });

  ws.on("close", () => {
    console.log("❌ Agent disconnected");
    Object.keys(agents).forEach((sub) => {
      if (agents[sub] === ws) delete agents[sub];
    });
  });

  ws.on("error", (err) => console.error(`⚠️ Agent error: ${err.message}`));
});

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const host = req.headers["host"];
  if (host.split(".").length > 1) {
    const subdomain = host.split(".")[0];

    if (!agents[subdomain]) {
      return res.status(502).send("No agent available for this subdomain");
    }

    console.log(`➡️ Forwarding ${req.method} request to ${subdomain}`);

    const ws = agents[subdomain];
    const transactionId = uuidv4();

    const requestPayload = {
      type: "request",
      transactionId,
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body || null,
    };

    transactions[transactionId] = (response) => {
      res.set(response.headers);
      res.status(response.status).send(response.body);
    };

    sendCompressed(ws, requestPayload);
  } else {
    next();
  }
});

app.get("/", (_, res) => {
  res.json({ status: "up" });
});

server.listen(process.env.MASTER_PORT, () =>
  console.log(`🌐 Master running on port ${process.env.MASTER_PORT}`)
);

module.exports = server;
