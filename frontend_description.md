# Frontend Development Description
## 0) Original Text (verbatim, unmodified)

> Front-End Mockup
>
> 1. Admin / Competition Operator View
>    Top Navigation: Competition name, settings, logout.
>
> Left Sidebar
> Current event, Model builder, Live model control, Data Manager, Athletes/notification, Timers, Display control, Network control
>
> Main Panel:
>
> Overview Dashboard: current athlete, current weight, ranking, queue, timer
> Model builder: Editable Competition Model Table (Events, Lifts, Flights, Athletes, Referees).
>
> Buttons for Add / Remove / Edit elements live (FR3).
>
> Search bar to check recorded scores (FR2).
>
> 2. Referee View
>    Full-screen minimal interface for tablets/phones.
>
> Center Buttons: Large colored options like:
>
> Good Lift
>
> No Lift
>
> Header: Current athlete name, weight, attempt number.
>
> Footer: Confirmation of logged result.
>
> 3. TC / Timekeeper View
>    Large Timer Display (start, pause, reset).
>
> Current Athlete Panel: Name, lift type, weight.
>
> Controls:
>
> Buttons for Start / Pause / Reset Timer (FR7).
>
> Dropdown to reorder athlete queue (FR6).
>
> Live Status Feed: Recent actions (attempt result, timer events).
>
> 4. Athlete View
>    Top Banner: Event name, athlete’s profile.
>
> Upcoming Attempts: Card list of weights, attempt order, countdown timers.
>
> Push Notifications: Banner “You’re up in 2 minutes!” (FR10).
>
> History Tab: Previous attempts and scores.
>
> 5. Public Display Board
>    Big-screen scoreboard (projector view).
>
> Main Layout:
>
> Current lifter in large highlight card (name, attempt, weight).
>
> Timer countdown prominently in center.
>
> Right Panel: Ranking / leaderboard table.
>
> Footer Ticker: Next athlete(s) in order queue.
>
> High contrast, bold fonts for easy audience readability (FR11).
>
> 6. Network / QR Access Page
>    QR Code for quick Wi-Fi connection (FR8).
>
> Role-based Links:
>
> sg.com/admin
>
> sg.com/ref
>
> sg.com/athlete
>
> sg.com/display
>
> Clean white page, central QR code, role navigation.

---

## 1) Information Architecture (IA) & Navigation

* Routes

  * `/admin` — Admin / Competition Operator View
  * `/ref` — Referee View
  * `/tc` (or `/timekeeper`) — TC / Timekeeper View
  * `/athlete` — Athlete View
  * `/display` — Public Display Board
  * `/network` (or `/qr`) — Network / QR Access Page

* Global elements

  * Authentication & roles: Admin, Referee, Timekeeper, Athlete, Public (read-only)
  * Global feedback: Toast, Modal, Drawer, Loading/Empty/Error states
  * Theme option for high-contrast (supports FR11 context on `/display`)

---

## 2) Page Structure & Component Inventory (by view)

### 2.1 Admin / Competition Operator View (`/admin`)

* Layout regions

  * Header (Top Navigation): competition name, settings, logout
  * Left Sidebar: current event; model builder; live model control; data manager; athletes/notification; timers; display control; network control
  * Main Panel (sections/tabs)

    * Overview Dashboard: current athlete, current weight, ranking, queue, timer
    * Model builder: editable competition model table (Events, Lifts, Flights, Athletes, Referees)
    * Controls: add/remove/edit elements live (FR3)
    * Utility: search bar to check recorded scores (FR2)
* Suggested components

  * `TopNav`, `SideNav`, `OverviewDashboard`, `CompetitionModelTable`, `EntityActions(FR3)`, `ScoreSearchBar(FR2)`
* Core states

  * Current event/flight selection, queue order, timer linkage, CRUD submission state, search filters/results

### 2.2 Referee View (`/ref`)

* Layout regions

  * Header: current athlete name, weight, attempt number
  * Main: center buttons — Good Lift / No Lift (large colored)
  * Footer: confirmation of logged result
* Suggested components

  * `RefHeader`, `RefDecisionButtons`, `RefResultConfirm`
