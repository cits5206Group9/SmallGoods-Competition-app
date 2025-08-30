# Frontend Development Todo List

## Technical Stack & Prerequisites

### Fixed Technology Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Templating**: Jinja2 (server-side rendering)
- **Offline Support**: Service Worker + Local Storage/IndexedDB
- **Real-time**: WebSocket with fallback to polling
- **Build Process**: Minimal - direct file serving with optional minification

### Technology Setup Tasks
- [ ] Set up Jinja2 template structure
- [ ] Configure static file serving (CSS, JS, images)
- [ ] Implement Service Worker for offline functionality
- [ ] Set up local storage schema for offline data
- [ ] Create JavaScript module structure without build tools
- [ ] Configure WebSocket connection with polling fallback

### Development Environment Setup
- [ ] Set up Python Flask/Django server for Jinja templating
- [ ] Create development file watcher (optional)
- [ ] Set up basic linting for HTML/CSS/JS
- [ ] Configure local HTTPS for Service Worker testing
- [ ] Create offline testing environment

## Phase 0 — Semantic Skeleton (Static Structure)

### Jinja Template Setup
- [ ] Create base template (`base.html`) with common structure
- [ ] Create individual page templates:
  - [ ] `admin.html` — Admin / Competition Operator View
  - [ ] `referee.html` — Referee View  
  - [ ] `timekeeper.html` — TC / Timekeeper View
  - [ ] `athlete.html` — Athlete View
  - [ ] `display.html` — Public Display Board
  - [ ] `network.html` — Network / QR Access Page

### HTML Structure & Semantic Markup
- [ ] Create semantic HTML5 structure (header, nav, main, aside, footer)
- [ ] Add proper ARIA landmarks and roles
- [ ] Create reusable HTML snippets for common UI patterns
- [ ] Add meta tags for offline PWA support
- [ ] Include Service Worker registration script
- [ ] Add static content placeholders from original mockup text

### CSS Architecture Setup
- [ ] Create CSS custom properties for design system
- [ ] Set up CSS file structure (base, components, pages, utilities)
- [ ] Create CSS Grid/Flexbox layout classes
- [ ] Add print styles for offline use

### File Structure for Offline-First App
```
static/
├── css/
│   ├── base.css (reset, typography, variables)
│   ├── layout.css (grid, flexbox, responsive)
│   ├── components.css (buttons, forms, cards)
│   ├── pages/
│   │   ├── admin.css
│   │   ├── referee.css
│   │   ├── timekeeper.css
│   │   ├── athlete.css
│   │   └── display.css
│   └── print.css (offline printing)
├── js/
│   ├── app.js (main application entry)
│   ├── modules/
│   │   ├── state-manager.js
│   │   ├── websocket.js
│   │   ├── offline.js
│   │   ├── storage.js
│   │   └── ui.js
│   ├── pages/
│   │   ├── admin.js
│   │   ├── referee.js
│   │   ├── timekeeper.js
│   │   ├── athlete.js
│   │   └── display.js
│   └── components/
│       ├── timer.js
│       ├── leaderboard.js
│       └── notifications.js
├── images/ (icons, logos)
├── manifest.json (PWA manifest)
└── service-worker.js
```
- [ ] Create this directory structure
- [ ] Set up file naming conventions
- [ ] Configure static file serving

## Phase 1 — Base Layout & Responsive Styles

### Responsive Design
- [ ] Implement CSS Grid/Flexbox layouts
- [ ] Create responsive breakpoints (mobile/tablet/desktop)
- [ ] Ensure large touch targets on `/ref` view (minimum 44px)
- [ ] Implement large, legible typography for `/display` view
- [ ] Test layouts on different screen sizes

### Typography & Spacing
- [ ] Define typography scale and spacing system
- [ ] Create consistent color palette
- [ ] Implement CSS custom properties/variables
- [ ] Add base styles and reset/normalize CSS

## Phase 2 — JavaScript Modules & UI Patterns

### JavaScript Module Structure
- [ ] Create `js/modules/` directory structure
- [ ] Create `ui.js` module for DOM manipulation utilities
- [ ] Create `storage.js` module for local storage/IndexedDB operations
- [ ] Create `websocket.js` module for real-time communication
- [ ] Create `offline.js` module for Service Worker communication
- [ ] Create `validation.js` module for form validation

