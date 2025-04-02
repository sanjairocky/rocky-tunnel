const express = require("express");
const WebSocket = require("ws");
const mqtt = require("mqtt"); // Added MQTT
const http = require("http");
const { v4: uuidv4 } = require("uuid");
const compression = require("compression");
const { sendCompressed, receiveCompressed } = require("./utils");

// --- Configuration ---
const MASTER_PORT = process.env.MASTER_PORT || 8080;
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883"; // Default MQTT broker
const MQTT_AGENT_TO_MASTER_TOPIC =
  process.env.MQTT_AGENT_TO_MASTER_TOPIC || "lt-ingress/agent-to-master";
const MQTT_MASTER_TO_AGENT_TOPIC =
  process.env.MQTT_MASTER_TO_AGENT_TOPIC || "lt-ingress/master-to-agent";
const MQTT_OPTIONS = {}; // Add options like username/password if needed from env vars
if (process.env.MQTT_USERNAME)
  MQTT_OPTIONS.username = process.env.MQTT_USERNAME;
if (process.env.MQTT_PASSWORD)
  MQTT_OPTIONS.password = process.env.MQTT_PASSWORD;

const app = express();
const server = http.createServer(app);

// --- Agent Registry ---
// Stores agent info: agents[subdomain] = { transport: 'ws'|'mqtt', client: ws | null }
// For 'ws', client is the WebSocket object.
// For 'mqtt', client is null (master publishes to a shared topic).
let agents = {};
let transactions = {}; // Track HTTP request transactions waiting for agent response

// --- WebSocket Server Setup ---
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("✅ Agent connected via WebSocket");

  ws.on("message", (compressedMessage) => {
    receiveCompressed(compressedMessage, (data) => {
      // Pass WS client for context
      handleAgentMessage(data, "ws", ws);
    });
  });

  ws.on("close", () => {
    console.log("❌ Agent disconnected (WebSocket)");
    // Find subdomains associated with this specific ws client and unregister them
    const subsToUnregister = [];
    Object.keys(agents).forEach((sub) => {
      if (
        agents[sub] &&
        agents[sub].transport === "ws" &&
        agents[sub].client === ws
      ) {
        subsToUnregister.push(sub);
      }
    });
    if (subsToUnregister.length > 0) {
      handleAgentUnregistration(subsToUnregister);
    }
  });

  ws.on("error", (err) =>
    console.error(`⚠️ WebSocket Agent error: ${err.message}`)
  );

  // Optional: Implement WS keep-alive (ping/pong) from master side if needed
});

// --- MQTT Client Setup ---
console.log(`🔌 Connecting to MQTT broker at ${MQTT_BROKER_URL}...`);
const mqttClient = mqtt.connect(MQTT_BROKER_URL, MQTT_OPTIONS);

mqttClient.on("connect", () => {
  console.log("✅ Connected to MQTT broker");
  mqttClient.subscribe(MQTT_AGENT_TO_MASTER_TOPIC, (err) => {
    if (err) {
      console.error(
        `❗️ MQTT failed to subscribe to ${MQTT_AGENT_TO_MASTER_TOPIC}:`,
        err
      );
    } else {
      console.log(`👂 MQTT subscribed to ${MQTT_AGENT_TO_MASTER_TOPIC}`);
    }
  });
});

mqttClient.on("message", (topic, payload) => {
  if (topic === MQTT_AGENT_TO_MASTER_TOPIC) {
    try {
      const data = JSON.parse(payload.toString());
      // Pass null client for MQTT, as we publish to a shared topic
      handleAgentMessage(data, "mqtt", null);
    } catch (e) {
      console.error("❗️ Error parsing MQTT message:", e);
    }
  }
});

mqttClient.on("error", (err) => {
  console.error(`⚠️ MQTT Client Error: ${err.message}`);
});

mqttClient.on("close", () => {
  console.log("❌ Disconnected from MQTT broker. Will attempt to reconnect.");
  // Note: The mqtt library handles reconnection automatically by default unless disabled.
  // We might need more robust handling if the broker is down for extended periods.
  // For now, we assume agents might disconnect if the broker is down.
  // TODO: Consider explicitly unregistering MQTT agents if broker connection is lost?
});

mqttClient.on("offline", () => {
  console.log("🔌 MQTT client offline.");
});

mqttClient.on("reconnect", () => {
  console.log("🔄 MQTT client attempting to reconnect...");
});

// --- Unified Agent Message Handling ---
function handleAgentMessage(data, transport, client) {
  // client is the WebSocket object for 'ws', null for 'mqtt'
  switch (data.type) {
    case "register":
      handleAgentRegistration(data.subdomains, transport, client);
      break;
    case "unregister":
      // Unregistration message comes *from* the agent
      handleAgentUnregistration(data.subdomains);
      break;
    case "response":
      handleAgentResponse(data);
      break;
    default:
      console.warn(`❓ Received unknown message type: ${data.type}`);
  }
}

function handleAgentRegistration(subdomains, transport, client) {
  if (!subdomains || !Array.isArray(subdomains)) {
    console.error("❗️ Invalid registration format: subdomains array missing.");
    return;
  }
  subdomains.forEach((sub) => {
    if (agents[sub]) {
      console.warn(
        `⚠️ Overwriting registration for subdomain: ${sub} (Previous: ${agents[sub].transport}, New: ${transport})`
      );
    }
    agents[sub] = { transport: transport, client: client }; // Store client only for WS
    console.log(`✅ Registered subdomain: ${sub} (via ${transport})`);
  });
}

