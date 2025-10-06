# Referee Access Control Testing

## Current Implementation

The system has **role-based access control** that prevents referees from accessing admin pages even if they know the URLs.

### How It Works

1. **Before Request Hook**: Every request to `/admin/*` routes is checked
2. **Whitelist System**: Only specific routes are allowed for referees
3. **Automatic Redirect**: If a referee tries to access an admin page, they are redirected to their interface

## Allowed Routes for Referees

✅ **Login & Authentication:**
- `/admin/referee/login` - Login page
- `/admin/referee/logout` - Logout

✅ **Interface:**
- `/admin/referee/interface` - Individual referee interface
- `/admin/individual-referee/<id>` - Alternative interface route

✅ **API Endpoints (for interface functionality):**
- `/admin/api/current-attempt` - Get current attempt data
- `/admin/api/clear-attempt` - Clear attempt data
- `/admin/api/referee/decision` - Submit referee decision
- `/admin/api/referee/login` - Login API

## Blocked Routes for Referees

❌ **All Other Admin Routes:**
- `/admin/` - Admin dashboard
- `/admin/referee` - Main referee panel
- `/admin/referee-settings` - Referee management
- `/admin/competition-model` - Competition management
- `/admin/athletes` - Athlete management
- `/admin/timer` - Timekeeper
- `/admin/live-event` - Live event management
- Any other `/admin/*` routes not in the whitelist

## Test Scenarios

### Scenario 1: Referee Tries to Access Admin Dashboard
**Steps:**
1. Login as a referee at `http://127.0.0.1:5000/admin/referee/login`
2. After login, you'll be at `/admin/referee/interface`
3. Manually type in browser: `http://127.0.0.1:5000/admin/`

**Expected Result:**
- ❌ Access denied
- 🔄 Redirected to `/admin/referee/interface`
- 💬 Flash message: "Access denied. Referees can only access their individual interface."

### Scenario 2: Referee Tries to Access Referee Settings
**Steps:**
1. Login as a referee
2. Manually type: `http://127.0.0.1:5000/admin/referee-settings`

**Expected Result:**
- ❌ Access denied
- 🔄 Redirected to `/admin/referee/interface`
- 💬 Error message displayed

### Scenario 3: Referee Tries to Access Timekeeper
**Steps:**
1. Login as a referee
2. Manually type: `http://127.0.0.1:5000/admin/timer`

**Expected Result:**
- ❌ Access denied
- 🔄 Redirected to `/admin/referee/interface`
- 💬 Error message displayed

### Scenario 4: Referee Accesses Allowed Interface
**Steps:**
1. Login as a referee
2. Navigate to `/admin/referee/interface`

**Expected Result:**
- ✅ Access granted
- ✅ Page loads successfully
- ✅ Can see current attempt and make decisions

### Scenario 5: Admin Access (Control Test)
**Steps:**
1. Login as admin at `http://127.0.0.1:5000/login`
2. Try to access any admin page

**Expected Result:**
- ✅ Full access to all admin pages
- ✅ No restrictions

## Session Variables

### Referee Session (set during login):
```python
session['referee_id'] = referee.id
session['referee_name'] = referee.name
session['referee_username'] = referee.username
session['referee_position'] = referee.position
session['is_referee'] = True  # ← KEY FLAG
```

### Admin Session:
```python
session['user_id'] = user.id
session['is_admin'] = True
# Note: NO 'is_referee' flag
```

## Code Implementation

**File:** `app/routes/admin.py`

```python
@admin_bp.before_request
def check_access():
    """Check access permissions before each request"""
    # Allow referee-accessible routes
    if request.endpoint in REFEREE_ALLOWED_ROUTES:
        return None
    
    # Block referees from accessing other admin pages
    if session.get('is_referee'):
        flash('Access denied. Referees can only access their individual interface.', 'error')
        return redirect(url_for('admin.referee_interface'))
    
    # For all other routes, require admin authentication
    if not session.get('is_admin') or not session.get('user_id'):
        return redirect(url_for('login.login'))
    
    return None
```

## Security Features

1. **Server-Side Enforcement**: Access control happens on the server, not client-side
2. **Session-Based**: Uses Flask sessions for authentication
3. **Automatic Redirect**: No error pages, just smooth redirect
4. **Clear Messaging**: Users get clear feedback about access denial
5. **Whitelist Approach**: Only explicitly allowed routes are accessible

## How to Test Right Now

### Test 1: Try to Access Admin as Referee
```
1. Open browser
2. Go to: http://127.0.0.1:5000/admin/referee/login
3. Login with referee credentials (from referee settings page)
4. After login, you're at: /admin/referee/interface
5. Try to manually go to: http://127.0.0.1:5000/admin/
   
Result: You'll be redirected back to /admin/referee/interface with error message
```

### Test 2: Try Multiple Admin URLs
```
After logging in as referee, try these URLs:
- http://127.0.0.1:5000/admin/referee-settings
- http://127.0.0.1:5000/admin/competition-model
- http://127.0.0.1:5000/admin/athletes
- http://127.0.0.1:5000/admin/timer

All should redirect to /admin/referee/interface
```

### Test 3: Verify Interface Works
```
After logging in as referee:
- http://127.0.0.1:5000/admin/referee/interface ✅ Should work
- Should see your name and position
- Should see current attempt if timekeeper started one
- Should be able to make decisions
```

## Troubleshooting

### If Referee Can Still Access Admin Pages:

**Check 1: Session Variables**
- Open browser dev tools → Application → Cookies
- Look for session cookie
- Verify `is_referee` is set to True

**Check 2: Server Running**
- Make sure you restarted the server after code changes
- Check terminal for any errors

**Check 3: Clear Cache**
- Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- Clear cookies and try again

## Summary

✅ **Access Control is Active**
- Referees CANNOT access admin pages by URL
- Automatic redirect to their interface
- Server-side enforcement (secure)

✅ **Referee Experience**
- Clean login page
- Personalized interface
- Clear error messages if they try unauthorized access

✅ **Admin Experience**
- Full access to all pages
- Can test referee login for debugging
- No restrictions

The system is **secure** and prevents referees from accessing admin functionality even if they know the URLs! 🔒