### UI Pattern JavaScript Classes
- [ ] Create `TopNavigation` class for header interactions
- [ ] Create `SideNavigation` class for admin sidebar
- [ ] Create `Modal` class for popup dialogs
- [ ] Create `Table` class for sortable/filterable tables
- [ ] Create `Tabs` class for tab switching
- [ ] Create `FormHandler` class for form submissions

### Specialized JavaScript Components
- [ ] Create `Timer` class for countdown functionality
- [ ] Create `LiveFeed` class for status updates
- [ ] Create `Ticker` class for scrolling announcements
- [ ] Create `QRGenerator` class for Wi-Fi QR codes
- [ ] Create `NotificationManager` class for push notifications
- [ ] Create `SearchInterface` class for score lookup

### Data Management Classes
- [ ] Create `Dashboard` class for overview data display
- [ ] Create `CompetitionTable` class for editable tables
- [ ] Create `Leaderboard` class for ranking display
- [ ] Create `AthleteProfile` class for athlete information
- [ ] Create `AttemptTracker` class for attempt management

## Phase 3 — Basic Interactivity

### Admin View (`/admin`) - FR2, FR3
- [ ] Implement local add/remove/edit functionality (FR3 prototype)
  - [ ] Add new entity forms
  - [ ] Edit existing entity forms  
  - [ ] Delete confirmation dialogs
- [ ] Implement local score filtering (FR2 prototype)
  - [ ] Search by athlete name
  - [ ] Filter by lift type
  - [ ] Filter by date/time range

### Referee View (`/ref`)
- [ ] Implement decision buttons (Good Lift/No Lift)
- [ ] Add single-submission protection
- [ ] Show confirmation in footer after submission
- [ ] Add loading states during submission

### Timekeeper View (`/tc`) - FR6, FR7
- [ ] Implement front-end timer functionality (FR7 prototype)
  - [ ] Start/pause/reset controls
  - [ ] Visual countdown display
  - [ ] Audio alerts for time warnings
- [ ] Implement queue reorder functionality (FR6 prototype)
  - [ ] Drag-and-drop interface
  - [ ] Dropdown selection alternative
  - [ ] Save reorder changes locally

### Athlete View (`/athlete`) - FR10
- [ ] Implement local countdown timers
- [ ] Create push notification banner (FR10 prototype)
  - [ ] "You're up in 2 minutes" trigger
  - [ ] Banner dismiss functionality
  - [ ] Visual notification styling

### Display View (`/display`) - FR11
- [ ] Implement centered countdown timer
- [ ] Create scrolling ticker for next athletes
- [ ] Apply high-contrast theme (FR11)
  - [ ] High contrast color palette
  - [ ] Large font sizes for visibility
  - [ ] Bold typography weights
- [ ] Test visibility from 3-10 meters distance

## Phase 4 — Data Wiring & Real-Time Communication

### Phase 4a — Real-Time Infrastructure
- [ ] Choose and implement WebSocket vs Server-Sent Events
- [ ] Create event bus architecture
- [ ] Implement connection management
  - [ ] Auto-reconnection on connection loss
  - [ ] Connection status indicators
  - [ ] Graceful degradation when offline
- [ ] Define event message formats

### Phase 4b — Event Types & Handlers
- [ ] Implement `timer:update` events (start/pause/reset/remaining)
- [ ] Implement `queue:update` events (reorder/add/remove)
- [ ] Implement `result:logged` events (Good/No Lift + attempt data)
- [ ] Implement `score:changed` events (history/rankings refresh)
- [ ] Add event validation and error handling

### Phase 4c — Component Integration
- [ ] Connect Admin view to real-time CRUD operations (FR3)
  - [ ] Broadcast entity changes to all connected clients
  - [ ] Handle concurrent editing conflicts
- [ ] Connect Admin score search to live API (FR2)
  - [ ] Real-time search results
  - [ ] Search result caching
- [ ] Connect Timekeeper timer to broadcast system (FR7)
  - [ ] Ensure timer is authoritative across all views
  - [ ] Sync timer state on page load/refresh

### Phase 4d — Cross-View Synchronization  
- [ ] Sync timer updates to `/admin`, `/display`, `/athlete`, `/ref`
- [ ] Implement athlete push notification rules (FR10)
  - [ ] Queue position-based triggers
  - [ ] Time-based notification logic
  - [ ] Browser notification permissions
- [ ] Make `/display` view fully read-only with live updates
- [ ] Handle real-time leaderboard updates

## Phase 5 — State Management & Authentication (Vanilla JS)