* Core states

  * Debounced single-submit, offline-protected submission, lock after confirm

### 2.3 TC / Timekeeper View (`/tc`)

* Layout regions

  * Large Timer Display (start, pause, reset)
  * Current Athlete Panel: name, lift type, weight
  * Controls: Start/Pause/Reset Timer (FR7); dropdown to reorder athlete queue (FR6)
  * Live Status Feed: recent actions (attempt result, timer events)
* Suggested components

  * `BigTimer(FR7)`, `CurrentAthleteCard`, `QueueReorderDropdown(FR6)`, `StatusFeed`
* Core states

  * Timer state (running/paused/reset), authoritative time source, queue order, event feed

### 2.4 Athlete View (`/athlete`)

* Layout regions

  * Top Banner: event name, athlete’s profile
  * Upcoming Attempts: card list (weights, attempt order, countdown timers)
  * Push Notifications: “You’re up in 2 minutes!” (FR10)
  * History Tab: previous attempts and scores
* Suggested components

  * `EventBanner`, `UpcomingAttemptsList`, `AthletePushNotice(FR10)`, `HistoryTab`
* Core states

  * Countdown to attempts, prior results, notification delivery

### 2.5 Public Display Board (`/display`)

* Layout regions

  * Main Layout: current lifter highlight card; centered timer countdown; right panel leaderboard; footer ticker with next athlete(s)
  * High contrast, bold fonts (FR11)
* Suggested components

  * `CurrentLifterHighlight`, `CenterCountdown`, `LeaderboardTable`, `NextAthleteTicker`, `HighContrastTheme(FR11)`
* Core states

  * Read-only real-time sync of timer/queue/rankings

### 2.6 Network / QR Access Page (`/network`)

* Layout regions

  * Central QR code for Wi-Fi (FR8)
  * Role-based links: sg.com/admin, sg.com/ref, sg.com/athlete, sg.com/display
  * Clean white page, central QR code, role navigation
* Suggested components

  * `WifiQRCode(FR8)`, `RoleLinksGrid`
* Core states

  * QR validity/refresh, responsive role navigation

---

## 3) Content Mapping (text form; original → location)

* Admin / Competition Operator View

  * Original: “Top Navigation: Competition name, settings, logout.” → Page: `/admin` → Area: Header → Component/Fields: `TopNav.title`, `TopNav.actions`
  * Original: “Current event, Model builder, Live model control, Data Manager, Athletes/notification, Timers, Display control, Network control” → Page: `/admin` → Area: Left Sidebar → Component: `SideNav.items[]`
  * Original: “Overview Dashboard: current athlete, current weight, ranking, queue, timer” → Page: `/admin` → Area: Main → Component: `OverviewDashboard.blocks[]`
  * Original: “Model builder: Editable Competition Model Table (Events, Lifts, Flights, Athletes, Referees).” → Page: `/admin` → Area: Main → Component: `CompetitionModelTable.entities`
  * Original: “Buttons for Add / Remove / Edit elements live (FR3).” → Page: `/admin` → Area: Main → Component: `EntityActions` (FR3)
  * Original: “Search bar to check recorded scores (FR2).” → Page: `/admin` → Area: Main (top utility) → Component: `ScoreSearchBar` (FR2)

* Referee View

  * Original: “Full-screen minimal interface for tablets/phones.” → Page: `/ref` → Area: Layout → Component: `FullscreenContainer`
  * Original: “Center Buttons: Large colored options like: Good Lift / No Lift” → Page: `/ref` → Area: Main → Component: `RefDecisionButtons.options`
  * Original: “Header: Current athlete name, weight, attempt number.” → Page: `/ref` → Area: Header → Component: `RefHeader.fields`
  * Original: “Footer: Confirmation of logged result.” → Page: `/ref` → Area: Footer → Component: `RefResultConfirm.text`

