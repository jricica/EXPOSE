#!/bin/bash

# Health check script for Social Media API
# Usage: ./check-deployment.sh

API_URL="http://localhost:3000"
SERVICE_NAME="social-media-api"

echo "🔍 Checking Digital Ocean API Deployment..."
echo ""

# 1. Check systemd service
echo "1️⃣ Service Status:"
sudo systemctl status $SERVICE_NAME --no-pager | head -10
echo ""

# 2. Check if API is responding
echo "2️⃣ API Health Check:"
if curl -s "$API_URL/api/health" > /dev/null 2>&1; then
  echo "✅ API is responding"
else
  echo "❌ API is not responding"
fi
echo ""

# 3. Check database connection
echo "3️⃣ Database Connection:"
if sudo systemctl status $SERVICE_NAME --no-pager | grep -q "active (running)"; then
  echo "✅ Service is running"
  
  # Optional: Check logs for DB errors
  if sudo journalctl -u $SERVICE_NAME -n 5 | grep -i "error\|connected"; then
    echo "⚠️ Check logs above for details"
  else
    echo "✅ No recent errors in logs"
  fi
else
  echo "❌ Service is not running"
fi
echo ""

# 4. Check disk space
echo "4️⃣ Disk Space:"
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}')
echo "Disk usage: $DISK_USAGE"
if [ "${DISK_USAGE%\%}" -gt 80 ]; then
  echo "⚠️ Warning: Disk usage is above 80%"
fi
echo ""

# 5. Check memory usage
echo "5️⃣ Memory Usage:"
MEM_USAGE=$(free -h | awk 'NR==2 {print $3 " / " $2}')
echo "Memory: $MEM_USAGE"
echo ""

echo "✅ Health check complete!"