function handleAgentUnregistration(subdomains) {
  if (!subdomains || !Array.isArray(subdomains)) {
    console.error(
      "❗️ Invalid unregistration format: subdomains array missing."
    );
    return;
  }
  subdomains.forEach((sub) => {
    if (agents[sub]) {
      console.log(
        `❌ Unregistered subdomain: ${sub} (was ${agents[sub].transport})`
      );
      delete agents[sub];
    } else {
      console.warn(`❓ Attempted to unregister non-existent subdomain: ${sub}`);
    }
  });
}

function handleAgentResponse(responseData) {
  const transactionId = responseData.transactionId;
  if (transactions[transactionId]) {
    try {
      transactions[transactionId](responseData); // Execute the callback holding the HTTP response
    } catch (error) {
      console.error(
        `❗️ Error executing transaction callback for ${transactionId}:`,
        error
      );
    } finally {
      delete transactions[transactionId]; // Clean up transaction
    }
  } else {
    console.warn(
      `❓ Received response for unknown/expired transaction ID: ${transactionId}`
    );
  }
}

// --- Express Middleware & Routes ---
app.use(compression());
// Increase payload limit for potential base64 encoded bodies etc.
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request Forwarding Middleware
app.use((req, res, next) => {
  const host = req.headers["host"];
  // Simple check if it looks like a subdomain request
  if (host && host.includes(".") && !host.startsWith("localhost")) {
    // Adjust condition as needed
    const subdomain = host.split(".")[0];
    const agentInfo = agents[subdomain];

    if (!agentInfo) {
      console.log(`❓ No agent found for subdomain: ${subdomain}`);
      return res
        .status(502)
        .send(`No active agent for subdomain '${subdomain}'`);
    }

    console.log(
      `➡️ Forwarding ${req.method} request for ${host} to agent for ${subdomain} via ${agentInfo.transport}`
    );

    const transactionId = uuidv4();
    const requestPayload = {
      type: "request",
      transactionId,
      method: req.method,
      url: req.url,
      // Pass essential headers, filter out hop-by-hop headers if necessary
      headers: req.headers,
      // Read raw body if available (e.g., for file uploads) or use parsed body
      // Note: Handling raw body might require middleware like `body-parser` configured differently
      // For simplicity, using parsed req.body if available. Adjust if raw stream needed.
      body: req.body || null,
    };

    // Store the response callback
    transactions[transactionId] = (response) => {
      // Remove potential hop-by-hop headers from agent response
      const headersToSend = { ...response.headers };
      delete headersToSend["connection"];
      delete headersToSend["keep-alive"];
      // Add more headers to remove if needed

      res.set(headersToSend);
      res.status(response.status || 500).send(response.body);
    };

    // Set a timeout for the transaction
    setTimeout(() => {
      if (transactions[transactionId]) {
        console.error(
          `⏰ Timeout waiting for response from agent for transaction ${transactionId} (subdomain ${subdomain})`
        );
        delete transactions[transactionId];
        if (!res.headersSent) {
          res.status(504).send("Gateway Timeout - No response from agent");
        }
      }
    }, 30000); // 30 second timeout

    // Send request to agent based on transport
    try {
      if (agentInfo.transport === "ws") {
        if (
          agentInfo.client &&
          agentInfo.client.readyState === WebSocket.OPEN
        ) {
          sendCompressed(agentInfo.client, requestPayload);
        } else {
          console.error(
            `❗️ WebSocket client for ${subdomain} not open or missing.`
          );
          handleAgentUnregistration([subdomain]); // Clean up stale registration
          delete transactions[transactionId];
          res.status(503).send("Service Unavailable - Agent connection issue");
        }
      } else if (agentInfo.transport === "mqtt") {
        if (mqttClient.connected) {
          const payload = JSON.stringify(requestPayload);
          mqttClient.publish(MQTT_MASTER_TO_AGENT_TOPIC, payload, (err) => {
            if (err) {
              console.error("❗️ MQTT publish error:", err);
              delete transactions[transactionId];
              res
                .status(500)
                .send(
                  "Internal Server Error - Failed to forward request via MQTT"
                );
            }
          });
        } else {
          console.error(
            "❗️ Cannot forward request, MQTT client not connected to broker."
          );
          delete transactions[transactionId];
          res
            .status(503)
            .send("Service Unavailable - Master MQTT connection issue");
        }
      }
    } catch (sendError) {
      console.error(
        `❗️ Error sending request to agent for ${subdomain} via ${agentInfo.transport}:`,
        sendError
      );
      delete transactions[transactionId];
      if (!res.headersSent) {
        res
          .status(500)
          .send("Internal Server Error - Failed to forward request");
      }
    }
  } else {
    // Not a subdomain request, pass to next middleware (e.g., status check)
    next();
  }
});

// Basic status endpoint
app.get("/", (_, res) => {
  res.json({
    status: "up",
    websocket_connections: wss.clients.size,
    mqtt_connected: mqttClient.connected,
    registered_subdomains: Object.keys(agents).length,
    active_transactions: Object.keys(transactions).length,
  });
});

// --- Start Server ---
server.listen(MASTER_PORT, () =>
  console.log(
    `\n--- lt-ingress Master ---
🌐 HTTP Server listening on port ${MASTER_PORT}
🔌 WebSocket Server enabled
 M MQTT Client connecting to ${MQTT_BROKER_URL}
-------------------------\n`
  )
);

module.exports = server;