### Client-Side State Management
- [ ] Create `StateManager` class for centralized state
- [ ] Implement Observer pattern for state changes
- [ ] Create state modules:
  - [ ] `CompetitionState` - current event and settings
  - [ ] `QueueState` - athlete order and status
  - [ ] `TimerState` - countdown state and controls
  - [ ] `AthleteState` - current athlete information
  - [ ] `LeaderboardState` - rankings and scores
  - [ ] `HistoryState` - past attempts and results
  - [ ] `UserState` - authentication and role data

### Local Storage State Persistence
- [ ] Implement state serialization/deserialization
- [ ] Add automatic state backup to localStorage
- [ ] Create state restoration on page load
- [ ] Handle state migration for app updates
- [ ] Implement state compression for large datasets

### Authentication & Authorization (No Framework)
- [ ] Create simple session-based authentication
- [ ] Implement role-based page access control
- [ ] Add JavaScript-based route protection
- [ ] Create login/logout forms with validation
- [ ] Store user session in localStorage/sessionStorage
- [ ] Add role-specific UI element visibility

### Concurrency & Data Integrity
- [ ] Implement optimistic updates with rollback
- [ ] Add timestamp-based conflict resolution
- [ ] Create loading states with CSS classes
- [ ] Handle concurrent edit notifications
- [ ] Add data validation before state updates

## Phase 6 — Offline-First Architecture & Error Handling

### Service Worker Implementation
- [ ] Create `service-worker.js` with cache strategies
- [ ] Implement cache-first strategy for static assets (HTML, CSS, JS)
- [ ] Implement network-first strategy for dynamic data
- [ ] Create offline fallback pages
- [ ] Add cache versioning and updates
- [ ] Handle Service Worker lifecycle events

### Local Data Storage
- [ ] Design IndexedDB schema for offline data
- [ ] Implement local storage for user preferences
- [ ] Create data synchronization queue
- [ ] Add conflict resolution for offline changes
- [ ] Store critical competition data locally
- [ ] Implement data expiration and cleanup

### Offline Functionality
- [ ] Enable full offline operation for referee decisions
- [ ] Cache athlete information and attempt data
- [ ] Store timer state and queue information locally
- [ ] Enable offline score searches in cached data
- [ ] Show offline status indicators in UI
- [ ] Queue actions when offline, sync when online

### PWA Features
- [ ] Create web app manifest (`manifest.json`)
- [ ] Add home screen installation prompts
- [ ] Implement app-like navigation (no browser chrome)
- [ ] Add splash screen for mobile installation
- [ ] Configure app icons and theme colors
- [ ] Enable fullscreen mode for display board

### Error Handling
- [ ] Create global JavaScript error handler
- [ ] Implement user-friendly error messages
- [ ] Add retry mechanisms for failed requests
- [ ] Log errors to local storage for debugging
- [ ] Handle network timeout scenarios
- [ ] Create fallback UI states for missing data

### Security Considerations
- [ ] Implement HTTPS enforcement
- [ ] Add CSRF protection for forms
- [ ] Sanitize user inputs
- [ ] Implement rate limiting on client side
- [ ] Secure WebSocket connections (WSS)
- [ ] Validate all real-time messages

## Phase 7 — Accessibility & Performance

### Accessibility (WCAG 2.1 AA)
- [ ] Add ARIA labels and descriptions
- [ ] Implement proper focus management
- [ ] Ensure keyboard navigation support
- [ ] Test with screen readers
- [ ] Add high contrast mode toggle
- [ ] Implement proper heading hierarchy
- [ ] Add skip navigation links

### Performance Optimization
- [ ] Implement code splitting by route
- [ ] Create standalone `/display` bundle for performance
- [ ] Add virtualization for large data tables
- [ ] Implement throttled event handling for real-time updates
- [ ] Optimize bundle sizes and loading times
- [ ] Add performance monitoring
- [ ] Implement lazy loading for images and components

### Mobile & Touch Optimization
- [ ] Ensure touch targets are minimum 44px
- [ ] Implement swipe gestures where appropriate
- [ ] Test on various mobile devices
- [ ] Optimize for tablet referee interface
- [ ] Add haptic feedback for important actions

## Phase 8 — Testing & Quality Assurance (Vanilla JS)

### Manual Testing Framework
- [ ] Create HTML test pages for each module
- [ ] Test JavaScript classes and methods manually
- [ ] Create test data sets for various scenarios
- [ ] Test DOM manipulation functions
- [ ] Validate local storage operations
- [ ] Test Service Worker functionality

