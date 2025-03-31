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

    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i];
}

const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

function addBandwidthArray(sizes) {
    if (!Array.isArray(sizes)) throw new Error("Input must be an array");

    const totalBytes = sizes.filter(s=> !!s).reduce((sum, size) => sum + parseSize(size), 0);

    return {
        bytes: totalBytes,
        formatted: formatBytes(totalBytes),
    };
}