const express = require("express");
const localtunnel = require("localtunnel");
const fs = require("fs");
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static("public"));

let tunnels = {};

const tunnelsIngresses = {};

// Load tunnels from tunnels.json
try {
  const data = fs.readFileSync("./tunnels.json", "utf8");
  const tunnelData = JSON.parse(data);
  tunnels = tunnelData.tunnels.reduce((acc, tunnel) => {
    tunnel.status = "inactive";
    delete tunnel.publicUrl;
    acc[tunnel.id] = tunnel;
    return acc;
  }, {});
} catch (err) {
  console.error("Error reading or parsing tunnels.json:", err);
}

// GET /api/tunnels
app.get("/api/tunnels", (req, res) => {
  const status = req.query.status;
  let results = Object.values(tunnels);

  if (status && status !== "all") {
    results = results.filter((tunnel) => tunnel.status === status);
  }

  res.json(
    results.map((t) => {
      const t1 = tunnelsIngresses[t.id];
      return {
        ...t,
        tun: t1,
      };
    })
  );
});

// POST /api/tunnels
app.post("/api/tunnels", async (req, res) => {
  const {
    name,
    type,
    subdomain,
    host,
    port,
    authType,
    description,
    status = "inactive",
    lastUpdated = new Date().toISOString(),
  } = req.body;
  const id =
    Object.keys(tunnels).length > 0 ? Math.max(...Object.keys(tunnels)) + 1 : 1;
  const newTunnel = {
    id,
    name,
    type,
    subdomain,
    host,
    port,
    authType,
    description,
    status,
    lastUpdated,
    bandith: "0B",
  };
  tunnels[id] = newTunnel;

  // Save tunnels to tunnels.json
  saveTunnelsToFile();
  await toogleTunnel(tunnels[id]);

  res.status(201).json(newTunnel);
});

// DELETE /api/tunnels/:id
app.delete("/api/tunnels/:id", (req, res) => {
  const id = req.params.id;
  if (tunnels[id]) {
    tunnelsIngresses[id]?.tunnel?.close?.();
    delete tunnelsIngresses[id];
    delete tunnels[id];
    // Save tunnels to tunnels.json
    saveTunnelsToFile();
    res.status(204).send();
  } else {
    res.status(404).json({ message: "Tunnel not found" });
  }
});

// PATCH /api/tunnels/:id
app.patch("/api/tunnels/:id", async (req, res) => {
  const id = req.params.id;

  if (tunnels[id]) {
    let prevStatus = tunnels[id].status;
    tunnels[id] = {
      ...tunnels[id],
      ...req.body,
      lastUpdated: new Date().toISOString(),
    };
    saveTunnelsToFile();
    try {
      if (prevStatus !== tunnels[id].status) {
        await toogleTunnel(tunnels[id]);
      }
    } catch (e) {}
    res.json(tunnels[id]);
  } else {
    res.status(404).json({ message: "Tunnel not found" });
  }
});

async function toogleTunnel(tunnel) {
  try {
    if (tunnel.status === "active") {
      const lt = await localtunnel({
        port: parseInt(tunnel.port),
        local_host: tunnel.host,
        subdomain: tunnel.subdomain,
      });

      tunnel.publicUrl = lt.url;
      lt.on("url", (url) => {
        // tunnels are opened
        console.log(tunnel.id, url, "open");
      });
      lt.on("close", () => {
        // tunnels are closed
        console.log(tunnel.id, lt.url, "closed");
        tunnel.status = "inactive";
        delete tunnel.publicUrl;
        delete tunnelsIngresses[tunnel.id];
      });
      tunnelsIngresses[tunnel.id] = lt;
    } else {
      delete tunnel.publicUrl;
      if (tunnelsIngresses[tunnel.id]) {
        tunnelsIngresses[tunnel.id]?.close?.();
        delete tunnelsIngresses[tunnel.id];
      }
    }
  } catch (e) {
    console.error(`Error starting tunnel '${tunnel.name}':`, err);
  }
}

// Function to save tunnels to tunnels.json
function saveTunnelsToFile() {
  const tunnelArray = Object.values(tunnels);
  const data = JSON.stringify({ tunnels: tunnelArray }, null, 2);
  fs.writeFile("./tunnels.json", data, (err) => {
    if (err) {
      console.error("Error writing to tunnels.json:", err);
    }
  });
}

// GET /api/tunnels/metrics
app.get("/api/tunnels/metrics", (req, res) => {
  const totalTunnels = Object.keys(tunnels).length;
  const activeTunnels = Object.values(tunnels).filter(
    (tunnel) => tunnel.status === "active"
  ).length;
  const inactiveTunnels = Object.values(tunnels).filter(
    (tunnel) => tunnel.status === "inactive"
  ).length;

  res.json({
    totalTunnels,
    activeTunnels,
    inactiveTunnels,
    bandwidthUsage: addBandwidthArray(
      Object.values(tunnels).map((t) => t.bandwith || "0B")
    ).formatted,
  });
});

function parseSize(input) {
  if (typeof input === "number") return input; // Already in bytes

  const units = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
  const match = input.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)?$/i);

  if (!match) throw new Error("Invalid size format");

  const value = parseFloat(match[1]);
  const unit = match[2] ? match[2].toUpperCase() : "B";

  return value * (units[unit] || 1);
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return (
    parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i]
  );
}

function addBandwidthArray(sizes) {
  if (!Array.isArray(sizes)) throw new Error("Input must be an array");

  const totalBytes = sizes
    .filter((s) => !!s)
    .reduce((sum, size) => sum + parseSize(size), 0);

  return {
    bytes: totalBytes,
    formatted: formatBytes(totalBytes),
  };
}

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
