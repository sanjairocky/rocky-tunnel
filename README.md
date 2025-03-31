# **Rocky Tunnel is a WebSocket-based HTTP Proxy (Master & Agent in One)**

This project provides a **WebSocket-based HTTP proxy** that allows dynamic **subdomain registration and routing**. A **single server** can act as both **Master (Proxy)** and **Agent (Client)** based on args.

## **🚀 Features**

✅ **Single server can act as both Master & Agent on arg based**  
✅ **Dynamic subdomain registration/unregistration**  
✅ **HTTP proxying over WebSockets with gzip compression**  
✅ **Multi-subdomain support per Agent**  
✅ **Transaction-based request tracking**  
✅ **Self-hosted alternative to ngrok**

---

## **📂 Project Structure**

```
/src
 |-- public/           # public ui files
 ├── index.js          # Entry point
 ├── master.js         # Master (Proxy Server)
 ├── agent.js          # Agent (Client)
 ├── websocket.js      # WebSocket Helpers (Gzip)
 |-- manager.js        # subdomain manager
 ├── package.json
 ├── README.md
```

---

## **📦 Installation**

### **1️⃣ Clone the Repository**

```sh
git clone https://github.com/sanjairocky/rocky-tunnel.git
cd rocky-tunnel
```

### **2️⃣ Install Dependencies**

```sh
npm install
```

---

## **🛠️ Configuration (`config.env`)**

Modify env in `.vscode/launch.json` to set the Master URL and local servers:

```json
{
  "ENV_FILE": ".env",
  "DATA_PATH": ".",
  "MASTER_PORT": "8080",
  "AGENT_PORT": "3000",
  "MASTER_HOST": "localhost"
}
```

---

## **🚀 Running the Proxy**

### **Run as Both Master & Agent**

```sh
node src/index.js cluster
```

- Master runs on **port 8080**
- Agent listens for HTTP traffic and routes requests locally

---

## **🛠️ How It Works**

1. **Master starts on port `8080`**
2. **Agent connects via WebSocket** to `ws://localhost:8080`
3. **Agent dynamically registers/unregisters subdomains**
4. **Master stores subdomains & routes requests**
5. **Requests are sent via WebSocket (gzip compressed)**
6. **Agent forwards traffic to local servers**

---

## **📜 API Endpoints**

### **1️⃣ Incoming HTTP Requests (Master)**

```sh
curl -H "Host: api.localhost" http://localhost:8080/
```

- Master **forwards the request** to the agent handling `api.localhost`

### **2️⃣ Agent-Local Server Example**

```sh
curl -H "Host: app.localhost" http://localhost:8080/
```

- Agent forwards the request to `http://localhost:3002/`

---

## **🛠️ Debugging**

### **Check Registered Subdomains**

```sh
curl -H "Host: subdomain.localhost" http://localhost:8080/
```

- If no response, the subdomain **is not registered**.

### **Check WebSocket Connection**

```sh
netstat -an | grep 8080
```

- Ensure WebSocket connections are active.

---

## **🛑 Stopping the Proxy**

Press `CTRL + C` or:

```sh
kill $(lsof -t -i:8080)
```

---

## **📜 License**

This project is **open-source**. Feel free to modify and improve it! 🚀
