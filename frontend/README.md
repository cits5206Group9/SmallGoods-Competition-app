# Small Goods Competition Frontend

A Progressive Web App (PWA) for managing powerlifting competitions with offline-first architecture using vanilla HTML, CSS, JavaScript, and Jinja2 templating.

## 🏗️ Architecture Overview

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Templating**: Jinja2 (server-side rendering)
- **Offline Support**: Service Worker + IndexedDB/LocalStorage
- **Real-time**: WebSocket with polling fallback
- **PWA**: Installable with offline functionality

## 📋 Requirements

### System Requirements
- **Python 3.6+** (for development server)
- **Modern Web Browser** (Chrome, Firefox, Safari, Edge)
- **Internet Connection** (initial setup only)

### Python Dependencies
```bash
pip install flask
```

Or install using requirements file:
```bash
pip install -r requirements.txt
```

## 🚀 Quick Start

### 1. Clone and Navigate
```bash
git checkout 12-feature-frontend-development
cd frontend
```

### 2. Install Dependencies
```bash
pip install flask
```

### 3. Start Development Server
```bash
python test_server.py
```

### 4. Open Interfaces
The server will automatically open your browser, or visit:
- **Admin**: http://localhost:5000/admin
- **Referee**: http://localhost:5000/ref
- **Timekeeper**: http://localhost:5000/tc
- **Athlete**: http://localhost:5000/athlete
- **Display**: http://localhost:5000/display
- **Network/QR**: http://localhost:5000/network

## 📱 Available Interfaces

| Interface | URL | Description | Target Device |
|-----------|-----|-------------|---------------|
| Admin | `/admin` | Competition management & overview | Desktop/Laptop |
| Referee | `/ref` | Decision buttons (Good Lift/No Lift) | Tablet/Phone |
| Timekeeper | `/tc` | Timer controls & queue management | Desktop/Tablet |
| Athlete | `/athlete` | Personal dashboard & notifications | Phone/Tablet |
| Display | `/display` | Public scoreboard (high contrast) | Projector/TV |
| Network | `/network` | QR codes & role access | Any device |

## 🛠️ Development Commands

### Start Test Server
```bash
# Main development server (recommended)
python test_server.py

# Alternative: Simple HTTP server (limited functionality)
python -m http.server 8000

# Using the setup script (interactive)
python ../setup_test_environment.py
```

### API Testing
```bash
# Test data injection
curl http://localhost:5000/api/test/inject

# Get competition data
curl http://localhost:5000/api/competition

# Get athletes
curl http://localhost:5000/api/athletes

# Search attempts
curl "http://localhost:5000/api/attempts?q=John"
```

## 📁 Project Structure

```
frontend/
├── README.md                 # This file
├── test_server.py           # Flask development server
├── requirements.txt         # Python dependencies
├── templates/               # Jinja2 HTML templates
│   ├── base.html           # Base template
│   ├── admin.html          # Admin interface
│   ├── referee.html        # Referee interface
│   ├── timekeeper.html     # Timekeeper interface
│   ├── athlete.html        # Athlete interface
│   ├── display.html        # Public display
│   └── network.html        # Network/QR page
├── static/                  # Static assets
│   ├── css/                # Stylesheets
│   │   ├── base.css        # Base styles & design system
│   │   ├── layout.css      # Grid & responsive layouts
│   │   ├── components.css  # Reusable components
│   │   └── pages/          # Page-specific styles
│   ├── js/                 # JavaScript modules
│   │   ├── app.js          # Main application entry
│   │   ├── modules/        # Core modules
│   │   ├── pages/          # Page-specific scripts
│   │   └── components/     # Reusable components
│   ├── images/             # Icons and images
│   ├── manifest.json       # PWA manifest
│   └── service-worker.js   # Service Worker for offline
└── preview-*.html          # Static preview files
```

## 🧪 Testing Modes

### 1. Full Flask Server (Recommended)
```bash
python test_server.py
```
- **Features**: Complete API simulation, real-time features, all interfaces
- **Best for**: Full functionality testing, development
- **Port**: 5000 (auto-detects if occupied)

### 2. Static HTML Preview
```bash
python ../setup_test_environment.py
# Select option 2
```
- **Features**: Visual review, basic interactions
- **Best for**: Quick UI checks, design validation
- **Limitations**: No server-side features

### 3. Simple HTTP Server
```bash
python -m http.server 8000
```
- **Features**: Service Worker testing, PWA installation
- **Best for**: Offline functionality, PWA testing
- **URL**: http://localhost:8000/

## 🔧 Configuration

### Environment Variables
```bash
# Optional: Set custom port
export FLASK_PORT=8080

# Optional: Enable debug mode
export FLASK_DEBUG=1
```

### Browser Requirements
- **Service Worker**: HTTPS or localhost only
- **PWA Installation**: Modern browser required
- **Offline Mode**: IndexedDB support needed

## 🚨 Troubleshooting

### Port 5000 Already in Use
```bash
# On macOS (AirPlay Receiver)
sudo lsof -ti:5000 | xargs kill -9

# Or use alternative port
python test_server.py --port 8080
```

### Templates Not Found (500 Error)
```bash
# Ensure you're in the frontend directory
cd frontend
python test_server.py

# Check templates exist
ls templates/
```

### Service Worker Issues
```bash
# Clear browser cache and Service Worker
# Chrome: DevTools > Application > Storage > Clear storage
# Firefox: DevTools > Application > Service Workers > Unregister
```

### Python Dependencies
```bash
# Install missing packages
pip install flask

# Or create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install flask
```

## 🌐 PWA Installation

### Desktop
1. Visit any interface URL
2. Look for "Install" button in address bar
3. Click to install as desktop app

### Mobile
1. Open in mobile browser
2. Tap "Add to Home Screen" (iOS) or "Install" (Android)
3. Access as native app

## 📊 Mock Data

The test server includes realistic mock data:

- **5 Athletes** with different categories and attempts
- **Competition** status and current events
- **Queue Management** with reorderable athletes
- **Leaderboard** with rankings and scores
- **Attempt History** searchable by name/lift/weight

### Refresh Test Data
```bash
curl http://localhost:5000/api/test/inject
```

## 🔌 API Integration

Ready for backend integration with these endpoints:

```javascript
// Competition API
GET /api/competition
GET /api/athletes
GET /api/queue
GET /api/leaderboard
GET /api/attempts?q=search

// Actions API
POST /api/referee/decision
POST /api/timer
POST /api/queue/reorder
```

## 📱 Feature Requirements Compliance

- **FR2**: Score search functionality ✅
- **FR3**: Live CRUD operations ✅
- **FR6**: Queue reorder interface ✅
- **FR7**: Authoritative timer controls ✅
- **FR8**: Wi-Fi QR code generation ✅
- **FR10**: Athlete push notifications ✅
- **FR11**: High contrast display mode ✅

## 🎯 Next Steps

1. **Backend Integration**: Connect to actual competition API
2. **WebSocket Setup**: Enable real-time synchronization
3. **Authentication**: Add role-based access control
4. **Production Build**: Optimize for deployment
5. **Testing**: Add automated tests for critical flows

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console for errors
3. Verify all dependencies are installed
4. Ensure you're using the correct commands

---

**Built with ❤️ for Small Goods Competition**