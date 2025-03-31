function TunnelStats() {
  const [tunnelsMetrics, setTunnelsMetrics] = React.useState({
    totalTunnels: 0,
    activeTunnels: 0,
    inactiveTunnels: 0,
    bandwidthUsage: "0 Bytes",
  });
  React.useEffect(() => {
    const fetchTunnelsMetrics = async () => {
      try {
        const response = await fetch("/api/tunnels/metrics");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setTunnelsMetrics(data);
      } catch (error) {
        console.error("Could not fetch tunnel metrics:", error);
        showAlert("Failed to load tunnel metrics.", "error");
      }
    };

    fetchTunnelsMetrics();
  }, []);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatCard
        title="Total Tunnels"
        value={tunnelsMetrics.totalTunnels}
        description="From all environments"
        icon="fa-server"
      />

      <StatCard
        title="Active Tunnels"
        value={tunnelsMetrics.activeTunnels}
        description="Currently running"
        icon="fa-bolt"
      />

      <StatCard
        title="Inactive Tunnels"
        value={tunnelsMetrics.inactiveTunnels}
        description="Not currently active"
        icon="fa-power-off"
      />

      <StatCard
        title="Bandwidth Usage"
        value={tunnelsMetrics.bandwidthUsage}
        description="This month's usage"
        icon="fa-tachometer-alt"
      />
    </div>
  );
}
