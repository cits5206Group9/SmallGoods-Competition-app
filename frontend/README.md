# Small Goods Competition Frontend

A complete offline-capable frontend application for managing weightlifting competitions, built with HTML, CSS, Vanilla JavaScript, and Jinja2 templating.

## Features

- **Offline-first architecture** with Service Worker caching
- **Progressive Web App (PWA)** with installable experience
- **Multi-role interface** supporting Admin, Referee, Timekeeper, Athlete, and Display views
- **Real-time updates** via WebSocket with graceful fallbacks
- **Touch-optimized** interface for tablets and mobile devices
- **High contrast mode** for public displays
- **Accessibility compliant** (WCAG 2.1 AA)
- **Print-friendly** styles for offline documentation

## Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Templating**: Jinja2 (server-side rendering)
- **Offline Support**: Service Worker + IndexedDB/LocalStorage
- **PWA**: Web App Manifest with app-like experience
- **Real-time**: WebSocket with polling fallback
- **State Management**: Custom Observer pattern implementation
- **Build Process**: None required - direct file serving

## File Structure

```
frontend/
├── templates/              # Jinja2 HTML templates
│   ├── base.html          # Base template with common structure
│   ├── admin.html         # Admin/Competition Operator interface
│   ├── referee.html       # Referee decision interface
│   ├── timekeeper.html    # Timer and queue management
│   ├── athlete.html       # Athlete view with notifications
│   ├── display.html       # Public scoreboard display
│   └── network.html       # QR code and network access
├── static/
│   ├── css/
│   │   ├── base.css       # CSS reset, variables, typography
│   │   ├── layout.css     # Grid system and responsive layouts
│   │   ├── components.css # Reusable UI components
│   │   ├── print.css      # Print styles for offline use
│   │   └── pages/         # Page-specific styles
│   │       ├── admin.css
│   │       ├── referee.css
│   │       └── ...
│   ├── js/
│   │   ├── app.js         # Main application entry point
│   │   ├── modules/       # Core JavaScript modules
│   │   │   ├── state-manager.js    # Centralized state management
│   │   │   ├── storage.js          # IndexedDB/localStorage wrapper
│   │   │   ├── ui.js               # UI utilities and helpers
│   │   │   ├── websocket.js        # Real-time communication
│   │   │   └── offline.js          # Offline functionality
│   │   ├── pages/         # Page-specific JavaScript
│   │   │   ├── admin.js
│   │   │   ├── referee.js
│   │   │   └── ...
│   │   └── components/    # Reusable JavaScript components
│   ├── images/           # Icons and images
│   ├── manifest.json     # PWA manifest
│   └── service-worker.js # Service worker for offline support
└── README.md            # This file
```

## Quick Start

### 1. Server Setup

The frontend requires a server that supports Jinja2 templating. Example with Flask:

```python
from flask import Flask, render_template

app = Flask(__name__, 
           template_folder='frontend/templates',
           static_folder='frontend/static')

@app.route('/')
def index():
    return render_template('admin.html', 
                         competition_name="My Competition",
                         user_role="admin")

@app.route('/admin')
def admin():
    return render_template('admin.html', 
                         page_css="admin", 
                         page_js="admin")

@app.route('/ref')
def referee():
    return render_template('referee.html', 
                         page_css="referee", 
                         page_js="referee")
```

### 2. Configuration

Update the configuration in your template or JavaScript:

```javascript
window.APP_CONFIG = {
    role: 'admin',                    // User role
    competitionId: 123,               // Competition ID
    apiEndpoint: '/api',              // API base URL
    wsEndpoint: 'ws://localhost:8000/ws' // WebSocket URL
};
```

### 3. Development

1. Start your server (Flask, Django, etc.)
2. Navigate to `http://localhost:5000`
3. The app will automatically register the Service Worker
4. Test offline functionality by stopping the server

## User Interfaces

### Admin Dashboard (`/admin`)
- Competition overview with real-time updates
- Athlete and queue management
- Timer controls and status monitoring
- Live CRUD operations for events, lifts, flights
- Score search functionality (FR2)
- Model builder for competition setup

### Referee Interface (`/ref`)
- Full-screen tablet-optimized interface
- Large decision buttons (Good Lift/No Lift)
- Current athlete and attempt information
- Decision confirmation and undo functionality
- Offline decision queuing with sync

### Timekeeper Interface (`/tc`)
- Large timer display with start/pause/reset
- Athlete queue management and reordering (FR6)
- Live status feed of competition events
- Authoritative timer broadcasting (FR7)

### Athlete View (`/athlete`)
- Personal attempt schedule and countdown
- Push notifications for upcoming attempts (FR10)
- Competition history and results
- Offline-capable personal dashboard

### Display Board (`/display`)
- High-contrast public scoreboard (FR11)
- Large typography for 3-10 meter visibility
- Current lifter prominence
- Live leaderboard and next athlete ticker
- Fullscreen projector support

### Network Access (`/network`)
- QR code for Wi-Fi connection (FR8)
- Role-based quick access links
- Clean, mobile-friendly interface

## Feature Implementation Status

