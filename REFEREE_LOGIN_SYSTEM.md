# Referee Login System Implementation

## Overview
Implemented a complete referee authentication and individual interface system that allows generated referees to log in with their credentials and access a personalized referee panel.

## Features Implemented

### 1. Referee Login Page (`/admin/referee/login`)
**Route**: `/admin/referee/login`
**Template**: `app/templates/admin/referee_login.html` (already existed)
**Functionality**:
- Login form with username and password fields
- Session-based authentication for referees
- Redirects to individual referee interface after successful login
- Updates `last_login` timestamp in database
- Flash messages for success/error feedback

### 2. Individual Referee Interface (`/admin/referee/interface`)
**Route**: `/admin/referee/interface`
**Template**: `app/templates/admin/referee_interface.html` (newly created)
**Functionality**:
- **Session Protection**: Only accessible when logged in as a referee
- **Dynamic Loading**: Interface loads based on logged-in referee's credentials
- **Personalized Display**:
  - Shows referee name, username, and position in header
  - Displays assigned competition information
  - Shows live timer from timekeeper
  - Current attempt details (athlete, weight, attempt number, lift type)
- **Decision Making**:
  - Good Lift / No Lift buttons
  - Submit decision functionality
  - Real-time polling for current attempt data (every 1 second)
- **Logout**: Secure logout that clears session

### 3. Referee Logout (`/admin/referee/logout`)
**Route**: `/admin/referee/logout`
**Functionality**:
- Clears all referee session data
- Redirects back to login page

### 4. Updated Referee Settings Page
**File**: `app/templates/admin/referee_settings.html`
**Changes**:
- "Login" button for each referee in the table
- Opens `/admin/referee/login` in a new tab when clicked
- Allows admins to quickly access the login page for any referee

## Technical Implementation

### Routes Added (in `app/routes/admin.py`)
```python
@admin_bp.route('/referee/login', methods=['GET', 'POST'])
def referee_login():
    # Handles both GET (show form) and POST (authenticate)
    # Sets session variables: referee_id, referee_name, referee_username, referee_position, is_referee
    
@admin_bp.route('/referee/interface')
def referee_interface():
    # Protected route - checks session for referee authentication
    # Loads referee data and assigned competition
    # Renders personalized interface
    
@admin_bp.route('/referee/logout')
def referee_logout():
    # Clears session and redirects to login
```

### Session Management
**Session Variables**:
- `referee_id`: Database ID of logged-in referee
- `referee_name`: Full name of referee
- `referee_username`: Username for display
- `referee_position`: Position/role (e.g., "Head Referee")
- `is_referee`: Boolean flag indicating referee authentication

### Database Integration
**Referee Model Fields Used**:
- `id`: Primary key
- `name`: Full name
- `username`: Login username
- `password`: Plain text password (stored for admin viewing)
- `position`: Referee position/role
- `email`: Contact email
- `phone`: Contact phone
- `competition_id`: Foreign key to Competition
- `is_active`: Boolean to enable/disable account
- `last_login`: Timestamp of last successful login
- `competition`: Relationship to Competition model

## User Flow

### For Admins:
1. Navigate to **Referee Settings** page
2. Generate or add referees for a competition
3. View referee credentials in the table
4. Click **"Login"** button to open referee login page in new tab
5. Share credentials with referee or test login themselves

### For Referees:
1. Receive username and password from admin
2. Navigate to `/admin/referee/login`
3. Enter credentials and click "Login"
4. Redirected to personalized referee interface
5. View current attempt information
6. Make decisions (Good Lift / No Lift)
7. Submit decisions
8. Logout when finished

## Security Features
- **Session-based authentication**: Referee must be logged in to access interface
- **Active account check**: Only active referees (`is_active=True`) can log in
- **Session isolation**: Referee sessions are separate from admin sessions
- **Logout functionality**: Secure cleanup of session data

## Integration with Existing Features
- **Timekeeper Integration**: Referee interface polls `/admin/api/current-attempt` for real-time attempt data
- **Timer Display**: Shows synchronized timer from timekeeper
- **Decision Submission**: Uses `/admin/api/referee/decision` endpoint (to be implemented)
- **Competition Assignment**: Displays competition data based on referee's `competition_id`

## API Endpoints Used
- `GET /admin/api/current-attempt`: Fetch current attempt data for display
- `POST /admin/api/referee/decision`: Submit referee decision (placeholder)

## Files Modified

### New Files:
- `app/templates/admin/referee_interface.html` - Individual referee interface template

### Modified Files:
- `app/routes/admin.py` - Added 3 new routes (login, interface, logout)
- `app/templates/admin/referee_settings.html` - Updated `openRefereeLogin()` function

### Existing Files Used:
- `app/templates/admin/referee_login.html` - Login page template (already existed)
- `app/models.py` - Referee model

## Testing Checklist

- [ ] Test referee login with valid credentials
- [ ] Test referee login with invalid credentials
- [ ] Test referee login with inactive account
- [ ] Verify session persistence across page reloads
- [ ] Test logout functionality
- [ ] Verify individual interface loads correct referee data
- [ ] Test decision submission
- [ ] Verify timer displays correctly
- [ ] Test current attempt polling
- [ ] Verify competition information displays correctly
- [ ] Test "Login" button in referee settings page
- [ ] Verify multiple referees can log in simultaneously

## Future Enhancements
1. Password hashing for security
2. Remember me functionality
3. Password reset feature
4. Referee-specific decision history
5. Multi-referee coordination (show other referees' decisions)
6. Mobile-responsive design for referee interface
7. Real-time decision updates using WebSockets
8. Referee performance analytics

## Notes
- Passwords are currently stored in plain text for admin viewing - consider hashing in production
- Referee decisions are submitted but backend endpoint may need full implementation
- Timer synchronization depends on timekeeper broadcasting current attempt data
