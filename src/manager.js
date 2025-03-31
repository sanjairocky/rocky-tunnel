module.exports = (app) => {
  const fs = require("fs");

  let tunnels = {};
  let subdomainCb = () => {};

  // Load tunnels from tunnels.json
  try {
    const data = fs.readFileSync(
      require("path").join(process.env.DATA_PATH || "", "./tunnels.json"),
      "utf8"
    );
    const tunnelData = JSON.parse(data);
    tunnels = tunnelData.tunnels.reduce((acc, tunnel) => {
      // tunnel.status = "inactive";
      tunnel.publicUrl = `http://${tunnel.subdomain}.${process.env.MASTER_HOST}:${process.env.MASTER_PORT}`;
      acc[tunnel.id] = tunnel;
      return acc;
    }, {});
  } catch (err) {
    console.error("Error reading or parsing tunnels.json:", err);
  }

  // Function to save tunnels to tunnels.json
  function saveTunnelsToFile() {
    const tunnelArray = Object.values(tunnels);
    const data = JSON.stringify({ tunnels: tunnelArray }, null, 2);
    fs.writeFile(
      require("path").join(process.env.DATA_PATH || "", "./tunnels.json"),
      data,
      { encoding: "utf8" },
      (err) => {
        if (err) {
          console.error("Error writing to tunnels.json:", err);
        }
      }
    );
  }

  function parseSize(input) {
    if (typeof input === "number") return input; // Already in bytes

    const units = {
      B: 1,
      KB: 1024,
      MB: 1024 ** 2,
      GB: 1024 ** 3,
      TB: 1024 ** 4,
    };
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

  // GET /api/tunnels
  app.get("/api/tunnels", (req, res) => {
    const status = req.query.status;
    let results = Object.values(tunnels);

    if (status && status !== "all") {
      results = results.filter((tunnel) => tunnel.status === status);
    }

    res.json(results);
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
      Object.keys(tunnels).length > 0
        ? Math.max(...Object.keys(tunnels)) + 1
        : 1;
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
      bandwith: "0B",
      publicUrl: `http://${subdomain}.${process.env.MASTER_HOST}:${process.env.MASTER_PORT}`,
    };
    tunnels[id] = newTunnel;

    // Save tunnels to tunnels.json
    saveTunnelsToFile();
    // await toogleTunnel(tunnels[id]);

    res.status(201).json(newTunnel);
  });

  // DELETE /api/tunnels/:id
  app.delete("/api/tunnels/:id", (req, res) => {
    const id = req.params.id;
    if (tunnels[id]) {
      // tunnelsIngresses[id]?.tunnel?.close?.();
      // delete tunnelsIngresses[id];
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
          // await toogleTunnel(tunnels[id]);
          subdomainCb({
            type: tunnels[id].status === "active" ? "register" : "unregister",
            subdomain: tunnels[id].subdomain,
          });
        }
      } catch (e) {}
      res.json(tunnels[id]);
    } else {
      res.status(404).json({ message: "Tunnel not found" });
    }
  });

  function addWithSuffix(a, b) {
    const numA = parseInt(a);
    const numB = parseInt(b);
    return numA + numB + "B";
  }
  return {
    getTunnelSubdomains: () => {
      return Object.values(tunnels)
        .filter((t) => t.status === "active")
        .map((t) => t.subdomain);
    },
    getTunnelBySubdomain: (subdomain) => {
      if (!subdomain) return;
      return Object.values(tunnels).find((t) => t.subdomain === subdomain);
    },
    registerTunnelChange: (cb) => {
      subdomainCb = cb;
    },
    addBandwidth: (subdomain, data) => {
      let size = Buffer.byteLength(data, "utf8");
      let tunnel = Object.values(tunnels).find(
        (t) => t.subdomain === subdomain
      );
      tunnel.bandwith = addWithSuffix(tunnel.bandwith || "0B", `${size}B`);
      saveTunnelsToFile();
    },
  };
};
