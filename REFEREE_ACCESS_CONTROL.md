# Referee Access Control Implementation

## Overview
Implemented role-based access control to restrict referees from accessing admin pages. Referees can only access their login page, individual interface, and logout functionality.

## Implementation Details

### Access Control Mechanism
**File**: `app/routes/admin.py`

#### 1. Whitelist Approach
Created a whitelist of routes that referees are allowed to access:

```python
REFEREE_ALLOWED_ROUTES = [
    'admin.referee_login',           # Login page
    'admin.referee_interface',       # Individual interface
    'admin.referee_logout',          # Logout
    'admin.individual_referee_page', # Alternative interface route
    'admin.referee_login_api',       # Login API endpoint
    'admin.submit_referee_decision'  # Decision submission API
]
```

#### 2. Before Request Hook
Added a `@admin_bp.before_request` decorator to check access on every admin route:

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

## Access Rules

### Referees Can Access:
✅ `/admin/referee/login` - Login page
✅ `/admin/referee/interface` - Individual referee interface
✅ `/admin/referee/logout` - Logout
✅ `/admin/api/referee/*` - Referee-specific API endpoints

### Referees Cannot Access:
❌ `/admin/` - Admin dashboard
❌ `/admin/referee` - Main referee panel (admin version)
❌ `/admin/referee-settings` - Referee management
❌ `/admin/competition-model` - Competition management
❌ `/admin/athletes` - Athlete management
❌ `/admin/timer` - Timekeeper
❌ Any other admin routes

### Admins Can Access:
✅ All routes (including referee routes for testing)

## User Experience

### When a Referee Tries to Access Admin Pages:
1. **Automatic Redirect**: Referee is redirected to their interface
2. **Flash Message**: Shows "Access denied. Referees can only access their individual interface."
3. **Session Preserved**: Referee remains logged in, no logout occurs

### When an Admin Accesses Admin Pages:
1. **Normal Access**: No restrictions, all pages accessible
2. **Can Test Referee Pages**: Admins can access referee login/interface for testing

## Session Variables

### Referee Session:
```python
session['referee_id'] = referee.id
session['referee_name'] = referee.name  
session['referee_username'] = referee.username
session['referee_position'] = referee.position
session['is_referee'] = True  # KEY FLAG for access control
```

### Admin Session:
```python
session['user_id'] = user.id
session['is_admin'] = True
# Note: NO 'is_referee' flag
```

## Testing Access Control

### Test Case 1: Referee Tries to Access Admin Dashboard
**Steps:**
1. Login as a referee at `/admin/referee/login`
2. Try to navigate to `/admin/`
3. **Expected**: Redirected to `/admin/referee/interface` with error message

### Test Case 2: Referee Tries to Access Referee Settings
**Steps:**
1. Login as a referee
2. Try to navigate to `/admin/referee-settings`
3. **Expected**: Redirected to `/admin/referee/interface` with error message

### Test Case 3: Referee Accesses Allowed Pages
**Steps:**
1. Login as a referee
2. Access `/admin/referee/interface`
3. **Expected**: Page loads successfully

### Test Case 4: Admin Accesses All Pages
**Steps:**
1. Login as admin
2. Access any admin page
3. **Expected**: All pages accessible without restriction

### Test Case 5: Unauthenticated User
**Steps:**
1. No login
2. Try to access any admin page
3. **Expected**: Redirected to `/login`

## Security Benefits

1. **Defense in Depth**: Multiple layers of protection
   - Session checking
   - Role-based filtering
   - Before-request hooks

2. **Clear Separation of Concerns**:
   - Admins manage competitions
   - Referees make decisions
   - No overlap in permissions

3. **User Experience**:
   - Clear error messages
   - Automatic redirects
   - No confusion about access levels

4. **Maintainability**:
   - Whitelist approach easy to update
   - Centralized access control logic
   - Clear documentation

## Future Enhancements

1. **Permission Levels**: Add more granular permissions (e.g., head referee vs side referee)
2. **Audit Logging**: Log all access attempts for security review
3. **Time-Based Access**: Restrict referee access to competition time windows
4. **IP Whitelisting**: Additional security for sensitive operations
5. **Two-Factor Authentication**: Enhanced security for referee login

## Troubleshooting

### Issue: Referee can still access admin pages
**Solution**: 
- Check if `is_referee` session variable is set
- Verify route name is not in `REFEREE_ALLOWED_ROUTES`
- Check for typos in endpoint names

### Issue: Admin is blocked from pages
**Solution**:
- Verify `is_admin` session variable is True
- Check that `is_referee` is not set in admin session
- Clear browser cookies and re-login

### Issue: Need to add new referee route
**Solution**:
1. Add route endpoint name to `REFEREE_ALLOWED_ROUTES` list
2. Restart server
3. Test access with referee login

## Code Locations

- **Access Control Logic**: `app/routes/admin.py` (lines 12-40)
- **Referee Routes**: `app/routes/admin.py` (lines 68-118)
- **Login Template**: `app/templates/admin/referee_login.html`
- **Interface Template**: `app/templates/admin/referee_interface.html`

## Related Documentation

- `REFEREE_LOGIN_SYSTEM.md` - Referee authentication system
- `REFEREE_TESTING_GUIDE.md` - Testing guide for referee features
- `SYNCED_TIMER_FEATURE.md` - Timer synchronization

## Summary

The access control system ensures that:
- **Referees** can only access their designated interface
- **Admins** have full system access
- **Unauthenticated users** are redirected to login
- Access violations are logged and handled gracefully

This creates a secure, role-based system that protects sensitive admin functionality while giving referees the focused interface they need.
