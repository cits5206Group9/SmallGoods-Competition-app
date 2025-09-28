# Athlete Page – Test Guide

## Prerequisite Setup
Before running the test cases, make sure the system has a competition, an athlete, and a flight defined.  

1. Open the **Admin page**: [http://127.0.0.1:5000/admin/](http://127.0.0.1:5000/admin/)  
2. Define the initial settings:  
   1. **Competition Model Editor** → Create a new competition model.  
   2. **Athletes Management** → Add a new athlete.  
      - ⚠️ Use any details you like, but **set the email to `harry@email.com`** (required for testing, since user authentication is not yet completed).  
   3. **Flights Management** → Assign the created athlete to a flight.  
3. Open the **Athlete page**: [http://127.0.0.1:5000/athlete/](http://127.0.0.1:5000/athlete/)  

---

## 1. Profile Details
**Goal:** Verify that the athlete’s profile displays the correct information.  
**Preconditions:** An athlete record exists in the database (e.g., Harry, gender = Male, Age = 22).  

**Steps:**  
1. Navigate to the Athlete Dashboard page.  
2. View the Profile panel in the left column.  
3. Compare displayed profile fields (Name, Team, Gender, Bodyweight, etc.) with the values stored in the database in 'Athlete' table.  

**Expected Results:**  
- All profile fields (name, team, gender, bodyweight, etc.) match exactly with the database record.  
- If a field is missing in the DB, the UI shows a placeholder (None).  

---

## 2. Competition & Event Details
**Goal:** Validate that competition and event information matches the database.  
**Preconditions:** A competition and event are created and the athlete is registered for the event and flight.  

**Steps:**  
1. On the Athlete Dashboard, view the central panel (Competition Detail).  
2. Confirm that the competition name, date, events are displayed.  
3. Check the list of registered events for the athlete.  

**Expected Results:**  
- Competition name, date, event names are correct and pulled from the Competition table.  
- Registered events appear under the Event section.

---

## 3. AthleteEntry & Attempt Records
**Goal:** Confirm backend records are created and UI reflects them.  
**Preconditions:** AthleteEntry and Attempt records exist for the event.

**Steps:**  
1. Ensure AthleteEntry rows exist in the database (with correct ids, orders, lift_type, reps, attempt/break time).
2. Ensure Attempt rows exist in the database (with correct ids, weights)
3. On the Athlete Dashboard, check the Attempts section.  
4. Verify that all attempts (Attempt 1, 2, 3, etc.) appear as it is defined in Competition config.  

**Expected Results:**  
- Each attempt created in the database is shown in the UI with correct details (attempt number, weight, reps).  
- No extra attempts appear beyond those in the database.  

---

## 4. Update Reps per Attempt
**Goal:** Validate updating reps input and ensure data sync + validation.  
**Preconditions:** AthleteEntry row exists with default reps from Competition config.  

**Steps:**  
1. In the Event detail section, edit the `Reps per Attempt` input.  
2. Save. 
3. Check the database for the updated reps value at `reps` column in AthleteEntry table.  
4. Check the UI refreshes to show the new reps value.  
5. Enter a reps value higher than the allowed maximum in Competition config.  

**Expected Results:**  
- Database updates with the new reps value.  
- Athlete Dashboard immediately shows the updated reps.  
- Validation prevents invalid reps (error message shown, DB unchanged).  

---

## 5. Update Opening Weight
**Goal:** Verify updating opening weight works and syncs with Attempt 1.  
**Preconditions:** AthleteEntry has `opening_weights` set for a lift.  

**Steps:**  
1. Change the opening weight for the athlete’s event.  
2. Save the change.  
3. Inspect the database `AthleteEntry.opening_weights`.  
4. Inspect Attempt 1 in the UI.  

**Expected Results:**  
- Database `opening_weights` updates with the new value.  
- Attempt 1’s displayed weight matches the new opening weight.  
- Change is persistent on page reload.  

---

## 6. Update Attempt Weights
**Goal:** Confirm updating attempt weights works with validation.  
**Preconditions:** Attempt records exist.  

**Steps:**  
1. Change the weight for Attempt 2.  
2. Save and check the database `Attempt.requested_weight`.  
3. Try setting Attempt 2’s weight lower than Attempt 1’s.  

**Expected Results:**  
- Database updates with valid changes.  
- Attempt weights display the new value in the UI.  
- Validation prevents invalid updates (error shown, DB unchanged).  

---

## 7. Timer Synchronization (Timekeeper Integration)
**Goal:** Ensure timer actions in Timekeeper page sync with Athlete page.  
**Preconditions:** Athlete is assigned to a flight; competition has configured attempt/break timers.  

**Steps:**  
1. Open the Timekeeper page and select the competition + athlete (`Harry`).  
2. Start the break timer for the athlete.  
3. Check that the Athlete Dashboard “Next Attempt Timer” starts counting down.  
4. Pause, resume, and reset the break timer in the Timekeeper page.  
5. Observe the Athlete Dashboard timer after each action.  

**Expected Results:**  
- Athlete Dashboard “Next Attempt Timer” runs in sync with Timekeeper’s break timer.  
- Pause/resume/reset in Timekeeper reflects immediately (within ~1s) on Athlete page.  
- No desynchronization occurs between the two pages.  

---

## 8. Navigation Bar
**Goal:** Test navigation links on the Athlete page.  
**Preconditions:** Navbar contains link to Competition Display view.  

**Steps:**  
1. On the Athlete page, click the navigation bar link in the header.  
2. Observe the redirect.  

**Expected Results:**  
- User is redirected to the Competition Display view.  
- The page loads correctly without error.  