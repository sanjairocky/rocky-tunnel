const WebSocket = require("ws");
const mqtt = require("mqtt");
const EventEmitter = require("events");
const { sendCompressed, receiveCompressed } = require("./utils"); // Keep utils for WS compression

const DEFAULT_RECONNECT_INTERVAL = 5000;
const WS_PING_INTERVAL = 30000;

class ManagedConnection extends EventEmitter {
  constructor(url, options = {}) {
    super();
    this.url = url;
    this.transport = options.transport || "ws"; // 'ws' or 'mqtt'
    this.reconnectInterval =
      options.reconnectInterval || DEFAULT_RECONNECT_INTERVAL;
    this.mqttTopics = {
      inbound: options.mqttInboundTopic || "lt-ingress/master-to-agent", // Topic agent listens on
      outbound: options.mqttOutboundTopic || "lt-ingress/agent-to-master", // Topic agent publishes to
    };
    this.mqttOptions = options.mqttOptions || {}; // Pass through other MQTT options (e.g., username, password)

    this.client = null; // Holds either WS or MQTT client instance
    this.pingInterval = null; // Only used for WS
    this.isAlive = false; // Only used for WS
    this.shouldReconnect = true;
    this.connectionAttemptTimer = null;

    // Validate transport
    if (!["ws", "mqtt"].includes(this.transport)) {
      throw new Error(`Invalid transport specified: ${this.transport}`);
    }

    console.log(`🔌 Initializing connection with transport: ${this.transport}`);
  }

  connect() {
    this.shouldReconnect = true; // Allow reconnection attempts
    clearTimeout(this.connectionAttemptTimer); // Clear any pending reconnect timer

    if (this.isConnected()) {
      console.log("ℹ️ Already connected.");
      return;
    }

    console.log(
      `🔌 Attempting to connect to ${this.url} via ${this.transport}...`
    );

    try {
      if (this.transport === "ws") {
        this._connectWebSocket();
      } else if (this.transport === "mqtt") {
        this._connectMqtt();
      }
    } catch (error) {
      console.error(`❗️ Error initiating connection: ${error.message}`);
      this.scheduleReconnect(); // Try again later
    }
  }

  _connectWebSocket() {
    this.client = new WebSocket(this.url);

    this.client.on("open", () => {
      console.log("✅ WebSocket connection established.");
      this.isAlive = true;
      this.emit("open");
      this._startWsKeepAlive();
    });

    this.client.on("message", (compressedMessage) => {
      // Decompress and emit standard 'message' event
      receiveCompressed(compressedMessage, (data) => {
        this.emit("message", data);
      });
    });

    this.client.on("pong", () => {
      this.isAlive = true;
    });

    this.client.on("close", (code, reason) => {
      console.log(
        `❌ WebSocket connection closed. Code: ${code}, Reason: ${
          reason || "No reason given"
        }`
      );
      this._handleDisconnect();
    });

    this.client.on("error", (err) => {
      console.error("⚠️ WebSocket Error:", err.message);
      // WS errors often precede 'close'. Let 'close' handle reconnect scheduling.
      // Ensure cleanup happens if close isn't emitted immediately.
      this._stopWsKeepAlive();
      this.emit("error", err);
    });
  }

  _connectMqtt() {
    // MQTT handles reconnection internally by default, but we manage it
    // explicitly via shouldReconnect and scheduleReconnect for consistency.
    const connectOptions = {
      ...this.mqttOptions,
      reconnectPeriod: 0, // Disable automatic MQTT reconnect, we handle it
      keepalive: 60, // Default MQTT keepalive
      connectTimeout: 10000, // Add a connection timeout (10 seconds)
    };
    console.log(
      "Attempting MQTT connection with options:",
      JSON.stringify(connectOptions, null, 2)
    ); // Log options
    this.client = mqtt.connect(this.url, connectOptions);

    // --- MQTT Event Handlers ---
    this.client.on("connect", (connack) => {
      console.log(
        `MQTT 'connect' event received. Connack code: ${connack.returnCode}`
      );
      if (connack.returnCode === 0) {
        console.log("✅ MQTT connection successful.");
        this.client.subscribe(this.mqttTopics.inbound, (err) => {
          if (err) {
            console.error(
              `❗️ MQTT failed to subscribe to ${this.mqttTopics.inbound}:`,
              err
            );
            this.disconnect(); // Force disconnect and reconnect attempt
          } else {
            console.log(`👂 MQTT subscribed to ${this.mqttTopics.inbound}`);
            this.emit("open");
          }
        });
      } else {
        // https://github.com/mqttjs/MQTT.js/blob/main/lib/connack_codes.js
        console.error(
          `❗️ MQTT connection failed. Code: ${connack.returnCode}. See MQTT connack codes for details.`
        );
        // Don't explicitly schedule reconnect here, 'error' or 'close' should trigger it.
      }
    });

    // Log raw MQTT message data for debugging
    this.client.on("message", (topic, payload, packet) => {
      console.log(
        `MQTT 'message' event. Topic: ${topic}, Payload: ${payload
          .toString()
          .substring(0, 100)}...`
      ); // Log truncated payload
      if (topic === this.mqttTopics.inbound) {
        try {
          // Assume payload is JSON string, parse it
          const data = JSON.parse(payload.toString());
          this.emit("message", data);
        } catch (e) {
          console.error("❗️ Error parsing MQTT message:", e);
          console.error("Raw Payload:", payload.toString());
        }
      } else {
        console.warn(`❓ Received message on unexpected MQTT topic: ${topic}`);
      }
    });

    this.client.on("close", () => {
      console.log("MQTT 'close' event received.");
      this._handleDisconnect();
    });

    this.client.on("error", (err) => {
      console.error("MQTT 'error' event received:", err); // Log the full error object
      // Error often precedes close. Let _handleDisconnect (called by 'close') manage reconnect.
      this.emit("error", err);
    });

    this.client.on("offline", () => {
      console.log("MQTT 'offline' event received.");
      // This often precedes 'close'. Ensure reconnect logic is triggered via _handleDisconnect.
      this._handleDisconnect(); // Explicitly call here too, in case 'close' doesn't fire quickly
    });

    this.client.on("end", () => {
      // Fired when client.end() is called
      console.log("MQTT 'end' event received (client disconnected).");
      this._handleDisconnect(); // Ensure cleanup and potential reconnect scheduling
    });

    this.client.on("packetsend", (packet) => {
      // Log packets being sent (can be verbose)
      // console.log(`MQTT > Sending packet: ${packet.cmd}`);
    });

    this.client.on("packetreceive", (packet) => {
      // Log packets being received (can be verbose)
      // console.log(`MQTT < Received packet: ${packet.cmd}`);
    });
  }

