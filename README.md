# TwitterClone

TwitterClone is a full-stack social networking and real-time messaging application. It combines a React/Vite Progressive Web App with an Express, MongoDB, Socket.IO, and local media storage. The product supports authenticated timelines, user profiles, posts, likes, replies, sharing, notifications, direct messages, group chats, media uploads, encrypted message text, polls, and deployment-ready configurations for Vercel and Render.

## Table of contents

- [Architecture](#architecture)
- [Feature overview](#feature-overview)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Runtime requirements](#runtime-requirements)
- [Environment variables](#environment-variables)
- [Local development](#local-development)
- [Available scripts](#available-scripts)
- [API reference](#api-reference)
- [Realtime events](#realtime-events)
- [Data model](#data-model)
- [Media storage](#media-storage)
- [Security model](#security-model)
- [Testing and quality checks](#testing-and-quality-checks)
- [Deployment](#deployment)
- [Operational notes](#operational-notes)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Architecture

```text
Browser / PWA
  └── React + Vite frontend
        ├── Chakra UI, Recoil, React Router
        ├── Socket.IO client for live chat state
        └── /api/* calls proxied to the backend in production

Node.js API
  └── Express application
        ├── REST routers for auth, users, posts, notifications, messages, groups, polls
        ├── Socket.IO server for online users and realtime message delivery
        ├── Mongoose models backed by MongoDB
        ├── Multer uploads to local media storage
        └── cookie-based JWT authentication

External services
  ├── MongoDB database
  ├── Local media directory with optional legacy S3 reads
  ├── Mailtrap email delivery
  └── Optional Redis service; currently implemented as a no-op cache stub
```

The backend entrypoint is `Backend/server.js`. It initializes middleware, mounts API routers under `/api`, configures production static serving, attaches Socket.IO to the HTTP server, connects to MongoDB, and starts listening on `PORT`.

The frontend entrypoint is `Frontend/src/main.jsx`, and top-level application routes are defined in `Frontend/src/App.jsx`.

## Feature overview

### Authentication and account lifecycle

- Sign up, log in, log out, email verification, forgot password, and reset password flows.
- JWT authentication stored in an HTTP cookie.
- Protected routes on both frontend and backend.

### Social feed

- Create posts with captions and image media.
- Read personalized feed posts.
- Read a single post or posts by username.
- Like, reply to, share, and delete posts.
- Follow and unfollow users.
- Suggested users and profile update flows.

### Messaging

- One-to-one conversations.
- Group conversations with group ownership, admins, members, invites, permissions, blocking, invite links, and analytics.
- Text, image, video, audio, file, post-reference, and poll-style messages.
- Message editing, replies, reactions, and delete-for-me semantics.
- Socket.IO-powered online user tracking and realtime message/group-message delivery.

### Notifications

- Follow and like notifications.
- Unread notification tracking in the frontend state.
- Notification deletion endpoint.

### Media and PWA support

- Local uploads through Multer, with image compression and adaptive video streaming.
- Presigned read URLs for private media retrieval.
- Vite PWA/service-worker configuration and public app assets.

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 18, Vite 5, Chakra UI, Recoil, React Router, Socket.IO Client, Tailwind CSS, DaisyUI |
| Backend | Node.js, Express, Socket.IO, Mongoose, JWT, Multer, AWS SDK v3, Mailtrap |
| Data | MongoDB, Mongoose schemas |
| Storage | Local media directory; optional S3 compatibility for existing uploads |
| Tooling | Jest, Supertest, ESLint, Vite, Docker Compose |
| Deployment | Vercel frontend config, Render backend blueprint, Dockerfile for backend |

## Repository layout

```text
.
├── Backend/
│   ├── controller/          # Request handlers and business logic
│   ├── DB/                  # MongoDB connection helper
│   ├── infrastructure/      # CloudFront/S3 provisioning helper
│   ├── lib/utils/           # Upload, email, token, encryption helpers
│   ├── middleware/          # Authentication middleware
│   ├── models/              # Mongoose schemas
│   ├── routers/             # Express route definitions
│   ├── socket/              # Socket.IO server setup
│   ├── tests/               # Jest/Supertest backend tests
│   ├── Dockerfile
│   └── server.js
├── Frontend/
│   ├── public/              # Static assets and PWA manifest
│   ├── src/
│   │   ├── Pages/           # Route-level React pages
│   │   ├── components/      # Reusable UI components
│   │   ├── context/         # Socket context provider
│   │   ├── hooks/           # Client-side data and UX hooks
│   │   ├── atom/            # Recoil atoms
│   │   └── App.jsx          # Top-level route composition
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml       # Local Redis service
├── render.yaml              # Render backend + Redis blueprint
├── vercel.json              # Vercel frontend build and API rewrites
├── package.json             # Root convenience scripts
└── README.md
```

## Runtime requirements

- Node.js 22 or newer.
- npm 9 or newer.
- MongoDB connection string or a local MongoDB instance.
- FFmpeg and FFprobe for video processing. The backend container and dev container include both.
- Mailtrap credentials for email verification and password reset flows.
- Docker, only if using the Redis Docker Compose helper.

## Environment variables

Create a `.env` file at the repository root for local backend development. Some utility modules also call `dotenv.config()` from backend subdirectories, so keeping the root `.env` as the single source of truth is recommended.

```bash
# Server
NODE_ENV=development
PORT=5000
# Optional for an isolated development instance with no email service
LOCAL_SIGNUP=true
CLIENT_URL=http://localhost:3000/
FRONTEND_URL=http://localhost:3000
APP_URL=http://localhost:3000

# Database
MONGODB_URL=mongodb://127.0.0.1:27017/twitterClone
# Optional fallback if MONGODB_URL is unavailable
MONGODB_LOCAL_URL=mongodb://127.0.0.1:27017/twitterClone

# Authentication and encryption
JWT_SECRET=replace-with-a-long-random-secret
ENCRYPTION_ALGO=aes-256-cbc
ENCRYPTION_SECRET=replace-with-a-long-random-secret

# Mailtrap
TOKEN=replace-with-mailtrap-token

# Optional persistent media location (defaults to .dayline-media in the repository)
# MEDIA_DIR=/var/lib/dayline/media

# Optional Redis URL if Redis support is restored
REDIS_URL=redis://localhost:6379
```

### Environment variable notes

- `MONGODB_URL` is the primary MongoDB URI. Development can fall back to `MONGODB_LOCAL_URL` when the primary connection fails. When a SOCKS proxy is needed, set `MONGODB_PROXY_HOST` and optionally `MONGODB_PROXY_PORT` (default 9050).
- `JWT_SECRET` is required for protected API routes and signed auth cookies.
- `ENCRYPTION_ALGO` and `ENCRYPTION_SECRET` are required for message encryption/decryption helpers.
- `MEDIA_DIR` selects the directory for local uploads. The backend process needs read and write access.
- Existing S3 objects remain readable when `ACCESS_KEY`, `SECRET_KEY`, `REGION` and `BUCKET_NAME` are configured. For a compatible provider, include `S3_ENDPOINT` and set `S3_FORCE_PATH_STYLE` if needed.
- `TOKEN` is used by Mailtrap. With `NODE_ENV=development`, `LOCAL_SIGNUP=true` enables local account creation without Mailtrap. Use this only for an isolated development database.
- `CLIENT_URL`, `FRONTEND_URL`, and `APP_URL` are used in email links and group invite links. Normalize trailing slashes before production rollout.

## Local development

### 1. Install dependencies

From the repository root:

```bash
npm ci --ignore-scripts
npm ci --prefix Backend
npm ci --prefix Frontend
```

### 2. Start supporting services

Start MongoDB locally by your preferred method. For Redis-backed HTTP rate limits, start a local Redis container:

```bash
docker compose up -d redis
```

Set `REDIS_URL` to the Redis connection URL, including any credentials. HTTP rate limits fall back to process memory if Redis is unavailable. MongoDB is required. Local media uploads require no S3 credentials.

### 3. Run the backend

```bash
npm run dev
```

The API starts on `http://localhost:5000` by default.

### 4. Run the frontend

In a second terminal:

```bash
npm run dev --prefix Frontend
```

The Vite dev server starts on its configured local port, commonly `http://localhost:3000` or `http://localhost:5173` depending on the Vite config and local availability.

### 5. Build production assets

```bash
npm run build --prefix Frontend
```

The production bundle is emitted to `Frontend/dist`. To test PWA installation with the local backend, run the built frontend after freeing port 3000 from the development server.

```bash
DAYLINE_API_TARGET=http://127.0.0.1:5000 npm run preview --prefix Frontend -- --port 3000 --strictPort
```

Open `http://localhost:3000` in a browser that supports PWA installation. The production service worker caches the app shell for offline startup. API data still requires a connection.

## Railway deployment

The root `Dockerfile` builds the PWA and API into one service. Express serves the app, API and Socket.IO on the same HTTPS domain, so session cookies and private attachment links work from the installed app. The container runs Redis on loopback for HTTP rate-limit counters.

- Set the service builder to `DOCKERFILE` with `Dockerfile` at the repository root. Expose port `5000` and use `/health` as the health check.
- Attach a persistent volume at `/data` and set `MEDIA_DIR=/data/media`. Back it up with the MongoDB database.
- Set `NODE_ENV=production`, `MONGODB_URL`, `JWT_SECRET`, `ENCRYPTION_SECRET`, and `TOKEN` in Railway's service variables. Use a database user with `readWrite` only on the app database. Store credentials in Railway variables.
- Set `TRUST_PROXY_HOPS=1` when the service is reached through Railway's single edge proxy. Set `FRONTEND_URL`, `CLIENT_URL`, and `APP_URL` to the service's HTTPS domain.
- Optional S3 credentials serve previously uploaded S3 objects. The deployed service writes new uploads to the attached volume.

## Available scripts

### Root package

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the backend with Nodemon using `Backend/server.js`. |
| `npm start` | Starts the backend with Node.js. |
| `npm test` | Runs Jest from the repository root. |
| `npm run build` | Installs frontend dependencies and builds the frontend. |

### Backend package

| Command | Description |
| --- | --- |
| `npm run dev --prefix Backend` | Starts the backend from `Backend/` with Nodemon. |
| `npm start --prefix Backend` | Starts `Backend/server.js`. |
| `npm test --prefix Backend` | Runs backend Jest tests with ESM support. |
| `npm run lint --prefix Backend` | Runs ESLint over backend files. |

### Frontend package

| Command | Description |
| --- | --- |
| `npm run dev --prefix Frontend` | Starts Vite development server. |
| `npm run build --prefix Frontend` | Builds the React app for production. |
| `npm run lint --prefix Frontend` | Runs ESLint against React source files. |
| `npm run preview --prefix Frontend` | Serves the production build locally. |
| `npm run generate-pwa-assets --prefix Frontend` | Generates PWA assets. |

## API reference

All API routes are mounted under `/api`.

### Auth routes

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | Public | Create a new user account. |
| `POST` | `/api/auth/login` | Public | Authenticate a user and set the auth cookie. |
| `POST` | `/api/auth/logout` | Public | Clear the auth cookie. |
| `POST` | `/api/auth/verify-email` | Public | Verify a user email using a verification token. |
| `POST` | `/api/auth/forgot-password` | Public | Send a password reset email. |
| `POST` | `/api/auth/reset-password/:resetToken` | Public | Reset a password using a reset token. |

### User routes

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/users/profile/:query` | Required | Read a user profile by supported query value. |
| `GET` | `/api/users/suggested` | Required | Read suggested accounts to follow. |
| `POST` | `/api/users/follow/:id` | Required | Follow or unfollow a user. |
| `PUT` | `/api/users/update/:id` | Required | Update profile fields and optional image upload. |

### Post routes

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/posts/create` | Required | Create a post with optional `image` multipart field. |
| `PUT` | `/api/posts/like/:id` | Required | Like or unlike a post. |
| `PUT` | `/api/posts/reply/:id` | Required | Add a reply/comment to a post. |
| `GET` | `/api/posts/feed` | Required | Read feed posts for the authenticated user. |
| `GET` | `/api/posts/:id` | Public | Read a post by id. |
| `GET` | `/api/posts/user/:username` | Public | Read posts for a username. |
| `POST` | `/api/posts/sharepost` | Required | Share a post. |
| `DELETE` | `/api/posts/:id` | Required | Delete a post owned by the requester. |

> Route ordering note: `/api/posts/:id` is declared before `/api/posts/user/:username`. In Express, the dynamic `/:id` route can match `/user` before the username route is reached. Consider moving `/user/:username` above `/:id` if this endpoint behaves unexpectedly.

### Notification routes

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/notification/` | Required | Read notifications for the authenticated user. |
| `DELETE` | `/api/notification/delete` | Required | Delete notifications. |

### Message routes

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/messages/send` | Required | Send a direct message with optional `media` multipart field. |
| `GET` | `/api/messages/:otherUserId` | Required | Read direct messages with another user. |
| `GET` | `/api/messages/getConvo/user` | Required | Read user conversations. |
| `PUT` | `/api/messages/edit` | Required | Edit a message. |
| `POST` | `/api/messages/reply` | Required | Reply to a message with optional `media`. |
| `PUT` | `/api/messages/reaction` | Required | Add or update a message reaction. |
| `PUT` | `/api/messages/deleteforme` | Required | Hide a message for the authenticated user. |
| `GET` | `/api/messages/group/:groupId` | Required | Read group messages. |
| `POST` | `/api/messages/group/send` | Required | Send a group message with optional `media`. |
| `GET` | `/api/messages/group/:groupId/info` | Required | Read group conversation metadata. |

> Route ordering note: `/api/messages/:otherUserId` is declared before `/api/messages/getConvo/user`, so requests to `/getConvo/user` can be captured as a dynamic `otherUserId` route. Consider moving static routes above parameterized routes.

### Group routes

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/groups/create` | Required | Create a group with optional `profileImage`. |
| `GET` | `/api/groups/user-groups` | Required | Read groups for the authenticated user. |
| `GET` | `/api/groups/:groupId` | Required | Read group details. |
| `PUT` | `/api/groups/:groupId` | Required | Update group metadata and optional image. |
| `POST` | `/api/groups/invite` | Required | Invite a user to a group. |
| `POST` | `/api/groups/accept-invite` | Required | Accept a group invitation. |
| `POST` | `/api/groups/deny-invite` | Required | Deny a group invitation. |
| `POST` | `/api/groups/leave` | Required | Leave a group. |
| `PUT` | `/api/groups/permissions` | Required | Update group messaging permissions. |
| `POST` | `/api/groups/block` | Required | Block a user in a group. |
| `POST` | `/api/groups/unblock` | Required | Unblock a user in a group. |
| `POST` | `/api/groups/generate-invite-link` | Required | Generate a signed invite link. |
| `POST` | `/api/groups/join-with-token` | Required | Join a group with a signed invite token. |
| `GET` | `/api/groups/:groupId/analytics` | Required | Read group analytics. |
| `DELETE` | `/api/groups/delete` | Required | Delete a group. |

> Route ordering note: `/api/groups/:groupId` is declared before multiple static routes. If static group routes return group-detail behavior, move static routes above the parameterized route.

### Poll routes

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/polls/create` | Required | Create a poll message. |
| `POST` | `/api/polls/:messageId/vote` | Required | Vote on a poll. |
| `PATCH` | `/api/polls/:messageId/close` | Required | Close a poll. |

## Realtime events

Socket.IO is initialized by `Backend/socket/socket.js`.

| Event | Direction | Description |
| --- | --- | --- |
| `getOnlineUsers` | Server → Client | Initial presence snapshot after a connection is authenticated. |
| `presenceChanged` | Server → Client | Batched changes when an account comes online or its last connection closes. |
| `joinRoom`, `leaveRoom` | Client → Server | Change the active conversation used for typing updates. Room access requires current membership. |
| `typingStatus` | Server → Client | A typing update scoped to the active conversation. |
| `newMessage`, `newGroupMessage` | Server → Client | Deliver persisted messages to all connected tabs for each recipient. |
| `groupCreated` | Server → Client | Refresh the inbox for members of a newly created group. |

Socket.IO uses the signed session cookie. Keep the frontend connection pointed at the same-origin proxy for local development. Reconnecting restores realtime delivery and reloads history for the active chat. Presence and rooms use Socket.IO's in-memory adapter in a single backend process. Horizontal deployment requires shared Socket.IO room and presence state.

## Sessions and media discovery

Access JWTs expire after 15 minutes and identify a server-side session. The refresh cookie expires after 30 days, rotates on use, and is scoped to the auth endpoints. MongoDB stores the token hash and rotation generation. Reusing an older refresh token revokes its session, including issued access tokens. Logout revokes the current session. Password changes and resets invalidate earlier sessions. Users signed in before this upgrade need to sign in again. A stolen access token can still be used until it expires or the session is revoked.

Posts support up to six photos at 4 MB each. Reels accept one browser-compatible MP4 or WebM up to 20 MB and use the same likes, comments, private saves, and chat sharing as other posts. The app transcodes reels for adaptive streaming. Discover and Reels rank a recent candidate window using follows, hashtag overlap from likes and followed authors, recency, and engagement. People suggestions combine mutual follows with creators who post about those topics.

## Calls and service limits

Open an existing direct conversation and choose the phone or camera button. The recipient can answer in one tab. The app sends the call setup over the authenticated Socket.IO connection. Audio and video use WebRTC, and users can mute, disable their camera, or hang up. Calls require a secure browser origin and microphone or camera permission. Compatible browsers can use direct ICE candidates on the same network. For calls across different networks, configure STUN and TURN through `CALL_STUN_URL`, `CALL_TURN_URL`, and `CALL_TURN_SECRET`. The backend issues one-hour TURN REST credentials to signed-in users. Set the matching secret on your TURN server.

The API applies a per-IP ceiling before body parsing and independent budgets for each route and signed-in account. Login, signup, reset, search, analytics, and upload routes use stricter budgets. HTTP 429 responses include `Retry-After`. Set `TRUST_PROXY_HOPS` only for deployments with a fixed, trusted proxy path. MongoDB connections use a bounded pool and wait timeout.

Public post details and people-search results use bounded in-process caches. Feed, profile-post and chat-history responses include `X-Next-Cursor` when another page is available. Streamed WebRTC media, private message bodies, and authorization checks bypass those caches. Cache, limiter, presence, and call state are local to one application instance. Multi-instance deployments need shared coordination.

## Data model

| Model | Purpose | Key fields |
| --- | --- | --- |
| `User` | Account/profile identity | `username`, `fullName`, `email`, `password`, `followers`, `following`, `profileImg`, `bio`, verification/reset fields |
| `Post` | Social feed post | `postedBy`, `caption`, `images`, `likes`, `replies`, `sharedBy`, `shareCount` |
| `Conversation` | Direct and group conversation summaries | `kind`, `participants`, `directKey`, `lastMessage` |
| `Message` | Direct/group message payload | `conversationId`, `sender`, `text`, `type`, `iv`, media URLs, `postReference`, `reactions`, `replyTo`, `deletedFor`, `poll` |
| `Group` | Group chat membership and controls | `name`, `description`, `profileImage`, `owner`, `admins`, `members`, `invites`, `permissions`, `blocked`, `conversation`, `messages` |
| `Notification` | User notifications | `from`, `to`, `type`, `post`, `read` |

A partial unique index on `Conversation.directKey` keeps new direct chats unique per account pair. Existing chats without the key remain readable. Historical duplicate threads are retained, with direct lookups preferring the most recently updated one. Deploy with the index built before opening message writes.

## Media storage

Posts, reels, profile photos, group images and chat attachments are written to the local media directory. MongoDB stores their keys. Photos are resized within 1,800 pixels per side and compressed as WebP, with smaller JPEGs kept when they fit the limits. Other attachments retain their bytes. Videos up to three minutes are encoded as HLS renditions up to the source resolution or a 1,280-pixel long edge. Playback adjusts to available bandwidth, with a smaller MP4 available as a fallback.

The backend serves uploads through `/api/media`. Group photos and message attachments require a signed-in account with access to the group or conversation. Keep `MEDIA_DIR` on a persistent volume in production and back up the directory together with MongoDB. For the backend Docker image the default volume path is `/usr/src/app/.dayline-media`.

Previously stored S3 keys use a compatibility adapter when the original bucket remains configured. New uploads use local storage.

## Security model

- Authentication uses JWTs signed with `JWT_SECRET` and stored as cookies.
- Protected routers use `protectRoute` to resolve the authenticated user before controller logic runs.
- Common request-hardening middleware includes CORS, cookie parsing, JSON/body parsing limits, Mongo sanitization, XSS sanitization, HPP protection, and compression.
- Message text is encrypted before persistence using the configured symmetric algorithm and secret.
- S3 bucket names, credentials, JWT secrets, encryption secrets, and email tokens must never be committed.
- Production should use HTTPS, secure cookies, strict CORS origins, strong random secrets, and managed secret storage.

## Testing and quality checks

Backend test files live in `Backend/tests`. Run:

```bash
npm test --prefix Backend
```

Frontend build verification:

```bash
npm run build --prefix Frontend
```

Frontend linting:

```bash
npm run lint --prefix Frontend
```

Backend linting:

```bash
npm run lint --prefix Backend
```

## Deployment

### Vercel frontend

The root `vercel.json` builds `Frontend/package.json` with `@vercel/static-build`, serves `Frontend/dist`, rewrites `/api/:path*` to the Render backend, and falls back all other routes to the SPA entrypoint.

Before deploying, update the API rewrite destination if the backend URL changes.

### Render backend

`render.yaml` defines a Docker-based backend service rooted at `Backend/` plus a private Redis-compatible KeyValue service. Replace placeholder values such as branch, frontend URL, region, and any service-specific settings before creating a production blueprint.

### Single-server production mode

When `NODE_ENV=production`, the backend can serve the built frontend assets from `Frontend/dist`. Build the frontend first, then start the server:

```bash
npm run build --prefix Frontend
NODE_ENV=production npm start
```

## Operational notes

- Keep generated build outputs out of source control unless your deployment target explicitly requires committed artifacts.
- Use a managed MongoDB service for production and configure backups.
- Rotate `JWT_SECRET`, `ENCRYPTION_SECRET`, storage keys, and Mailtrap tokens if they are ever exposed.
- Review Express route ordering when adding new static routes next to dynamic `/:id` or `/:groupId` routes.
- Redis is currently disabled by a no-op stub. Re-enable the real Redis client only after configuring connection lifecycle, error handling, and deployment variables.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Backend exits on startup | MongoDB connection failed | Verify `MONGODB_URL`, local MongoDB availability, and network access. |
| Authenticated API returns 401 | Missing or invalid JWT cookie | Log in again and verify `JWT_SECRET` is stable across restarts. |
| Message encryption fails | Missing encryption config | Set `ENCRYPTION_ALGO=aes-256-cbc` and a strong `ENCRYPTION_SECRET`. |
| Media upload fails | Storage configuration error | Confirm bucket, endpoint, region, and access credentials. |
| Frontend cannot reach API | Rewrite/proxy mismatch | Check `vercel.json`, backend URL, CORS origin list, and cookie credentials. |
| Static route behaves like an ID lookup | Express route ordering | Move static routes before parameterized routes in the relevant router. |

## Contributing

1. Create a feature branch from the target branch.
2. Install dependencies for the root, backend, and frontend packages.
3. Keep changes focused and avoid committing secrets or local build artifacts.
4. Run relevant tests, lint checks, and builds before opening a pull request.
5. Document new environment variables, API endpoints, and operational requirements in this README.
