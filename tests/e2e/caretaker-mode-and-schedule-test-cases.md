# Caretaker Mode + Schedule E2E Test Cases

## Preconditions
- Owner account exists and can log in.
- Caretaker account exists and has an approved caretaker relationship with owner.
- App is configured to the active backend environment.

## 1) Mode Switching (Owner ↔ Caretaker)
1. Log in as caretaker user.
2. Open Profile screen.
3. Confirm `Switch Mode` section shows both `My Account` and `Caretaker Mode`.
4. Tap `Caretaker Mode`, select patient from modal.
5. Verify top banner text shows: `You are acting as caretaker for [Patient Name]`.
6. Tap `Switch back to My Account`.
7. Verify banner disappears and mode returns to owner context.

Expected:
- Mode changes without app crash.
- Correct patient context is reflected immediately in healthcare screens.

## 2) Patient Selection
1. Prepare caretaker with multiple approved patients.
2. Open `Caretaker Mode` selection modal.
3. Select patient A and open Healthcare > Schedules.
4. Create schedule for patient A.
5. Switch to patient B and open Schedules list.

Expected:
- Patient A schedule must not appear under patient B.
- List reflects selected patient only.

## 3) App Restart Persistence
1. Switch to caretaker mode for a selected patient.
2. Fully close app.
3. Re-open app and log in session restore path.
4. Open Profile and Healthcare screens.

Expected:
- Previous mode and selected patient remain active.
- Caretaker banner is visible after restart.

## 4) Logout Reset
1. While in caretaker mode, tap Logout.
2. Log in again with same account.
3. Open Profile screen.

Expected:
- Mode resets to `My Account` (owner mode).
- No stale patient context remains after fresh login.

## 5) Caretaker Creating Schedule
1. Enter caretaker mode for assigned patient.
2. Open Healthcare > Schedules.
3. Create schedule with:
   - medicine name
   - dosage
   - two times
   - repeat type `daily`
4. Open schedule list.

Expected:
- API call succeeds (201).
- New schedule is visible in list.
- Reminder generation is handled by backend schedule logic.

## 6) Token Expiry + Refresh
1. Use an expired access token to call protected schedule API.
2. Confirm backend returns `401 Invalid or expired token`.
3. Trigger refresh with valid refresh token.
4. Retry protected schedule API.
5. Trigger refresh with invalid refresh token.

Expected:
- Expired token call fails with 401.
- Valid refresh returns new access token and retried call succeeds.
- Invalid refresh token returns 401 and app should force logout.