  _handleDisconnect() {
    if (this.transport === "ws") {
      this._stopWsKeepAlive();
    }
    this.client = null;
    this.emit("close");
    if (this.shouldReconnect) {
      this.scheduleReconnect();
    }
  }

  disconnect() {
    console.log(`🔌 Disconnecting explicitly (${this.transport})...`);
    this.shouldReconnect = false; // Prevent automatic reconnection
    clearTimeout(this.connectionAttemptTimer); // Cancel pending reconnect

    if (this.transport === "ws") {
      this._stopWsKeepAlive();
      if (this.client) {
        this.client.close(1000, "Client initiated disconnect");
      }
    } else if (this.transport === "mqtt") {
      if (this.client) {
        // End connection gracefully, don't force, don't allow reconnect
        this.client.end(true, () => {
          console.log(" MQTT client.end() callback executed.");
        });
      }
    }
    this.client = null; // Ensure client is cleared
  }

  send(data) {
    if (!this.isConnected()) {
      console.error(
        `❗️ Cannot send message, ${this.transport} is not connected.`
      );
      return false;
    }

    try {
      if (this.transport === "ws") {
        // Use the existing compression utility for WS
        sendCompressed(this.client, data);
      } else if (this.transport === "mqtt") {
        // Publish JSON string to the outbound topic for MQTT
        const payload = JSON.stringify(data);
        this.client.publish(this.mqttTopics.outbound, payload, (err) => {
          if (err) {
            console.error("❗️ MQTT publish error:", err);
            // Consider emitting an error or attempting to handle
          }
        });
      }
      return true;
    } catch (error) {
      console.error(`❗️ Error sending message via ${this.transport}:`, error);
      return false;
    }
  }

  isConnected() {
    if (!this.client) return false;
    if (this.transport === "ws") {
      return this.client.readyState === WebSocket.OPEN;
    } else if (this.transport === "mqtt") {
      return this.client.connected;
    }
    return false;
  }

  // --- WebSocket Specific Keep-Alive ---
  _startWsKeepAlive() {
    this._stopWsKeepAlive(); // Clear existing interval first
    this.isAlive = true;

    this.pingInterval = setInterval(() => {
      if (!this.client || this.client.readyState !== WebSocket.OPEN) {
        this._stopWsKeepAlive();
        return;
      }

      if (this.isAlive === false) {
        console.warn("⚠️ No WS pong received, terminating connection.");
        this._stopWsKeepAlive();
        return this.client.terminate();
      }

      this.isAlive = false;
      this.client.ping((err) => {
        if (err) {
          console.error("❗️ Error sending WS ping:", err);
          this._stopWsKeepAlive();
          this.client.terminate();
        }
      });
    }, WS_PING_INTERVAL);
  }

  _stopWsKeepAlive() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // --- Reconnection Scheduling ---
  scheduleReconnect() {
    clearTimeout(this.connectionAttemptTimer); // Clear previous timer if any
    if (!this.shouldReconnect) {
      console.log("ℹ️ Reconnect cancelled (shouldReconnect is false).");
      return;
    }

    console.log(
      `⏱️ Scheduling reconnect in ${this.reconnectInterval / 1000} seconds...`
    );
    this.connectionAttemptTimer = setTimeout(() => {
      console.log("⏱️ Reconnect timer elapsed, attempting connection...");
      this.connect(); // Attempt to connect again
    }, this.reconnectInterval);
  }
}

module.exports = ManagedConnection;
