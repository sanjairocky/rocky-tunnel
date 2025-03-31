function TunnelManager() {
  const [tunnels, setTunnels] = React.useState([]);
  const [filteredTunnels, setFilteredTunnels] = React.useState([]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [currentTunnel, setCurrentTunnel] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [alert, setAlert] = React.useState(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const tunnelsPerPage = 5;

  React.useEffect(() => {
    const fetchTunnels = async () => {
      try {
        let url = `/api/tunnels?page=${currentPage}`;
        if (statusFilter !== "all") {
          url += `&status=${statusFilter}`;
        }
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setTunnels(data);
        setFilteredTunnels(data);
      } catch (error) {
        console.error("Could not fetch tunnels:", error);
        showAlert("Failed to load tunnels.", "error");
      }
    };

    fetchTunnels();
  }, [statusFilter, currentPage]);

  React.useEffect(() => {
    let results = [...tunnels];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      results = results.filter(
        (t) =>
          t.name.toLowerCase().includes(term) ||
          t.source.toLowerCase().includes(term) ||
          t.destination.toLowerCase().includes(term) ||
          t.type.toLowerCase().includes(term)
      );
    }

    setFilteredTunnels(results);
  }, [searchTerm, tunnels]);

  const paginate = (pageNumber) =>
    pageNumber !== currentPage && setCurrentPage(pageNumber);

  const pageNumbers = [];
  for (
    let i = 1;
    i <= Math.ceil(filteredTunnels.length / tunnelsPerPage);
    i++
  ) {
    pageNumbers.push(i);
  }

  const openCreateModal = () => {
    setIsEditing(false);
    setCurrentTunnel(null);
    setModalOpen(true);
  };

  const openEditModal = (id) => {
    const tunnel = tunnels.find((t) => t.id === id);
    if (tunnel) {
      setIsEditing(true);
      setCurrentTunnel(tunnel);
      setModalOpen(true);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setIsEditing(false);
    setCurrentTunnel(null);
  };

  const showAlert = (message, type) => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 3000);
  };

  const saveTunnel = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const tunnelData = Object.fromEntries(formData.entries());
    tunnelData.status = tunnelData.status === "on" ? "active" : "inactive";

    setLoading(true);

    try {
      const response = await fetch(
        `/api/tunnels${isEditing ? `/${currentTunnel.id}` : ""}`,
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(tunnelData),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const newTunnel = await response.json();
      const ts = [...tunnels];
      if (isEditing) {
        ts[ts.findIndex((t) => t.id === currentTunnel.id)] = newTunnel;
      } else {
        ts.push(newTunnel);
      }
      setTunnels(ts);
      showAlert("Tunnel created successfully!", "success");
    } catch (error) {
      console.error("Could not create tunnel:", error);
      showAlert("Failed to create tunnel.", "error");
    } finally {
      setLoading(false);
      closeModal();
    }
  };

  const deleteTunnel = async (id) => {
    if (window.confirm("Are you sure you want to delete this tunnel?")) {
      try {
        const response = await fetch(`/api/tunnels/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        setTunnels(tunnels.filter((t) => t.id !== id));
        showAlert("Tunnel deleted successfully!", "info");
      } catch (error) {
        console.error("Could not delete tunnel:", error);
        showAlert("Failed to delete tunnel.", "error");
      }
    }
  };

  const toggleStatus = async (id) => {
    try {
      const tunnelToUpdate = tunnels.find((t) => t.id === id);
      if (!tunnelToUpdate) {
        showAlert("Tunnel not found!", "error");
        return;
      }
      const newStatus =
        tunnelToUpdate.status === "active" ? "inactive" : "active";

      const response = await fetch(`/api/tunnels/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setTunnels(
        tunnels.map((t) =>
          t.id === id
            ? { ...t, status: newStatus, lastUpdated: new Date().toISOString() }
            : t
        )
      );
      showAlert("Tunnel status updated!", "info");
    } catch (error) {
      console.error("Could not update tunnel status:", error);
      showAlert("Failed to update tunnel status.", "error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Alert Message */}
      {alert && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-md text-white font-medium ${
            alert.type === "success" ? "bg-green-500" : "bg-blue-500"
          }`}
          onClick={() => setAlert(null)}
        >
          <div className="flex items-center gap-2">
            <i
              className={`fas ${
                alert.type === "success" ? "fa-check-circle" : "fa-info-circle"
              }`}
            ></i>
            <span>{alert.message}</span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-100 text-indigo-600">
              <i className="fas fa-network-wired text-2xl"></i>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Tunnel Manager
              </h1>
              <p className="text-gray-500">Manage your network connections</p>
            </div>
          </div>
          <button
            className="btn btn-primary self-start md:self-center"
            onClick={openCreateModal}
          >
            <i className="fas fa-plus"></i> Create Tunnel
          </button>
        </div>
        {<TunnelStats />}

        {/* Main Content */}
        <div className="card">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">
                  Tunnel Connections
                </h2>
                <p className="text-sm text-gray-500">
                  Manage all your network tunnels in one place
                </p>
              </div>
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Search tunnels..."
                  className="form-input flex-grow"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select
                  className="form-input w-full md:w-auto"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          <Tunnels
            openCreateModal={openCreateModal}
            toggleStatus={toggleStatus}
            openEditModal={openEditModal}
            deleteTunnel={deleteTunnel}
            tunnels={filteredTunnels}
          />

          <Pagination
            currentPage={currentPage}
            tunnelsPerPage={tunnelsPerPage}
            totalPages={1}
            currentPageSize={filteredTunnels.length}
            paginate={paginate}
          />
        </div>
      </div>

      {/* Tunnel Modal */}
      {modalOpen && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity"
              onClick={closeModal}
            >
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">
              &#8203;
            </span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-6 py-5 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {isEditing ? "Edit Tunnel" : "Create New Tunnel"}
                  </h3>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50">
                <form onSubmit={saveTunnel}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="col-span-2 md:col-span-1">
                      <label
                        htmlFor="name"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Tunnel Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        defaultValue={currentTunnel?.name || ""}
                        className="form-input"
                        required
                      />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label
                        htmlFor="type"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Tunnel Type *
                      </label>
                      <select
                        id="type"
                        name="type"
                        defaultValue={currentTunnel?.type || ""}
                        className="form-input"
                        required
                      >
                        <option value="">Select type</option>
                        <option value="ssh">SSH</option>
                        <option value="vpn">VPN</option>
                        <option value="http">HTTP</option>
                        <option value="https">HTTPS</option>
                        <option value="websocket">WebSocket</option>
                      </select>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label
                        htmlFor="subdomain"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        subdomain *
                      </label>
                      <input
                        type="text"
                        id="subdomain"
                        name="subdomain"
                        defaultValue={currentTunnel?.subdomain || ""}
                        className="form-input"
                        required
                      />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label
                        htmlFor="host"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        host Address *
                      </label>
                      <input
                        type="text"
                        id="host"
                        name="host"
                        defaultValue={currentTunnel?.host || ""}
                        className="form-input"
                        required
                      />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label
                        htmlFor="port"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Port *
                      </label>
                      <input
                        type="number"
                        id="port"
                        name="port"
                        defaultValue={currentTunnel?.port || ""}
                        className="form-input"
                        required
                        min="1"
                        max="65535"
                      />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label
                        htmlFor="authType"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Authentication Type
                      </label>
                      <select
                        id="authType"
                        name="authType"
                        defaultValue={currentTunnel?.authType || "password"}
                        className="form-input"
                      >
                        <option value="password">Password</option>
                        <option value="key">Key-based</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label
                        htmlFor="description"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Description
                      </label>
                      <textarea
                        id="description"
                        name="description"
                        rows="3"
                        defaultValue={currentTunnel?.description || ""}
                        className="form-input"
                      ></textarea>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <div className="mt-1">
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            name="status"
                            defaultChecked={currentTunnel?.status === "active"}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            Active
                          </span>
                        </label>
                      </div>
                    </div>
                    {currentTunnel?.id && (
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Last Updated
                        </label>
                        <div className="mt-1 text-sm text-gray-900">
                          {currentTunnel?.id
                            ? formatDate(currentTunnel.lastUpdated)
                            : "N/A"}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="btn btn-outline mr-2"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={loading}
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <div className="loading-spinner"></div>
                          Processing...
                        </div>
                      ) : isEditing ? (
                        "Update Tunnel"
                      ) : (
                        "Create Tunnel"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<TunnelManager />);
