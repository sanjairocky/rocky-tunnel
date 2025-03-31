#!/bin/bash

SERVICE_NAME="rocky-tunnel"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"

echo "Stopping and disabling the service..."
sudo systemctl stop $SERVICE_NAME
sudo systemctl disable $SERVICE_NAME

echo "Removing service file..."
sudo rm -f $SERVICE_FILE

echo "Reloading systemd..."
sudo systemctl daemon-reload

echo "Service uninstalled successfully."