### Browser Console Testing
- [ ] Create console test scripts for state management
- [ ] Test WebSocket connection handling
- [ ] Validate offline functionality
- [ ] Test timer accuracy and synchronization
- [ ] Verify data persistence and retrieval

### Integration Testing
- [ ] Test real-time WebSocket event handling
- [ ] Test authentication flows across pages
- [ ] Test form submissions and validation
- [ ] Test offline/online transitions
- [ ] Validate cross-page state synchronization

### End-to-End Testing
- [ ] Test complete referee decision flow
- [ ] Test timer start/pause/reset across all views
- [ ] Test queue reorder functionality
- [ ] Test score search and filtering
- [ ] Test display board synchronization
- [ ] Test athlete notification delivery

### Cross-Browser & Device Testing
- [ ] Test on Chrome, Firefox, Safari, Edge
- [ ] Test on various mobile devices
- [ ] Test on tablets for referee interface
- [ ] Test projector display compatibility
- [ ] Verify QR code functionality

## Feature Requirements Implementation Status

### FR2 — Score Search
- [ ] Admin search bar component
- [ ] Connect to history search API
- [ ] Filter by athlete/lift/time
- [ ] Real-time search results
- [ ] Search result caching

### FR3 — Live CRUD Operations
- [ ] Add/remove/edit entity forms
- [ ] Real-time broadcast of changes
- [ ] Optimistic updates with rollback
- [ ] Conflict resolution for concurrent edits
- [ ] Change confirmation and undo

### FR6 — Queue Reorder
- [ ] Drag-and-drop reorder interface  
- [ ] Dropdown selection alternative
- [ ] Persist new queue order
- [ ] Trigger site-wide synchronization
- [ ] Undo queue changes

### FR7 — Authoritative Timer
- [ ] Timer controls (start/pause/reset)
- [ ] Broadcast timer events to all views
- [ ] Synchronize timer state across clients
- [ ] Audio alerts for time warnings
- [ ] Visual countdown displays

### FR8 — Wi-Fi QR Code
- [ ] QR code generation component
- [ ] Backend integration for SSID/password
- [ ] QR code refresh functionality
- [ ] Mobile-optimized QR scanning
- [ ] Network access validation

### FR10 — Athlete Push Notifications
- [ ] In-app banner notifications
- [ ] Browser push notification support
- [ ] Queue position-based triggers  
- [ ] "You're up in X minutes" logic
- [ ] Notification dismiss and history

### FR11 — High Contrast Display
- [ ] High contrast color palette
- [ ] Large typography for visibility
- [ ] Bold font weights
- [ ] Minimal motion design
- [ ] 3-10 meter visibility testing

## Deployment & Production

### Production Setup
- [ ] Configure production build process
- [ ] Set up CDN for static assets
- [ ] Configure domain and SSL certificates
- [ ] Set up monitoring and logging
- [ ] Create deployment scripts

### Performance Monitoring
- [ ] Add analytics tracking
- [ ] Monitor real-time connection stability
- [ ] Track user interaction metrics
- [ ] Monitor error rates and performance
- [ ] Set up alerting for critical issues

### Documentation
- [ ] Create component documentation
- [ ] Document API integration points
- [ ] Create user guides for each role
- [ ] Document deployment procedures
- [ ] Create troubleshooting guide

## Network/Domain Configuration

### URL Structure (replace [DOMAIN] with actual domain)
- [ ] `[DOMAIN]/admin` — Admin interface
- [ ] `[DOMAIN]/ref` — Referee interface  
- [ ] `[DOMAIN]/tc` — Timekeeper interface
- [ ] `[DOMAIN]/athlete` — Athlete interface
- [ ] `[DOMAIN]/display` — Public display board
- [ ] `[DOMAIN]/network` — QR code access page

### QR Code Links (FR8)
- [ ] Generate QR for Wi-Fi connection
- [ ] Create role-based access QR codes
- [ ] Test QR code scanning reliability
- [ ] Add QR code refresh mechanism

## Notes & Considerations

### Critical Dependencies
- Backend API must be ready before Phase 4
- WebSocket/SSE server implementation required
- Authentication service integration needed
- Database schema must support real-time operations

### Risk Mitigation
- Plan for graceful degradation without real-time features
- Implement comprehensive error handling
- Create offline-capable core functionality
- Test thoroughly on target devices (tablets for refs)

### Success Metrics
- Sub-2 second load times on all views
- 99.9% real-time message delivery
- Zero data loss during network interruptions
- Accessible to users with disabilities
- Cross-browser compatibility maintained