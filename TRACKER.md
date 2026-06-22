# StudyBudConnect — MVP-1 Tracker

## Stack
- Frontend: React + Vite + ShadCN UI + React Hook Form + Zod + Zustand
- Backend: Node.js + Express + MongoDB (Mongoose) + Socket.io
- Auth: JWT + bcrypt + Google OAuth
- Real-time: Socket.io

## Structure
```
StudyBudConnect/
├── client/     (React + Vite)
└── server/     (Node.js + Express)
```

---

## Phase 0 — Scaffolding ✅ COMPLETE
- [x] TRACKER.md created
- [x] server/ scaffolded (package.json, folder structure)
- [x] client/ scaffolded (Vite + React)
- [x] ShadCN initialized in client/ (Tailwind v4 + ShadCN)
- [x] Components installed: button, input, label, card, form, select, badge, avatar, separator, scroll-area, dialog, sheet, tooltip, dropdown-menu, textarea, checkbox, sidebar, command, popover, sonner, radio-group, tabs
- [x] Zustand + React Hook Form + Zod + axios + socket.io-client installed
- [x] Root package.json with `npm run dev` (concurrently)

## Phase 1 — Backend: Auth & Models ✅ COMPLETE
- [x] MongoDB connection setup (config/db.js)
- [x] User model — name, email, password, googleId, avatar, courses[], learningStyle, availability[], accessibilityNeeds[], communicationPrefs[], profileComplete
- [x] Group model — name, course, description, members[], createdBy, isPrivate
- [x] Message model — group, sender, content, timestamps
- [x] Invitation model — group, inviter, invitee, status (pending/accepted/declined)
- [x] Auth routes: POST /register, /login, GET /me, GET+callback /google
- [x] JWT middleware (protect) + signToken helper
- [x] Passport.js Google OAuth strategy (config/passport.js)
- [x] Profile routes: GET/PUT /api/users/me
- [x] Matching route: GET /api/users/matches (rule-based: shared courses + overlapping availability)
- [x] User search: GET /api/users/search?q=
- [x] Group routes: GET /api/groups, POST /api/groups, GET /api/groups/mine, GET /api/groups/:id, POST /api/groups/:id/join
- [x] Group detail includes auto-generated accessibilityHints[]
- [x] Invitation routes: POST /api/invitations, GET /api/invitations/mine, PUT /api/invitations/:id
- [x] Message routes: GET /api/messages/:groupId
- [x] Socket.io: join/leave room, send_message (persisted), new_message broadcast, typing indicators, online_users map

## Phase 2 — Frontend: Auth Pages ✅ COMPLETE
- [x] AuthStore (Zustand + persist) — user, token, setAuth, setUser, logout, fetchMe
- [x] SocketStore (Zustand) — connect, disconnect, onlineUsers
- [x] Login page — email/password form + Google OAuth button + error handling
- [x] Register page — name/email/password/confirm + Google OAuth button
- [x] GoogleSuccessPage — reads token from query param, calls fetchMe, redirects
- [x] Axios instance with Bearer token interceptor + 401 redirect
- [x] Zod schemas on all forms

## Phase 3 — Frontend: Layout & Navigation ✅ COMPLETE
- [x] AppLayout — sidebar + topbar, protected (redirects to /login if no token)
- [x] Sidebar: BookOpen logo, Profile/Discover/My Groups/Chat nav with active state
- [x] Topbar: page title + avatar dropdown (email + logout)
- [x] Socket auto-connect on mount, disconnect on unmount

## Phase 4 — Frontend: Profile Setup ✅ COMPLETE
- [x] ProfilePage — avatar display, 4 card sections
- [x] Name field (Input)
- [x] Course tags — CreatableTagInput (type + Enter/comma → badge; Backspace removes)
- [x] Learning style — ShadCN Select (5 options)
- [x] Availability — AvailabilityPicker (Mon–Sun × Morning/Afternoon/Evening checkbox grid)
- [x] Accessibility needs — MultiSelectCheckbox (5 options)
- [x] Communication prefs — MultiSelectCheckbox (4 options)
- [x] React Hook Form + Zod, PUT /api/users/me, toast feedback

## Phase 5 — Frontend: Discover Groups ✅ COMPLETE
- [x] DiscoverPage — search bar, Find Matches button, group cards grid
- [x] GroupCard — name, course badge, member count, View/Join actions
- [x] GroupDetailDialog — member list, accessibilityHints display, Join button
- [x] Create a Group button → /app/groups/create
- [x] Empty states for no results

## Phase 6 — Frontend: Create Group ✅ COMPLETE
- [x] CreateGroupPage
- [x] Group name + course + description inputs
- [x] MemberSearch — live search /api/users/search, badge list of selected users
- [x] POST /api/groups with inviteeIds, redirect to /app/groups

## Phase 7 — Frontend: My Groups ✅ COMPLETE
- [x] MyGroupsPage — grid of joined/created groups
- [x] Member avatar stack (max 5 + overflow count)
- [x] "Open chat" button → /app/chat?group=ID
- [x] Skeleton loading state + empty state

## Phase 8 — Frontend: Chat ✅ COMPLETE
- [x] ChatPage — split-panel layout (group list left, messages right)
- [x] Group list with search filter, online indicator dot
- [x] MessageBubble — own (right, primary bg) vs others (left, muted bg)
- [x] Socket.io join_group/leave_group on group switch
- [x] Real-time send_message / new_message
- [x] Typing indicators with animated dots (aria-live)
- [x] Auto-scroll to latest message
- [x] Enter to send, Shift+Enter for newline
- [x] Skeleton loading for messages

## Phase 9 — Accessibility ✅ IMPLEMENTED
- [x] ARIA labels on all interactive elements
- [x] aria-live on typing indicator and message list
- [x] aria-current="page" on active nav link
- [x] role="listitem" on message bubbles, role="list" on message thread
- [x] role="listbox" on user search dropdown
- [x] role="group" on AvailabilityPicker and MultiSelectCheckbox
- [x] focus-visible:ring-2 on all keyboard-interactive elements
- [x] Semantic HTML (header, nav, aside, main, time)
- [x] aria-label on avatars, buttons, inputs throughout
- [x] Accessibility hints auto-generated per group based on member needs
- [ ] axe-core runtime audit (requires running app) — run after deployment

## Phase 10 — Integration & Env ✅ COMPLETE
- [x] server/.env.example (PORT, MONGO_URI, JWT_SECRET, JWT_EXPIRES_IN, CLIENT_URL, GOOGLE_*)
- [x] client/.env.example
- [x] CORS configured for CLIENT_URL
- [x] Vite proxy: /api → localhost:5000, /socket.io → ws localhost:5000
- [x] Root npm run dev runs both client + server via concurrently

---

## How to run

### 1. Server setup
```bash
cd server
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secret, Google OAuth credentials
npm run dev
```

### 2. Client setup
```bash
cd client
npm run dev
```

### 3. Or both at once (root)
```bash
npm run dev
```

App runs at http://localhost:5173, API at http://localhost:5000

---

## Notes
- Google OAuth: requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in server/.env
- Availability UI: day × timeslot checkbox grid stored as `{ Mon: [morning, evening], Tue: [afternoon] }` shape
- Course tags: stored as string array on User + Group models
- Accessibility accommodations: auto-generated hints shown in group detail based on members' accessibility needs
