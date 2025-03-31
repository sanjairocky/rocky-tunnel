function Pagination({
  tunnelsPerPage,
  totalPages,
  paginate,
  currentPageSize = tunnelsPerPage,
  currentPage = 1,
}) {
  const pageNumbers = [];

  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
      <div className="flex-1 flex justify-between sm:hidden">
        <a
          href="#"
          className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          Previous
        </a>
        <a
          href="#"
          className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          Next
        </a>
      </div>
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Showing{" "}
            <span className="font-medium">
              {(currentPage - 1) * tunnelsPerPage + 1}
            </span>{" "}
            to{" "}
            <span className="font-medium">
              {(currentPage - 1) * tunnelsPerPage + currentPageSize}
            </span>{" "}
            of{" "}
            <span className="font-medium">
              {currentPage !== totalPages
                ? totalPages * tunnelsPerPage
                : (currentPage - 1) * tunnelsPerPage + currentPageSize}
            </span>{" "}
            results
          </p>
        </div>
        <div>
          <nav
            className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
            aria-label="Pagination"
          >
            <a
              onClick={() => currentPage - 1 > 0 && paginate(currentPage - 1)}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              <span className="sr-only">Previous</span>
              <i className="fas fa-chevron-left"></i>
            </a>
            {pageNumbers.map((number) => (
              <a
                key={number}
                onClick={() => paginate(number)}
                {...(currentPage === number
                  ? {
                      "aria-current": "page",
                      className:
                        "z-10 bg-indigo-50 border-indigo-500 text-indigo-600 relative inline-flex items-center px-4 py-2 border text-sm font-medium",
                    }
                  : {
                      className:
                        "bg-white border-gray-300 text-gray-500 hover:bg-gray-50 relative inline-flex items-center px-4 py-2 border text-sm font-medium",
                    })}
              >
                {number}
              </a>
            ))}
            <a
              onClick={() =>
                currentPage + 1 <= totalPages && paginate(currentPage + 1)
              }
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              <span className="sr-only">Next</span>
              <i className="fas fa-chevron-right"></i>
            </a>
          </nav>
        </div>
      </div>
    </div>
  );
}
