# Frontend Testing Guide

This guide provides multiple ways to test and review the Small Goods Competition frontend before having a full backend.

## 🚀 Quick Start Options

### Option 1: Flask Test Server (Recommended)
**Full functionality with mock data and API endpoints**

1. **Install Flask** (if you don't have it):
   ```bash
   pip install flask
   ```

2. **Run the test server**:
   ```bash
   cd frontend
   python test_server.py
   ```

3. **Access the application**:
   - **Admin Dashboard**: http://localhost:5000/admin
   - **Referee Interface**: http://localhost:5000/ref
   - **Timekeeper**: http://localhost:5000/tc
   - **Athlete View**: http://localhost:5000/athlete
   - **Display Board**: http://localhost:5000/display
   - **Network/QR**: http://localhost:5000/network

4. **Test features**:
   - Search functionality works with mock data
   - Timer controls function properly
   - Real-time updates simulation
   - Offline functionality testing
   - API endpoints respond with mock data

### Option 2: Static HTML Preview (No Server)
**Quick visual review of layout and basic interactions**

1. **Open files directly in browser**:
   - **Admin**: Open `preview-admin.html` in your browser
   - **Referee**: Open `preview-referee.html` in your browser

2. **What works**:
   - Layout and responsive design
   - Basic navigation and interactions
   - CSS styling and animations
   - Print functionality (Ctrl+P)
   - Touch interface simulation

3. **Limitations**:
   - No real data loading
   - Limited interactivity
   - No offline Service Worker

### Option 3: Simple HTTP Server
**For testing Service Worker and PWA features**

1. **Python 3** (built-in server):
   ```bash
   cd frontend
   python -m http.server 8000
   ```
   Then visit: http://localhost:8000/preview-admin.html

2. **Node.js** (if you have it):
   ```bash
   cd frontend
   npx serve .
   ```

3. **VS Code Live Server** extension:
   - Install "Live Server" extension
   - Right-click on `preview-admin.html` → "Open with Live Server"

## 🧪 What to Test

### Layout & Design Testing
- [ ] **Responsive Design**: Test on desktop, tablet, mobile
- [ ] **Navigation**: Click through all menu items and sections
- [ ] **Typography**: Check font sizes and readability
- [ ] **Colors**: Verify color scheme and accessibility
- [ ] **Spacing**: Check margins, padding, and alignment

### Admin Dashboard
- [ ] **Sidebar Navigation**: All menu items work
- [ ] **Dashboard Cards**: Proper data display
- [ ] **Timer Controls**: Start, pause, reset functions
- [ ] **Search Bar**: Type queries and see mock results
- [ ] **Tables**: Tab switching and data display
- [ ] **Action Buttons**: Click to verify button states

### Referee Interface
- [ ] **Decision Buttons**: Large, touch-friendly buttons
- [ ] **Timer Display**: Countdown functionality
- [ ] **Athlete Info**: Current athlete display
- [ ] **Confirmation**: Decision feedback
- [ ] **Undo Function**: Undo last decision
- [ ] **Keyboard Shortcuts**: G for Good, N for No Lift

### Mobile/Touch Testing
- [ ] **Touch Targets**: All buttons are at least 44px
- [ ] **Touch Feedback**: Visual feedback on tap
- [ ] **Orientation**: Test portrait and landscape
- [ ] **Scrolling**: Smooth scrolling behavior
- [ ] **Pinch Zoom**: Proper viewport settings

### Accessibility Testing
- [ ] **Keyboard Navigation**: Tab through all elements
- [ ] **Screen Reader**: Test with screen reader if available
- [ ] **High Contrast**: Check display in high contrast mode
- [ ] **Focus Indicators**: Visible focus outlines
- [ ] **ARIA Labels**: Proper labeling on interactive elements

### PWA & Offline Testing
- [ ] **Installation**: Check for install prompt (requires HTTPS/localhost)
- [ ] **Service Worker**: Check browser dev tools → Application → Service Workers
- [ ] **Cache Storage**: Verify cached resources
- [ ] **Offline Mode**: Disconnect network and test functionality
- [ ] **Manifest**: Check PWA manifest in dev tools

### Print Testing
- [ ] **Print Preview**: Press Ctrl+P (Cmd+P on Mac)
- [ ] **Print Layout**: Check page breaks and formatting
- [ ] **Hidden Elements**: Verify buttons/controls are hidden
- [ ] **Readable Output**: Ensure text is readable in print

## 🛠️ Browser Developer Tools

### Essential Dev Tools Tabs
1. **Console**: Check for JavaScript errors
2. **Network**: Monitor requests and responses
3. **Application**: Check Service Worker, storage, manifest
4. **Elements**: Inspect HTML and CSS
5. **Lighthouse**: Run performance and accessibility audits

### Common Testing Commands
```javascript
// In browser console:

// Check app state (if Flask server running)
competitionApp.debug();

// Test state manager
stateManager.debug();

// Test storage
storageManager.getStorageUsage();

// Trigger offline mode
window.navigator.onLine = false;

// Test notifications
uiManager.showToast('Test message', 'success');
```

## 📱 Device Testing

### Recommended Test Devices/Sizes
- **Desktop**: 1920x1080, 1366x768
- **Tablet**: iPad (768x1024), iPad Pro (1024x1366)
- **Mobile**: iPhone SE (375x667), iPhone 12 (390x844)
- **Large Display**: 4K monitor (for display board testing)

### Browser Testing
- **Chrome/Edge**: Full compatibility expected
- **Firefox**: Should work with minor differences
- **Safari**: Test iOS/macOS Safari specifically
- **Mobile Browsers**: Test mobile Chrome and Safari

## 🔧 Troubleshooting

### Common Issues

**Service Worker not loading**
```bash
# Must use localhost or HTTPS
# Check browser console for errors
# Clear browser cache (Ctrl+Shift+R)
```

**Mock data not showing**
```bash
# Check browser console for JavaScript errors
# Verify file paths are correct
# Try the Flask server option
```

**Responsive design issues**
```bash
# Test with browser dev tools device emulation
# Check CSS media queries
# Verify viewport meta tag
```

**Print styles not working**
```bash
# Use browser Print Preview
# Check print.css is loaded
# Test with actual printer if available
```

## 📊 Performance Testing

### Lighthouse Audit
1. Open Chrome Dev Tools
2. Go to Lighthouse tab
3. Select categories to test
4. Run audit and review results
5. Aim for scores > 90 in all categories

### Key Metrics to Check
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Time to Interactive**: < 3s
- **Cumulative Layout Shift**: < 0.1

## 📝 Feedback Checklist

### Design Review
- [ ] Layout is intuitive and professional
- [ ] Color scheme is appropriate for competition context
- [ ] Typography is readable on all screen sizes
- [ ] Icons and imagery are clear and meaningful
- [ ] Spacing and alignment are consistent

### Functionality Review
- [ ] All interactive elements provide feedback
- [ ] Navigation is logical and consistent
- [ ] Forms are easy to use and validate properly
- [ ] Error messages are helpful and clear
- [ ] Success states are clearly communicated

### User Experience Review
- [ ] Loading states prevent confusion
- [ ] Offline functionality works as expected
- [ ] Touch interface is comfortable to use
- [ ] Information hierarchy is clear
- [ ] Task flows are efficient

### Technical Review
- [ ] No JavaScript errors in console
- [ ] All resources load successfully
- [ ] Service Worker registers correctly
- [ ] PWA features work as expected
- [ ] Print output is professional

## 🚨 Known Limitations in Preview Mode

### Without Backend Server
- Real-time WebSocket updates won't work
- Data persistence is simulated
- API calls return mock data
- Authentication is bypassed
- Some advanced features are placeholders

### With Flask Test Server
- WebSocket functionality is simulated
- Data is reset on server restart
- No actual database persistence
- Limited user management
- Simplified API responses

## 📞 Getting Help

If you encounter issues:

1. **Check browser console** for error messages
2. **Clear browser cache** and try again
3. **Test in different browser** to isolate issues
4. **Check file paths** are correct
5. **Verify Python/Flask** is properly installed

Remember: This is a preview/testing environment. Full functionality requires integration with a proper backend system.