* TC / Timekeeper View

  * Original: “Large Timer Display (start, pause, reset).” → Page: `/tc` → Area: Main → Component: `BigTimer.controls`
  * Original: “Current Athlete Panel: Name, lift type, weight.” → Page: `/tc` → Area: Side/Top → Component: `CurrentAthleteCard.fields`
  * Original: “Buttons for Start / Pause / Reset Timer (FR7).” → Page: `/tc` → Area: Controls → Component: `BigTimer` (FR7)
  * Original: “Dropdown to reorder athlete queue (FR6).” → Page: `/tc` → Area: Controls → Component: `QueueReorderDropdown` (FR6)
  * Original: “Live Status Feed: Recent actions (attempt result, timer events).” → Page: `/tc` → Area: Footer/Side → Component: `StatusFeed.items`

* Athlete View

  * Original: “Top Banner: Event name, athlete’s profile.” → Page: `/athlete` → Area: Header → Component: `EventBanner`
  * Original: “Upcoming Attempts: Card list of weights, attempt order, countdown timers.” → Page: `/athlete` → Area: Main → Component: `UpcomingAttemptsList`
  * Original: “Push Notifications: Banner ‘You’re up in 2 minutes!’ (FR10).” → Page: `/athlete` → Area: Alerts → Component: `AthletePushNotice` (FR10)
  * Original: “History Tab: Previous attempts and scores.” → Page: `/athlete` → Area: Tabs → Component: `HistoryTab`

* Public Display Board

  * Original: “Big-screen scoreboard (projector view).” → Page: `/display` → Area: Layout → Component: `HighContrastTheme` (FR11)
  * Original: “Current lifter in large highlight card (name, attempt, weight).” → Page: `/display` → Area: Main → Component: `CurrentLifterHighlight`
  * Original: “Timer countdown prominently in center.” → Page: `/display` → Area: Center → Component: `CenterCountdown`
  * Original: “Right Panel: Ranking / leaderboard table.” → Page: `/display` → Area: Right → Component: `LeaderboardTable`
  * Original: “Footer Ticker: Next athlete(s) in order queue.” → Page: `/display` → Area: Footer → Component: `NextAthleteTicker`
  * Original: “High contrast, bold fonts for easy audience readability (FR11).” → Page: `/display` → Area: Global style → Component: `HighContrastTheme` (FR11)

* Network / QR Access Page

  * Original: “QR Code for quick Wi-Fi connection (FR8).” → Page: `/network` → Area: Main → Component: `WifiQRCode` (FR8)
  * Original: “Role-based Links: sg.com/admin / sg.com/ref / sg.com/athlete / sg.com/display” → Page: `/network` → Area: Main → Component: `RoleLinksGrid`
  * Original: “Clean white page, central QR code, role navigation.” → Page: `/network` → Area: Layout → Component: `CleanContainer`

---

## 4) Development Plan (from simple to complex)

* Phase 0 — Semantic skeleton (static)

  * Create routes and basic structure (Header/Main/Footer, SideNav on `/admin`, full-screen container on `/ref`, high-contrast shell for `/display`).
  * Place original text as static content in component fields (no interactivity).

* Phase 1 — Base layout & responsive styles

  * Grid/spacing/typography; responsive breakpoints for mobile/tablet/desktop.
  * Ensure large buttons and touch targets on `/ref`; large, legible typography on `/display`.

* Phase 2 — Componentization

  * Extract reusable components: `TopNav`, `SideNav`, `Card`, `Table`, `Tabs`, `BigTimer`, `Feed`, `Ticker`, `QRCode`, `PushBanner`, `SearchBar`.
  * Render `OverviewDashboard` and `CompetitionModelTable` with static data.

* Phase 3 — Basic interactivity

  * `/admin`: local add/remove/edit mock (FR3 prototype); local score filtering (FR2 prototype).
  * `/ref`: decision buttons submit once; footer shows confirmation.
  * `/tc`: front-end timer state and queue reorder (FR7/FR6 prototypes).
  * `/athlete`: local countdowns; banner trigger (FR10 prototype).
  * `/display`: centered countdown, ticker scrolling; static leaderboard.

* Phase 4 — Data wiring & real-time sync

  * Introduce WebSocket/SSE event bus: timer, queue updates, results, scoreboard refresh.
  * `/admin`: connect editable model table CRUD (FR3); connect score search API (FR2).
  * `/tc`: authoritative timer events broadcast to `/admin`, `/display`, `/athlete`, `/ref`.
  * `/athlete`: push banner trigger rules; in-app banner required; browser notifications optional (FR10).
  * `/display`: subscribe read-only; apply high-contrast theme (FR11).

