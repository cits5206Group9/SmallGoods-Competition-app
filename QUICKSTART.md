# 🚀 Quick Start Guide

**Get up and running in 5 minutes!**

---

## 📦 Installation (2 minutes)

```bash
# 1. Navigate to project
cd SmallGoods-Competition-app

# 2. Create virtual environment
python3 -m venv .venv

# 3. Activate it
source .venv/bin/activate     # macOS/Linux
# OR
.venv\Scripts\activate        # Windows

# 4. Install dependencies
pip install -r requirements.txt

# 5. Setup database
flask db upgrade
```

---

## ▶️ Run Application (30 seconds)

```bash
./run.sh          # macOS/Linux
# OR
run.bat           # Windows
```

Open browser: `http://localhost:5000`

---

## 👤 First Login

```
Email: admin@example.com
Password: admin123
```

**⚠️ Change this password immediately!**

---

## 🎯 Quick Tour (2 minutes)

### 1. Create a Competition
- Admin Dashboard → Competitions → "Create New"
- Fill in name, dates, location
- Set break times (default: 5min events, 3min flights)

### 2. Add an Event
- Select Competition → Events tab → "Add Event"
- Enter: Name, weight class, gender, type

### 3. Create a Flight
- Select Event → Flights → "Create New Flight"
- Set name and schedule time

### 4. Add Athletes
- Flights → "Manage Athletes" → "Add Athlete"
- Fill athlete details and starting weight

### 5. Start Competition
- Navigate to Timer Control: `http://localhost:5000/admin/timer`
- Load your flight
- Click Next → Apply → Start timer
- Use Stop button when attempt complete

---

## 📱 Multi-Device Setup (1 minute)

### Find Your IP:
```bash
ifconfig | grep "inet "          # macOS/Linux
ipconfig                         # Windows
```

### Run with Network Access:
```bash
python3 -c "from run import app; app.run(host='0.0.0.0', port=5001)"
```

### Connect Other Devices:
Open `http://YOUR_IP:5001` on any device on same Wi-Fi

---

## 🔧 Essential URLs

| Page | URL |
|------|-----|
| **Admin Dashboard** | `/admin` |
| **Timer Control** | `/admin/timer` |
| **Referee Panel** | `/referee` |
| **Scoreboard** | `/display/scoreboard` |
| **Athlete Portal** | `/athlete` |

---

## 🆘 Common Issues

### Can't start app?
```bash
# Make sure virtual environment is activated
source .venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

### Can't access from other devices?
- Check firewall settings
- Ensure running with `host='0.0.0.0'`
- Verify devices on same network

### Database errors?
```bash
# Reset database (WARNING: deletes data)
rm instance/app.db
flask db upgrade
```

---

## 📖 Full Documentation

- **Complete Guide:** [USER_GUIDE.md](USER_GUIDE.md)
- **Developer Guide:** [README.md](README.md)
- **Testing:** [USER_GUIDE.md#testing-guide](USER_GUIDE.md#testing-guide)

---

## ✅ Next Steps

1. ✅ App running
2. ✅ Created competition
3. ✅ Added athletes
4. ✅ Started timer

**Now:** Read [USER_GUIDE.md](USER_GUIDE.md) for detailed features!

---

**Need Help?** Check [Troubleshooting](USER_GUIDE.md#troubleshooting) or create an [issue](https://github.com/cits5206Group9/SmallGoods-Competition-app/issues).
