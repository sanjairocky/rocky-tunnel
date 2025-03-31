#!/bin/bash

SERVICE_NAME="rocky-tunnel"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
APP_DIR="/home/sanjai/rocky-tunnel"
NODE_PATH=$(which node)

echo "Creating systemd service file..."
cat <<EOF | sudo tee $SERVICE_FILE > /dev/null
[Unit]
Description=My Node.js App
After=network.target

[Service]
ExecStart=$NODE_PATH $APP_DIR/src/index.js master
Restart=always
User=sanjai
Group=nogroup
Environment=NODE_ENV=production
WorkingDirectory=$APP_DIR

[Install]
WantedBy=multi-user.target
EOF

echo "Reloading systemd..."
sudo systemctl daemon-reload

echo "Enabling and starting the service..."
sudo systemctl enable $SERVICE_NAME
sudo systemctl start $SERVICE_NAME

echo "Service installed successfully."