* Phase 5 — State management & auth

  * Central store (e.g., Zustand/Redux): `currentEvent`, `queue`, `timer`, `currentAthlete`, `rankings`, `historyResults`.
  * Role-guarded routes; concurrency control & optimistic updates where safe.

* Phase 6 — Accessibility & performance

  * ARIA labels, focus outlines, keyboard reachability.
  * Bundle-splitting (`/display` standalone), virtualization for large tables, throttled event handling.

* Phase 7 — Testing

  * Unit tests for component render/props/edge cases.
  * E2E for core flows: referee decision, timing, queue reorder, score search, display sync.

---

## 5) Feature Requirements Mapping (FR)

* FR2 — Score search:

  * `/admin` → `ScoreSearchBar` connects to history search API; filter by athlete/lift/time.
* FR3 — Live CRUD:

  * `/admin` → `EntityActions` + `CompetitionModelTable` for add/remove/edit; real-time broadcast.
* FR6 — Queue reorder:

  * `/tc` → `QueueReorderDropdown` persists new order; triggers site-wide sync.
* FR7 — Authoritative timer:

  * `/tc` → `BigTimer` emits start/pause/reset; all views subscribe and reflect.
* FR8 — Wi-Fi QR:

  * `/network` → `WifiQRCode` renders QR for SSID/password provided by backend.
* FR10 — Athlete push:

  * `/athlete` → `AthletePushNotice` shows “You’re up in 2 minutes!” based on queue/time rules.
* FR11 — High contrast display:

  * `/display` → `HighContrastTheme` with large type, high-contrast palette.

---

## 6) Minimal Data & Events

* Entities: `Event`, `Lift`, `Flight`, `Athlete`, `Referee`, `Attempt`, `QueueItem`, `Score`
* Real-time topics:

  * `timer:update` (start/pause/reset/remaining)
  * `queue:update` (reorder/add/remove)
  * `result:logged` (Good/No Lift + attempt payload)
  * `score:changed` (history/rankings refresh)

---

## 7) Component Specs (concise)

* `BigTimer` — state: `running|paused|reset`, `remainingMs`; emits `onStart|onPause|onReset` (FR7)
* `QueueReorderDropdown` — props: `items[]`; emits `queue:update` (FR6)
* `CompetitionModelTable` — editable columns for Events/Lifts/Flights/Athletes/Referees; emits `onAdd|onRemove|onEdit` (FR3)
* `RefDecisionButtons` — two large actions (Good/No); debounced submit; confirmation display
* `LeaderboardTable` — columns: `rank | athlete | weight | attempts`; read-only updates
* `WifiQRCode` — props: `ssid`, `password`, `qrImageUrl` (FR8)
* `AthletePushNotice` — trigger rule: “2 minutes before turn”; dismiss/expire behavior (FR10)

---

## 8) Accessibility & Display Guidance

* `/ref`: large buttons, strong focus states, keyboard equivalents
* `/display`: high-contrast palette, minimal motion; ensure legibility from 3–10 meters
* `/athlete`: screen-reader text for timers and alerts; non-color-only cues

---

## 9) Deliverables

* Routes: `/admin`, `/ref`, `/tc`, `/athlete`, `/display`, `/network`
* Components: listed in Sections 2 & 7
* Documentation: this Markdown spec; component usage notes; event topic reference
* Tests: unit + E2E for critical flows

---

## 10) Execution Checklist

* [ ] Phase 0: skeleton & routes
* [ ] Phase 1: layout & responsive styles
* [ ] Phase 2: componentization (Dashboard / Table / Timer / Feed / Ticker / QR)
* [ ] Phase 3: interactivity prototypes (FR2/FR3/FR6/FR7/FR10/FR11)
* [ ] Phase 4: data wiring & real-time events
* [ ] Phase 5: auth & state management
* [ ] Phase 6: a11y & performance
* [ ] Phase 7: tests & regression
