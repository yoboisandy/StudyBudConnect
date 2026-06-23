# StudyBudConnect — Technical Overview

> **Purpose:** This document is written for developers who are new to the codebase. It explains the project architecture, the technology choices behind each feature, and how every major MVP-1 capability is actually implemented in the code — so you can get productive without having to reverse-engineer the whole repo.

---

## Table of Contents

1. [Project Architecture](#1-project-architecture)
2. [Repository Structure](#2-repository-structure)
3. [Package Inventory](#3-package-inventory)
4. [Authentication & Session Management](#4-authentication--session-management)
5. [User Profiles & Compatibility Matching](#5-user-profiles--compatibility-matching)
6. [Real-Time Chat](#6-real-time-chat)
7. [Notification System](#7-notification-system)
8. [File & Media Sharing](#8-file--media-sharing)
9. [Group Management](#9-group-management)
10. [Accessibility — Screen Reader TTS & Accommodation Hints](#10-accessibility--screen-reader-tts--accommodation-hints)
11. [Frontend State Management](#11-frontend-state-management)
12. [API Layer & Request Flow](#12-api-layer--request-flow)
13. [Data Models Reference](#13-data-models-reference)

---

## 1. Project Architecture

StudyBudConnect is a **MERN stack** application (MongoDB, Express, React, Node.js) with a real-time layer added via **Socket.io**.

```
Browser (React + Vite)
        │  HTTP/REST  │  WebSocket (Socket.io)
        ▼             ▼
   Express server  ──────────  Socket.io server
        │                           │
        ▼                           ▼
   MongoDB (Mongoose)       In-memory onlineUsers Map
        │
        ▼
   /uploads  (static files served by Express)
```

The Express HTTP server and the Socket.io server share the **same Node.js `http.Server` instance**, so they both run on the same port (default `5001`). The frontend dev server runs on port `5173` (Vite) and proxies all `/api` and `/uploads` requests to port `5001`.

---

## 2. Repository Structure

```
studybudconnect/
├── package.json              # root — runs both apps with concurrently
├── server/
│   ├── index.js              # Express + HTTP server entry point
│   ├── config/
│   │   ├── db.js             # Mongoose connection
│   │   └── passport.js       # Google OAuth strategy
│   ├── middleware/
│   │   ├── auth.js           # JWT protect middleware + signToken helper
│   │   └── upload.js         # Multer config (disk storage, 5 MB limit, MIME allowlist)
│   ├── models/
│   │   ├── User.js           # User schema with bcrypt hooks
│   │   ├── Group.js          # Group schema (members, joinRequests, removedMembers)
│   │   ├── Message.js        # Message schema with attachments sub-document
│   │   ├── Notification.js   # Notification schema with 7 typed events
│   │   └── Invitation.js     # Direct invitation model
│   ├── controllers/          # Business logic, one file per resource
│   ├── routes/               # Express routers, one file per resource
│   ├── services/
│   │   └── notificationService.js  # Singleton: DB write + Socket.io push
│   ├── socket/
│   │   └── index.js          # All Socket.io event handlers
│   └── uploads/              # Uploaded files stored here (git-ignored)
└── frontend/
    ├── vite.config.ts        # Proxy: /api and /uploads → localhost:5001
    ├── src/
    │   ├── lib/
    │   │   ├── api.ts        # Axios instance with JWT interceptor + 401 redirect
    │   │   └── utils.ts      # cn() — merges tailwind classes
    │   ├── stores/
    │   │   ├── authStore.ts        # Zustand + persist — user & JWT token
    │   │   ├── socketStore.ts      # Zustand — socket instance & online users
    │   │   └── notificationStore.ts # Zustand — notification list & unread count
    │   ├── pages/
    │   │   ├── auth/         # LoginPage, RegisterPage, GoogleSuccessPage
    │   │   └── app/          # ChatPage, ProfilePage, DiscoverPage, MyGroupsPage, CreateGroupPage
    │   └── components/
    │       ├── layout/       # AppLayout — sidebar nav
    │       ├── shared/       # ChatInfoModal, NotificationPanel, reusable pickers
    │       └── ui/           # shadcn/ui primitives (Button, Dialog, Tabs, etc.)
```

---

## 3. Package Inventory

### Backend (`server/`)

| Package | Purpose |
|---|---|
| `express` | HTTP server, routing, middleware pipeline |
| `mongoose` | MongoDB ODM — schema definition, validation, queries |
| `socket.io` | WebSocket server for real-time chat and push notifications |
| `jsonwebtoken` | Sign and verify JWT access tokens |
| `bcryptjs` | Hash user passwords before storage; compare on login |
| `passport` + `passport-google-oauth20` | Google OAuth 2.0 flow (authorization code → user upsert) |
| `multer` | Multipart form-data parsing; saves uploaded files to disk |
| `cors` | Allow cross-origin requests from the Vite dev server |
| `dotenv` | Load `.env` values into `process.env` |
| `express-validator` | Input validation on auth routes |
| `nodemon` (dev) | Auto-restart server on file changes |

### Frontend (`frontend/`)

| Package | Purpose |
|---|---|
| `react` + `react-dom` v19 | UI rendering |
| `vite` + `@vitejs/plugin-react` | Build tool, HMR dev server, path aliases |
| `react-router-dom` v7 | Client-side routing (`<BrowserRouter>`, `useNavigate`, `useParams`) |
| `socket.io-client` | Browser WebSocket client — mirrors events from `socket.io` server |
| `zustand` | Lightweight global state (auth, socket, notifications) with `persist` middleware |
| `axios` | HTTP client with request/response interceptors for JWT injection and 401 handling |
| `react-hook-form` + `@hookform/resolvers` | Form state management and validation without re-renders |
| `zod` | Schema-first validation; fed into `react-hook-form` via `zodResolver` |
| `tailwindcss` v4 | Utility-first CSS |
| `shadcn/ui` + `radix-ui` | Unstyled accessible component primitives (Dialog, Tabs, AlertDialog, etc.) |
| `lucide-react` | Icon set (Info, Volume2, Paperclip, Bell, Crown, LogOut, …) |
| `sonner` | Toast notifications |
| `next-themes` | Dark/light theme toggle |
| `date-fns` | Date formatting in message timestamps |

---

## 4. Authentication & Session Management

### How it works

StudyBudConnect supports two auth paths: **email/password** and **Google OAuth**. Both produce the same JWT which is stored in `localStorage` and sent as a `Bearer` header on every API request.

### Email/Password flow

```
RegisterPage → POST /api/auth/register
                    │
                    ▼
            User.create({ name, email, password })
            // password hashed by Mongoose pre-save hook:
            // userSchema.pre("save", () => bcrypt.hash(this.password, 12))
                    │
                    ▼
            signToken(user._id)  →  jwt.sign({ id }, JWT_SECRET, { expiresIn: "7d" })
                    │
                    ▼
            Response: { token, user }
```

On login, `user.matchPassword(entered)` calls `bcrypt.compare()` against the stored hash. The password field has `select: false` in the schema so it is never returned in regular queries — it must be explicitly opted-in with `.select("+password")`.

**Key files:** `server/controllers/authController.js`, `server/middleware/auth.js`, `server/models/User.js`

### Google OAuth flow

```
LoginPage → GET /api/auth/google
               │  (redirects to Google)
               ▼
         Google OAuth consent screen
               │  (redirects back with code)
               ▼
         GET /api/auth/google/callback
               │
               ▼
         passport-google-oauth20 strategy:
           1. findOne({ googleId })           — returning user
           2. findOne({ email })              — link existing account
           3. User.create({ googleId, ... })  — new user
               │
               ▼
         googleCallback() → signToken() → redirect to
         /auth/google/success?token=<jwt>
               │
               ▼
         GoogleSuccessPage.tsx reads ?token param,
         calls authStore.setAuth(), then navigates to /app/chat
```

**Key files:** `server/config/passport.js`, `server/controllers/authController.js`, `frontend/src/pages/auth/GoogleSuccessPage.tsx`

### JWT on the frontend

`api.ts` (Axios instance) adds `Authorization: Bearer <token>` to every request via an interceptor. If any response returns `401` the interceptor clears `localStorage` and redirects to `/login` automatically.

The token is also forwarded to the Socket.io handshake:
```typescript
// socketStore.ts
const socket = io({ auth: { token }, transports: ["websocket"] })
```
The Socket.io server verifies this token in its `io.use()` middleware, attaches `socket.user`, and rejects the connection if invalid.

---

## 5. User Profiles & Compatibility Matching

### Profile fields

Each `User` document stores:

```javascript
courses:           [String]       // e.g. ["CS732", "MATH201"]
learningStyle:     String         // "visual" | "auditory" | "reading-writing" | "kinesthetic" | "mixed"
availability:      [{ day, slots }]  // slots: "morning" | "afternoon" | "evening"
accessibilityNeeds:[String]       // "screen-reader" | "captions" | "keyboard-nav" | "high-contrast" | "none"
communicationPrefs:[String]       // "text-chat" | "voice" | "video" | "async"
profileComplete:   Boolean
```

### Profile edit flow

The `ProfilePage` has two modes controlled by `isEditing` state:
- **View mode** (default): renders all fields as read-only cards and badges
- **Edit mode**: shows a `react-hook-form` form validated with `zod`

On save, `PUT /api/users/me` updates the document and calls `setUser(data)` in `authStore` so the UI reflects changes immediately without a page reload. `setIsEditing(false)` returns to view mode.

**Key files:** `frontend/src/pages/app/ProfilePage.tsx`, `server/controllers/userController.js`

### Compatibility matching

The **Discover** page (`GET /api/groups?course=<query>`) filters groups by course using a case-insensitive regex. The backend populates member details, so the frontend can display how many members are in each group and whether the user's courses overlap — no dedicated matching algorithm is required at MVP-1; the filtering is done via query parameter.

**Key files:** `frontend/src/pages/app/DiscoverPage.tsx`, `server/controllers/groupController.js → getGroups`

---

## 6. Real-Time Chat

This is the most technically complex feature. It combines REST (history load) with Socket.io (live delivery) and optimistic UI.

### Architecture

```
User A types a message
        │
        ▼
ChatPage.tsx: sendMessage()
  1. Upload any attachments via POST /api/messages/upload (REST)
  2. Immediately append a temp message to local state (optimistic UI)
     { _id: "temp-<timestamp>", sender: currentUser, content, attachments }
  3. socket.emit("send_message", { groupId, content, attachments[] })
        │
        ▼
server/socket/index.js: "send_message" handler
  1. Verify user is a member of the group
  2. Message.create({ group, sender, content, attachments })
  3. message.populate("sender", "name email avatar")
  4. io.to(groupId).emit("new_message", message.toJSON())
        │
        ▼  (broadcast to ALL members in the room, including sender)
ChatPage.tsx: socket.on("new_message", onMessage)
  - If message _id already exists → skip (duplicate guard)
  - If message is from current user and a temp placeholder exists → replace it
  - Otherwise append to messages array
```

### Why optimistic UI?

File uploads can take 1–3 seconds. Without optimistic updates the sender would see no message until the round-trip completed, making the chat feel laggy. The placeholder is replaced when the server echo arrives (matched by sender `_id` since the temp message has a fake `_id`).

### Room management

Each group has a Socket.io **room** named by its MongoDB `_id`. When a user opens a group chat:
```typescript
socket.emit("join_group", groupId)
```
When they navigate away:
```typescript
socket.emit("leave_group", groupId)
```
The server calls `socket.join(groupId)` / `socket.leave(groupId)`. Only sockets in the room receive `new_message` events for that group.

### Online presence

A server-side `Map<userId, socketId>` tracks connected users. On every connect/disconnect the server broadcasts the full list:
```javascript
io.emit("online_users", [...onlineUsers.keys()])
```
The frontend `socketStore` stores `onlineUsers: string[]` so any component can look up whether a user is online.

### Typing indicators

```javascript
// sender → server
socket.emit("typing", { groupId })
socket.emit("stop_typing", { groupId })

// server → other room members (not sender)
socket.to(groupId).emit("user_typing", { userId, name })
socket.to(groupId).emit("user_stop_typing", { userId })
```
The chat footer shows "_Name_ is typing…" with a three-dot bounce animation driven by pure CSS.

### Loading history

On group open, `GET /api/messages/:groupId` fetches the last 50 messages (sorted by `createdAt`) already populated with sender details. These are set into state before the socket listener is attached.

**Key files:** `frontend/src/pages/app/ChatPage.tsx`, `server/socket/index.js`, `server/controllers/messageController.js`

---

## 7. Notification System

### Architecture

```
Any server-side event (join, leave, kick, invite accept…)
        │
        ▼
notificationService.notify({ recipient, type, title, body, data })
  1. Notification.create(...)  → persisted in MongoDB
  2. _io.to(`user:${recipientId}`).emit("notification", notif)
        │
        ▼  (real-time push via personal Socket.io room)
frontend/src/stores/notificationStore.ts
  socket.on("notification", (n) => addNotification(n))
        │
        ▼
NotificationPanel.tsx — Bell icon badge increments, panel shows new item
```

Every user is joined to a **personal room** named `user:<userId>` on socket connect. This means the server can push to a specific user without knowing their socket ID.

### Notification types

| Type | Triggered when |
|---|---|
| `group_invite` | User is invited to join a group |
| `invite_accepted` | Invitee accepts an invitation |
| `invite_declined` | Invitee declines an invitation |
| `join_request` | Someone requests to join a private group (sent to owner) |
| `join_request_accepted` | Owner approves a join request |
| `join_request_declined` | Owner declines a join request |
| `member_removed` | Admin removes a member from a group |

### Frontend notification store

```typescript
// notificationStore.ts
{
  notifications: Notification[]   // full list, newest first
  unreadCount: number             // drives the badge on the bell icon
  addNotification(n)              // called by socket listener
  markAllRead()                   // PUT /api/notifications/read-all
  fetchNotifications()            // GET /api/notifications (on mount)
}
```

`NotificationPanel.tsx` is a `<Sheet>` (slide-in drawer) triggered by the bell icon. It renders each notification as a card with a `read` indicator, timestamp, and action link.

**Key files:** `server/services/notificationService.js`, `server/models/Notification.js`, `frontend/src/stores/notificationStore.ts`, `frontend/src/components/shared/NotificationPanel.tsx`

---

## 8. File & Media Sharing

### Upload flow

Files are uploaded **before** the message is sent, one at a time via parallel `Promise.all`:

```typescript
// ChatPage.tsx — sendMessage()
const uploaded = await Promise.all(
  pendingFiles.map((pf) => {
    const form = new FormData()
    form.append("file", pf.file)
    return api.post("/messages/upload", form).then(({ data }) => data)
  })
)
// uploaded = [{ url, originalName, mimetype, size, fileType }, ...]
socket.emit("send_message", { groupId, content, attachments: uploaded })
```

The REST endpoint `POST /api/messages/upload` is handled by the `upload.single("file")` Multer middleware before the controller runs.

### Multer configuration (`server/middleware/upload.js`)

| Setting | Value |
|---|---|
| Storage | `multer.diskStorage` — files land in `server/uploads/` |
| File naming | `${Date.now()}-${randomString}${ext}` — collision-safe |
| Size limit | 5 MB per file |
| MIME allowlist | JPEG, PNG, GIF, WebP, MP4, WebM, MOV, PDF, DOCX, XLSX, PPTX, TXT |

The controller derives `fileType` from the MIME type:
- `image/*` → `"image"`
- `video/*` → `"video"`
- anything else → `"document"`

### Serving files

```javascript
// server/index.js
app.use("/uploads", express.static(path.join(__dirname, "uploads")))
```

Files are served at `/uploads/<filename>`. In development the Vite proxy forwards `/uploads` requests to the Express server so no `VITE_API_URL` env var is needed.

### Rendering in chat (`AttachmentView` component)

```
fileType === "image"    → <img src="/uploads/..." />
fileType === "video"    → <video controls src="/uploads/..." />
fileType === "document" → download card with icon + filename + size
```

Documents are rendered with a type-specific icon (red PDF, green Excel, blue Word) via a `DocIcon` helper component in `ChatInfoModal.tsx`.

### Preview before send

When a user selects files, `handleFileSelect` creates object URLs (`URL.createObjectURL`) for each file and stores them in `pendingFiles: PendingFile[]`. A preview strip above the input box renders each file with an × button. Removing a file revokes its object URL to avoid memory leaks.

**Key files:** `server/middleware/upload.js`, `server/controllers/messageController.js → uploadFile`, `frontend/src/pages/app/ChatPage.tsx`

---

## 9. Group Management

### Public vs. private groups

`Group.isPrivate` controls two join paths:

| `isPrivate` | Behaviour |
|---|---|
| `false` | `POST /api/groups/:id/join` adds user immediately |
| `true` | Request is stored in `group.joinRequests[]`, owner is notified via `notify()`, user gets `202 Accepted` |

The owner approves or declines via `POST /api/groups/:id/join-requests/respond`.

### Leave vs. kick distinction

| Action | Endpoint | Effect on `removedMembers` |
|---|---|---|
| Member leaves voluntarily | `POST /api/groups/:id/leave` | **Not** added to `removedMembers` — can rejoin freely |
| Owner kicks a member | `DELETE /api/groups/:id/members/:userId` | Added to `removedMembers` — blocked from rejoining |

When a member who was previously kicked tries to rejoin (e.g. by URL), the `joinGroup` controller checks `removedMembers` and blocks them. When a voluntary-leave user rejoins, any stale `removedMembers` entry is filtered out on join so they don't incorrectly see the "you were removed" banner.

### Chat Info Modal (group details)

`ChatInfoModal.tsx` is a `<Dialog>` with four tabs, all derived from the `messages[]` prop:

| Tab | Data source |
|---|---|
| Members | `group.members[]` from REST response |
| Media | `messages.flatMap(m => m.attachments).filter(a => a.fileType === "image" \|\| "video")` |
| Documents | same filter for `fileType === "document"` |
| Links | regex `/(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g` applied to every `message.content` |

The modal opens from two places: the **ℹ info icon** in the chat header or clicking the **group name text** (both call `setShowInfo(true)`).

The **Leave Group** button is only shown for non-owners. It opens an `<AlertDialog>` for confirmation, then calls `POST /api/groups/:id/leave`. On success it calls `onLeft()` which re-fetches the sidebar and navigates to `/app/chat`.

**Key files:** `frontend/src/components/shared/ChatInfoModal.tsx`, `server/controllers/groupController.js`

---

## 10. Accessibility — Screen Reader TTS & Accommodation Hints

### Browser TTS (Web Speech API)

No external library is used. The browser's built-in `window.speechSynthesis` API is called directly:

```typescript
// ChatPage.tsx
function speak(text: string) {
  if (!("speechSynthesis" in window)) return
  window.speechSynthesis.cancel()   // stop any in-progress utterance
  const utt = new SpeechSynthesisUtterance(text)
  utt.rate = 1
  utt.pitch = 1
  window.speechSynthesis.speak(utt)
}

function buildSpeechText(msg): string {
  // "jane smith said: hey how are you"
  // "jane smith sent an image"
  // "jane smith sent 2 attachments"
}
```

**Auto-read on arrival:** In the `socket.on("new_message")` handler, if the logged-in user has `accessibilityNeeds.includes("screen-reader")` and the message is from someone else, `speak(buildSpeechText(msg))` is called automatically.

**Per-message play button:** Every message row renders a `<button aria-label="Read message aloud">` with a `Volume2` icon. For screen-reader users it is always visible (`opacity-100`); for others it appears on hover (`group-hover/msg:opacity-100`).

**Stale closure prevention:** The `socket.on("new_message")` callback is registered once when the socket mounts. To avoid reading a stale `user` value at that point, a `userRef` is kept in sync via a `useEffect([user])`, and the socket callback reads `userRef.current` instead of `user` directly.

### Accommodation hints

When a group is loaded (`GET /api/groups/:id`), the server inspects `accessibilityNeeds` across **all members** and appends a `accessibilityHints: string[]` array to the response:

```javascript
// groupController.js → getGroupById
const allNeeds = group.members.flatMap((m) => m.accessibilityNeeds || [])
const uniqueNeeds = [...new Set(allNeeds)]
if (uniqueNeeds.includes("screen-reader"))
  hints.push("Use plain-text messages; avoid image-only content.")
if (uniqueNeeds.includes("captions"))
  hints.push("Enable captions for any voice/video sessions.")
// etc.
```

These hints are displayed in the chat header to guide all members on how to communicate more inclusively.

### WCAG foundations in the UI

- All shadcn/ui primitives are built on `@radix-ui` which ships with full keyboard navigation and ARIA attributes by default
- Interactive elements have explicit `aria-label` attributes (`"Read message aloud"`, `"Remove attachment"`, etc.)
- Focus order follows DOM order; no `tabindex > 0` is used
- High-contrast-safe colours: text meets 4.5:1 contrast ratio against the dark background

---

## 11. Frontend State Management

Three **Zustand** stores manage global state:

### `authStore` (`persist` middleware)

```typescript
{ user, token, setAuth, setUser, logout, fetchMe }
```
- `token` and `user` are persisted to `localStorage` under key `"sbc-auth"` so sessions survive page refresh.
- `fetchMe()` re-validates the token with `GET /api/auth/me` on app load — if the token is expired the store is cleared and the user is redirected to login.

### `socketStore`

```typescript
{ socket, onlineUsers, connect(token), disconnect() }
```
- `connect(token)` creates the Socket.io client and subscribes to `online_users`.
- Called from `AppLayout.tsx` after the user is authenticated.
- `transports: ["websocket"]` skips the HTTP polling fallback for lower latency.

### `notificationStore`

```typescript
{ notifications, unreadCount, addNotification, markAllRead, fetchNotifications }
```
- Populated on mount via `GET /api/notifications`.
- Live updates arrive through the socket listener `socket.on("notification", addNotification)` set up in `AppLayout.tsx`.
- The unread badge count drives the red dot on the bell icon.

---

## 12. API Layer & Request Flow

### Axios instance (`frontend/src/lib/api.ts`)

```typescript
const api = axios.create({ baseURL: "/api" })

// Inject JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sbc_token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Global 401 handler — clear auth and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("sbc_token")
      window.location.href = "/login"
    }
    return Promise.reject(err)
  }
)
```

### Vite proxy (`frontend/vite.config.ts`)

During development, `/api` and `/uploads` requests are proxied to `http://localhost:5001` so the frontend never needs a hardcoded API URL:

```typescript
proxy: {
  "/api":     { target: "http://localhost:5001", changeOrigin: true },
  "/uploads": { target: "http://localhost:5001", changeOrigin: true },
}
```

### REST endpoint summary

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | ✗ | Register with email/password |
| POST | `/api/auth/login` | ✗ | Login, receive JWT |
| GET | `/api/auth/google` | ✗ | Start Google OAuth |
| GET | `/api/auth/google/callback` | ✗ | OAuth callback → JWT redirect |
| GET | `/api/auth/me` | ✓ | Get current user |
| PUT | `/api/users/me` | ✓ | Update profile |
| GET | `/api/groups` | ✓ | List/search all groups |
| POST | `/api/groups` | ✓ | Create group |
| GET | `/api/groups/mine` | ✓ | Groups current user belongs to |
| GET | `/api/groups/:id` | ✓ | Group detail + accessibility hints |
| POST | `/api/groups/:id/join` | ✓ | Join or request to join |
| POST | `/api/groups/:id/leave` | ✓ | Leave voluntarily |
| DELETE | `/api/groups/:id/members/:userId` | ✓ | Owner removes member |
| GET | `/api/groups/:id/join-requests` | ✓ | Owner: list pending requests |
| POST | `/api/groups/:id/join-requests/respond` | ✓ | Owner: accept/decline |
| GET | `/api/messages/:groupId` | ✓ | Load message history |
| POST | `/api/messages/upload` | ✓ | Upload a single file |
| GET | `/api/notifications` | ✓ | Fetch all notifications |
| PUT | `/api/notifications/read-all` | ✓ | Mark all as read |
| POST | `/api/invitations` | ✓ | Send group invitation |

---

## 13. Data Models Reference

### User
```
_id, name, email, password (hashed, select:false),
googleId, avatar,
courses[], learningStyle,
availability[{ day, slots[] }],
accessibilityNeeds[], communicationPrefs[],
profileComplete, createdAt, updatedAt
```

### Group
```
_id, name, course, description, isPrivate,
members[ObjectId→User],
createdBy ObjectId→User,
joinRequests[{ user, requestedAt }],
removedMembers[{ user, removedAt }],
createdAt, updatedAt
```

### Message
```
_id,
group ObjectId→Group,
sender ObjectId→User,
content String (default ""),
attachments[{ url, originalName, mimetype, size, fileType }],
createdAt, updatedAt
```

### Notification
```
_id, recipient ObjectId→User,
type (one of 7 enum values),
title, body,
data (Mixed — groupId, actorName, etc.),
read Boolean (default false),
createdAt, updatedAt
```

### Invitation
```
_id,
group ObjectId→Group,
sender ObjectId→User,
recipient ObjectId→User,
status "pending"|"accepted"|"declined",
createdAt, updatedAt
```

---

*Last updated: June 2026 — MVP 1*
