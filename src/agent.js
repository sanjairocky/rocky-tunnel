const http = require("http");
const express = require("express");

const { receiveCompressed } = require("./utils"); // sendCompressed is handled by ManagedConnection
const apis = require("./manager");
const ManagedConnection = require("./connection"); // Import the refactored module

const port = process.env.AGENT_PORT || 3000;
const transport = process.env.AGENT_TRANSPORT || "ws"; // 'ws' or 'mqtt'
const masterHost = process.env.MASTER_HOST || "localhost"; // Default host
const wsPort = process.env.MASTER_PORT || masterHost; // Default mqtt host
const mqttPort = process.env.MQTT_PORT || 1883; // Default MQTT port
const reconnectInterval = 5000; // ManagedConnection uses this internally

// Determine URL and options based on transport
let connectionUrl;
const connectionOptions = {
  transport: transport,
  reconnectInterval: reconnectInterval,
};

if (transport === "ws") {
  connectionUrl = `ws://${masterHost}:${wsPort}`;
  console.log(`Configured for WebSocket transport: ${connectionUrl}`);
} else if (transport === "mqtt") {
  connectionUrl =
    process.env.MQTT_BROKER_URL || `mqtt://${masterHost}:${mqttPort}`;
  // Add MQTT specific options (can be overridden by env vars if needed)
  connectionOptions.mqttInboundTopic =
    process.env.MQTT_INBOUND_TOPIC || "lt-ingress/master-to-agent";
  connectionOptions.mqttOutboundTopic =
    process.env.MQTT_OUTBOUND_TOPIC || "lt-ingress/agent-to-master";
  // Add MQTT auth options if provided via environment variables
  if (process.env.MQTT_USERNAME) {
    connectionOptions.mqttOptions = connectionOptions.mqttOptions || {};
    connectionOptions.mqttOptions.username = process.env.MQTT_USERNAME;
  }
  if (process.env.MQTT_PASSWORD) {
    connectionOptions.mqttOptions = connectionOptions.mqttOptions || {};
    connectionOptions.mqttOptions.password = process.env.MQTT_PASSWORD;
  }
  console.log(`Configured for MQTT transport: ${connectionUrl}`);
  console.log(` - Inbound Topic: ${connectionOptions.mqttInboundTopic}`);
  console.log(` - Outbound Topic: ${connectionOptions.mqttOutboundTopic}`);
} else {
  throw new Error(`Unsupported AGENT_TRANSPORT: ${transport}`);
}

const app = express();

app.use(express.json());
app.use(express.static("./src/public"));
app.use(express.urlencoded({ extended: true }));
const {
  getTunnelBySubdomain,
  getTunnelSubdomains,
  registerTunnelChange,
  addBandwidth,
} = apis(app);

// Instantiate the connection manager with dynamic URL and options
const connection = new ManagedConnection(connectionUrl, connectionOptions);

// --- Event Handlers for ManagedConnection ---
// Note: The event handlers ('open', 'message', 'close', 'error')
// remain largely the same as ManagedConnection provides a consistent interface.

connection.on("open", () => {
  // Send registration message upon successful connection
  console.log("Agent sending registration on open.");
  connection.send({ type: "register", subdomains: getTunnelSubdomains() });
});

connection.on("message", (data) => {
  // Receive already parsed/decompressed data from ManagedConnection
  // No need for receiveCompressed here anymore.
  const { transactionId, method, url, headers, body } = data; // Assuming 'data' is the parsed object
  console.log(`🔄 Received ${method} request: ${url} via ${transport}`);

  const subdomain = headers.host.split(".")[0];
  // Note: Bandwidth tracking might need adjustment for MQTT if compressedMessage isn't available/relevant
  // addBandwidth(subdomain, compressedMessage); // TODO: Revisit bandwidth tracking for MQTT
  const targetServer =
    (() => {
      const config = getTunnelBySubdomain(subdomain);
      return `http://${config?.host}:${config?.port}`;
    })() || "http://localhost:3000"; // Default if tunnel not found

  const options = { method, headers };

  const proxyReq = http.request(
    `${targetServer}${url}`,
    options,
    (proxyRes) => {
      let responseBody = "";
      proxyRes.on("data", (chunk) => (responseBody += chunk));
      proxyRes.on("end", () => {
        // Use connection.send() to send the response back
        connection.send({
          type: "response",
          transactionId,
          status: proxyRes.statusCode,
          headers: proxyRes.headers,
          body: responseBody,
        });
      });
    }
  );

  if (["POST", "PUT", "PATCH"].includes(method) && body) {
    proxyReq.write(body);
  }

  proxyReq.on("error", (err) => {
    console.error(`❗️ Proxy request error for ${url}:`, err.message);
    // Use connection.send() to send the error response back
    connection.send({
      type: "response",
      transactionId,
      status: 502, // Bad Gateway is appropriate here
      body: "Proxy connection error", // Send a generic error message
    });
  });

  proxyReq.end();
}); // End of connection.on('message', ...) callback

// Handle connection close (logging/cleanup handled within ManagedConnection)
connection.on("close", () => {
  console.log("Agent notified: Connection closed.");
  // Optionally, could try sending unregister here, but ManagedConnection handles reconnects
});

// Handle errors (logging/cleanup handled within ManagedConnection)
connection.on("error", (err) => {
  console.error("Agent notified: Connection error:", err.message);
});

// --- Tunnel Change Listener ---
// Register tunnel changes to send updates via the connection
registerTunnelChange(({ type, subdomain }) => {
  console.log(`Agent sending tunnel change: ${type} - ${subdomain}`);
  connection.send({ type, subdomains: [subdomain] });
});

// --- Start Server and Connection ---
app.listen(port, () => console.log(`🖥️ Agent running on port ${port}`));

// Start the initial connection attempt
console.log("Agent initiating connection...");
connection.connect();

module.exports = app; // Export app for potential testing or other uses