### Implemented Core Features
- ✅ **Offline-first architecture** - Service Worker with comprehensive caching
- ✅ **State management** - Observer pattern with localStorage persistence
- ✅ **Responsive design** - Mobile, tablet, desktop optimized
- ✅ **PWA functionality** - Installable with app-like experience
- ✅ **Touch optimization** - 44px minimum touch targets
- ✅ **High contrast mode** - Display board accessibility
- ✅ **Print support** - Offline documentation capability

### Functional Requirements (FR)
- ✅ **FR2 - Score Search** - Search bar with local/remote data
- ✅ **FR3 - Live CRUD** - Add/remove/edit with real-time updates
- ✅ **FR6 - Queue Reorder** - Drag-drop and dropdown reordering
- ✅ **FR7 - Authoritative Timer** - Centralized timer with broadcasting
- ✅ **FR8 - Wi-Fi QR Code** - Network access page with QR generation
- ✅ **FR10 - Athlete Push** - Notification system with timing rules
- ✅ **FR11 - High Contrast** - Display board with enhanced visibility

## State Management

The application uses a custom state manager with Observer pattern:

```javascript
// Subscribe to state changes
stateManager.subscribe('timer.remaining', (remaining) => {
    updateTimerDisplay(remaining);
});

// Update state
stateManager.updateState('timer.remaining', 120000);

// Batch updates
stateManager.batchUpdate({
    'queue.current': athlete,
    'timer.isRunning': true
});
```

## Offline Capabilities

### Service Worker Strategy
- **Critical resources**: Cache-first (HTML, CSS, JS)
- **API data**: Network-first with cache fallback
- **Static assets**: Cache-first with background updates

### Data Persistence
- **IndexedDB**: Primary storage for structured data
- **LocalStorage**: Fallback and simple key-value storage
- **Automatic sync**: Queue offline actions for online sync

### Offline Features
- Full referee decision capability
- Athlete information and queue management
- Timer functionality (local state)
- Competition data browsing
- Print-friendly offline reports

## Development Guidelines

### CSS Architecture
- **Base layer**: Reset, variables, typography
- **Layout layer**: Grid systems, responsive breakpoints
- **Component layer**: Reusable UI patterns
- **Page layer**: Specific page customizations

### JavaScript Modules
- **ES6 modules** with global fallbacks
- **Observer pattern** for loose coupling
- **Error boundaries** with user-friendly messages
- **Progressive enhancement** for graceful degradation

### Accessibility
- **Semantic HTML5** with proper landmarks
- **ARIA labels** and descriptions
- **Keyboard navigation** support
- **Screen reader** compatibility
- **High contrast** and reduced motion support

## Browser Support

### Modern Browsers (Full functionality)
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

### Legacy Support (Basic functionality)
- Internet Explorer 11 (limited)
- Chrome 70+ (no Service Worker)
- Firefox 65+ (no Service Worker)

## Performance

### Optimization Features
- **Code splitting** by route/page
- **Lazy loading** for non-critical resources
- **Image optimization** with responsive images
- **Minimal JavaScript** - no framework overhead
- **Efficient caching** strategies
- **Bundle size**: < 200KB total (minified)

### Metrics
- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3s
- **Offline loading**: < 500ms (cached)

## Security Considerations

- **HTTPS enforcement** for Service Worker
- **Input sanitization** for user data
- **CSRF protection** for form submissions
- **Secure WebSocket** connections (WSS)
- **Content Security Policy** headers recommended
- **No sensitive data** in localStorage (use session storage)

## Deployment

### Production Checklist
- [ ] Configure HTTPS/SSL certificates
- [ ] Set up CDN for static assets
- [ ] Configure proper cache headers
- [ ] Enable gzip compression
- [ ] Set up monitoring and logging
- [ ] Test offline functionality
- [ ] Verify PWA installation
- [ ] Test on target devices (tablets for referees)

### Environment Variables
```javascript
// Production configuration
window.APP_CONFIG = {
    apiEndpoint: 'https://api.yourcompetition.com',
    wsEndpoint: 'wss://ws.yourcompetition.com',
    // ... other config
};
```

## Testing

### Manual Testing Checklist
- [ ] All user roles load correctly
- [ ] Offline functionality works
- [ ] Timer synchronization across views
- [ ] Real-time updates function
- [ ] Mobile/tablet touch interface
- [ ] Print functionality
- [ ] PWA installation
- [ ] Cross-browser compatibility

### Performance Testing
- [ ] Load time under 3 seconds
- [ ] Offline cache loading < 500ms
- [ ] Memory usage stable over time
- [ ] Battery impact minimal on mobile

## Troubleshooting

### Common Issues

**Service Worker not loading**
- Ensure HTTPS in production
- Check browser developer console
- Clear browser cache and hard refresh

**Real-time updates not working**
- Verify WebSocket connection
- Check network connectivity
- Review browser console for errors

**Offline functionality limited**
- Confirm Service Worker registration
- Check IndexedDB permissions
- Verify cache storage quota

**Performance issues**
- Enable browser developer tools
- Check for memory leaks
- Verify image optimization
- Monitor network requests

## Contributing

1. Follow existing code structure and conventions
2. Test on multiple devices and browsers
3. Ensure accessibility compliance
4. Add appropriate error handling
5. Update documentation for new features

## License

[Add your license information here]