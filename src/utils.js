const zlib = require("zlib");

function sendCompressed(ws, data) {
  zlib.gzip(JSON.stringify(data), (err, compressed) => {
    if (!err && ws.readyState === ws.OPEN) ws.send(compressed);
  });
}

function receiveCompressed(compressedMessage, callback) {
  zlib.gunzip(compressedMessage, (err, message) => {
    if (!err) callback(JSON.parse(message.toString()));
  });
}

module.exports = { sendCompressed, receiveCompressed };
