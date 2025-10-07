# Quick Start Guide - New Features

## 🚀 Getting Started

### 1. Restart Flask Server
```bash
cd /Users/sarthaksaini/Downloads/capstone/SmallGoods-Competition-app
python3 run.py
```

---

## ✅ Feature 1: Technical Violations

### For Referees:
1. Go to: `http://127.0.0.1:5000/admin/referee/login`
2. Login with referee credentials
3. **See violations section** below decision buttons (always visible, yellow background)
4. **Check any violations** (e.g., Press Out, Elbow Touch)
5. **Click decision button** (0-5) → Submits with violations!

### For Admins:
1. Go to: `http://127.0.0.1:5000/admin/decision-results`
2. **See "VIOLATIONS" column** in results table
3. Click **"Edit"** to modify violations
4. Violations show as comma-separated text (e.g., "Press Out, Knee Touch")

### 8 Violation Types:
- Press Out
- Elbow Touch  
- Knee Touch
- Bar Pressed Down
- Incomplete Lockout
- Foot Movement
- Early Drop
- Other Technical

---

## 🔍 Feature 2: Athlete Name Filter

### How to Use:
1. Go to: `http://127.0.0.1:5000/admin/decision-results`
2. **Select Competition** → Dropdowns populate
3. **Select Athlete Name** → Shows only that athlete's decisions
4. **Combine with Event/Flight** → Further filter results
5. Click **"Load Results"** → See filtered data

### Filter Options:
```
📊 Competition (Required)
   ↓
📅 Event (Optional)
   ↓
✈️ Flight (Optional)
   ↓
👤 Athlete Name (Optional) ← NEW!
```

### Example Workflows:

**Find all decisions for "sangram Saini":**
1. Competition: SG-Test
2. Athlete: sangram Saini
3. Load Results ✅

**Find athlete decisions in specific event:**
1. Competition: SG-Test
2. Event: weight
3. Athlete: sangram Saini
4. Load Results ✅

**Find athlete decisions in specific flight:**
1. Competition: SG-Test
2. Flight: Flight A
3. Athlete: Sarthak Saini
4. Load Results ✅

---

## 🧪 Quick Test

### Test Violations:
```
1. Login as referee (ID: 7)
2. Check "Incomplete Lockout" 
3. Click decision "2"
4. Go to Decision Results
5. Verify "Incomplete Lockout" shows in table ✅
```

### Test Athlete Filter:
```
1. Go to Decision Results
2. Select "SG-Test" competition
3. Select "sangram Saini" athlete
4. Click "Load Results"
5. Verify only sangram Saini decisions show ✅
```

---

## 📝 Documentation

- **Violations Guide:** `VIOLATIONS_TESTING_GUIDE_v2.md`
- **Athlete Filter:** `ATHLETE_FILTER_FEATURE.md`
- **Full Summary:** `SESSION_SUMMARY.md`

---

## 🐛 Troubleshooting

### Violations not showing in results?
- Hard refresh browser (Cmd+Shift+R)
- Check browser console for errors (F12)
- Verify violations were checked before clicking decision

### Athlete dropdown empty?
- Make sure competition has existing decisions
- Check if decisions have athlete_name populated
- Try different competition

### Server errors?
- Restart Flask server
- Check terminal for error messages
- Verify database migration applied: `flask db upgrade`

---

## 💻 Developer Commands

```bash
# Restart server
python3 run.py

# Check database
python3 -c "
from app import create_app, db
from app.models import RefereeDecisionLog
app = create_app()
with app.app_context():
    decisions = RefereeDecisionLog.query.order_by(
        RefereeDecisionLog.timestamp.desc()
    ).limit(5).all()
    for d in decisions:
        print(f'{d.athlete_name}: {d.decision_label} - {d.violations}')
"

# Git commit
git add .
git commit -m "feat: Add violations tracking and athlete filtering"
git push origin fix/timer-state-persistence
```

---

## 📊 What Changed?

### Database:
- ✅ New `violations` field in `referee_decision_log` table

### UI Updates:
- ✅ Violations section on referee page (yellow box with checkboxes)
- ✅ Violations column in Decision Results table
- ✅ Athlete Name dropdown filter
- ✅ Violations field in edit modal

### API Updates:
- ✅ `/admin/api/referee-decision` accepts violations array
- ✅ `/admin/api/decision-results` filters by athlete name
- ✅ `/admin/api/decision-filters/<id>` returns athlete names

---

## ✨ Key Features

### Violations:
- ✅ Always visible (no hiding/showing)
- ✅ Optional (can submit without violations)
- ✅ Works with ALL decisions (0-5)
- ✅ Stored as comma-separated text
- ✅ Editable in Decision Results

### Athlete Filter:
- ✅ Alphabetically sorted
- ✅ Combines with Event/Flight filters
- ✅ "All athletes" shows everything
- ✅ Instant filtering on Load Results

---

## 🎯 Success!

Both features are ready to use! Just restart the server and test:
1. ✅ Technical Violations tracking
2. ✅ Athlete Name filtering

**Enjoy!** 🎉
