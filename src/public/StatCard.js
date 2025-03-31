
function StatCard({ title, value, description, icon }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
          <i className={`fas ${icon}`}></i>
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <div className="mt-2 text-xs text-gray-500">{description}</div>
    </div>
  );
}

