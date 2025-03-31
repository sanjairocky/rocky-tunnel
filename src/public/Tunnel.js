const tunnelIconMap = {
  ssh: "fa-terminal",
  vpn: "fa-shield-alt",
  http: "fa-globe",
  https: "fa-lock",
  websocket: "fa-signal",
};

const getBadgeClass = (type) => {
  switch (type) {
    case "ssh":
      return "badge-yellow";
    case "vpn":
      return "badge-purple";
    case "http":
      return "badge-green";
    case "https":
      return "badge-green";
    case "websocket":
      return "badge-blue";
    default:
      return "badge-blue";
  }
};

function Tunnel({ tunnel, toggleStatus, deleteTunnel, openEditModal }) {
  return (
    <tr key={tunnel.id} className="table-row-hover">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <i
              className={`fas ${
                tunnelIconMap[tunnel.type] || "fa-network-wired"
              }`}
            ></i>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">
              {tunnel.name}
            </div>
            <div className="text-xs text-gray-500">Port: {tunnel.port}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`type-badge ${getBadgeClass(tunnel.type)}`}>
          {tunnel.type.toUpperCase()}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <a href={tunnel.publicUrl}>
          <div className="text-sm text-gray-900">{tunnel.subdomain}</div>
          <div className="text-xs text-gray-500">
            <i className="fas fa-long-arrow-alt-right"></i> {tunnel.host}
          </div>
        </a>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {tunnel?.bandwith && formatBytes(parseSize(tunnel.bandwith))}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span
            className={`status-badge ${
              tunnel.status === "active" ? "status-active" : "status-inactive"
            }`}
          >
            {tunnel.status}
          </span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={tunnel.status === "active"}
              onChange={() => toggleStatus(tunnel.id)}
            />
            <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-200 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(tunnel.lastUpdated)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEditModal(tunnel.id)}
            className="text-indigo-600 hover:text-indigo-900"
            title="Edit"
          >
            <i className="fas fa-edit"></i>
          </button>
          <button
            onClick={() => deleteTunnel(tunnel.id)}
            className="text-red-600 hover:text-red-900"
            title="Delete"
          >
            <i className="fas fa-trash"></i>
          </button>
          <button
            className="text-gray-600 hover:text-gray-900"
            title="View logs"
          >
            <i className="fas fa-file-alt"></i>
          </button>
        </div>
      </td>
    </tr>
  );
}

function Tunnels({
  toggleStatus,
  deleteTunnel,
  openEditModal,
  openCreateModal,
  tunnels = [],
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Name
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Type
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Connection
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Bandwidth
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Status
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Last Updated
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {tunnels.length > 0 ? (
            tunnels.map((tunnel) => (
              <Tunnel
                tunnel={tunnel}
                toggleStatus={toggleStatus}
                openEditModal={openEditModal}
                deleteTunnel={deleteTunnel}
              />
            ))
          ) : (
            <tr>
              <td colSpan="6" className="px-6 py-12 text-center">
                <div className="flex flex-col items-center justify-center text-gray-400 gap-2">
                  <i className="fas fa-inbox text-4xl"></i>
                  <p className="text-lg font-medium">No tunnels found</p>
                  <p className="text-sm">
                    Try adjusting your search or create a new tunnel
                  </p>
                  <button
                    className="btn btn-primary mt-4"
                    onClick={openCreateModal}
                  >
                    <i className="fas fa-plus"></i> Create Tunnel
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
