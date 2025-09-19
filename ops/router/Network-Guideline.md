# Small Goods Competition App Setup Guide

## A. First Time Setup (For New Host Computer)
### 1. Initial Connection
1. Connect the OpenWrt router to power
2. Connect to WiFi network:
   - SSID: `SG-Competition-WiFi`
   - Password: `SG-PASSWORD`
3. Test router connection:
   ```bash
   ping 192.168.8.1
   ```

### 2. One-Time Application Setup
```bash
# Clone the repository
git clone https://github.com/cits5206Group9/SmallGoods-Competition-app.git
cd SmallGoods-Competition-app

# Set up Python environment (only needed once)
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Initialize database (only needed once)
flask db upgrade
```

### 3. Configure Router DNS (Required for New Host Computer)
```bash
# If you editted .env_network file, run command below.
scp ops/router/.env_network root@192.168.8.1:/root/.env_network # OPTIONAL

# 1. Copy DNS setup script to router
cat ops/router/setup-dns-router.sh | ssh root@192.168.8.1 'cat > /root/setup-dns-router.sh && chmod +x /root/setup-dns-router.sh && sh /root/setup-dns-router.sh'

# 2. Copy and run pairing script
cat ops/router/pair-server.sh | ssh root@192.168.8.1 'cat > /root/pair-server.sh && chmod +x /root/pair-server.sh'
ssh root@192.168.8.1 'sh /root/pair-server.sh sg.lan'

# 3. Start the application server
gunicorn 'run:app' --bind 0.0.0.0:5000 --workers 4
```
⚠️ Only needed when:
- Using a new computer to host
- After router reset
- After changing network settings

## B. Regular Usage (Every Time You Run the App)
```bash
# 1. Activate Python environment
source .venv/bin/activate

# 2. Start the application server
gunicorn 'run:app' --bind 0.0.0.0:5000 --workers 4
```

## C. Accessing the Application
### From Host Computer
- Open browser and go to either:
  * http://sg.lan:5000
  * http://localhost:5000
  * http://192.168.8.xxx:5000 (replace xxx with host computer's IP)

### From Other Devices
1. Connect to `SG-Competition-WiFi` network
2. Open browser and go to:
   * http://192.168.8.xxx:5000 (replace xxx with host computer's IP)

   * http://sg.lan:5000 (is not working for mobile devices)

## D. Troubleshooting
### Connection Issues
1. Verify WiFi Connection:
   - Must be on `SG-Competition-WiFi` network
   - Check WiFi symbol is showing (not cellular data)

2. Server Issues:
   - Check if gunicorn is running on host
   - Allow port 5000 in host's firewall
   - Try restarting gunicorn

### Database Issues
```bash
# Reset and reinitialize database if needed
rm instance/app.db
flask db upgrade
```

## E. Important Reminders
### For Host Computer
- Keep computer awake and gunicorn running
- After restart:
  1. Connect to SG-Competition-WiFi
  2. Start gunicorn
  3. No need to run DNS setup again

### For All Users
- Must use SG-Competition-WiFi network
- Always include :5000 in URL
- IP address access always works as backup
- Database stays on host computer