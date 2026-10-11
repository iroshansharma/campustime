#!/usr/bin/env bash
# ==============================================================================
# CampusTime — Render Deployment Build Script
# Executes dependency installation, static collection, and database migrations.
# ==============================================================================
set -o errexit

echo ">>> [1/3] Installing Python dependencies..."
python -m pip install --upgrade pip
pip install -r requirements.txt

echo ">>> [2/3] Collecting static files with WhiteNoise..."
python manage.py collectstatic --no-input

echo ">>> [3/3] Running database migrations..."
python manage.py migrate --no-input

echo ">>> CampusTime build completed successfully!"
