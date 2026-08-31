# TwitterClone

TwitterClone is a full-stack social networking and real-time messaging application. It combines a React/Vite Progressive Web App with an Express, MongoDB, Socket.IO, and S3-compatible media backend. The product supports authenticated timelines, user profiles, posts, likes, replies, sharing, notifications, direct messages, group chats, media uploads, encrypted message text, polls, and deployment-ready configurations for Vercel and Render.

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
        ├── Multer memory uploads to S3-compatible object storage
        └── cookie-based JWT authentication

External services
  ├── MongoDB database
  ├── S3-compatible storage, optionally fronted by CloudFront
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

- S3-compatible uploads through Multer memory storage.
- Presigned read URLs for private media retrieval.
- Vite PWA/service-worker configuration and public app assets.

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 18, Vite 5, Chakra UI, Recoil, React Router, Socket.IO Client, Tailwind CSS, DaisyUI |
| Backend | Node.js, Express, Socket.IO, Mongoose, JWT, Multer, AWS SDK v3, Mailtrap |
| Data | MongoDB, Mongoose schemas |
| Storage | S3-compatible object storage; CloudFront helper script available |
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

- Node.js 18 or newer.
- npm 9 or newer.
- MongoDB connection string or a local MongoDB instance.
- S3-compatible object storage bucket and credentials for media features.
- Mailtrap credentials for email verification and password reset flows.
- Docker, only if using the Redis Docker Compose helper.

## Environment variables

Create a `.env` file at the repository root for local backend development. Some utility modules also call `dotenv.config()` from backend subdirectories, so keeping the root `.env` as the single source of truth is recommended.

```bash
# Server
NODE_ENV=development
PORT=5000
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
ENDPOINT=https://send.api.mailtrap.io/
TOKEN=replace-with-mailtrap-token

# S3-compatible storage
REGION=auto
ACCESS_KEY=replace-with-access-key
SECRET_KEY=replace-with-secret-key
BUCKET_NAME=twitterclone-dev
S3_ENDPOINT=https://t3.storageapi.dev
S3_FORCE_PATH_STYLE=true

# Optional Redis URL if Redis support is restored
REDIS_URL=redis://localhost:6379
```

### Environment variable notes

- `MONGODB_URL` is the primary MongoDB variable used by the backend database connector.
- `JWT_SECRET` is required for protected API routes and signed auth cookies.
- `ENCRYPTION_ALGO` and `ENCRYPTION_SECRET` are required for message encryption/decryption helpers.
- `ACCESS_KEY`, `SECRET_KEY`, `REGION`, `BUCKET_NAME`, `S3_ENDPOINT`, and `S3_FORCE_PATH_STYLE` configure uploads and presigned media URLs.
- `ENDPOINT` and `TOKEN` are consumed by the Mailtrap client.
- `CLIENT_URL`, `FRONTEND_URL`, and `APP_URL` are used in email links and group invite links. Normalize trailing slashes before production rollout.

## Local development

### 1. Install dependencies

From the repository root:

```bash
npm install
npm install --prefix Backend
npm install --prefix Frontend
```

### 2. Start supporting services

Start MongoDB locally by your preferred method. If you want a local Redis container for future cache work, run:

```bash
docker compose up -d redis
```

Redis is currently disabled in application code through a no-op client stub, so MongoDB and S3-compatible credentials are the core runtime dependencies.

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

The production bundle is emitted to `Frontend/dist`.

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
| `getOnlineUsers` | Server → Client | Broadcasts currently online user IDs whenever users connect or disconnect. |
| `newMessage` | Server → Client | Emitted to the recipient of a direct message. |
| `messageSent` | Server → Client | Emitted to the sender after direct message creation. |
| `newGroupMessage` | Server → Client | Emitted to online members of a group when a new group message is sent. |
| `groupMessageSent` | Server → Client | Emitted to the group-message sender after message creation. |

Clients should connect with a `userId` query parameter after authentication.

## Data model

| Model | Purpose | Key fields |
| --- | --- | --- |
| `User` | Account/profile identity | `username`, `fullName`, `email`, `password`, `followers`, `following`, `profileImg`, `bio`, verification/reset fields |
| `Post` | Social feed post | `postedBy`, `caption`, `images`, `likes`, `replies`, `sharedBy`, `shareCount` |
| `Conversation` | Direct-message conversation summary | `participants`, `lastMessage` |
| `Message` | Direct/group message payload | `conversationId`, `sender`, `text`, `type`, `iv`, media URLs, `postReference`, `reactions`, `replyTo`, `deletedFor`, `poll` |
| `Group` | Group chat membership and controls | `name`, `description`, `profileImage`, `owner`, `admins`, `members`, `invites`, `permissions`, `blocked`, `conversation`, `messages` |
| `Notification` | User notifications | `from`, `to`, `type`, `post`, `read` |

## Media storage

Uploads use Multer memory storage and the AWS SDK S3 client. The helper supports either AWS S3-style virtual-hosted URLs or S3-compatible path-style URLs depending on `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE`. Public media URLs are derived from the configured endpoint and bucket, while protected reads can be served with presigned URLs.

The optional `Backend/infrastructure/secure-s3-cloudfront.js` script provisions a private S3 bucket, enables Block Public Access, creates a CloudFront Origin Access Control, creates a distribution, and writes a bucket policy that permits CloudFront reads.

Run the infrastructure script only against the intended AWS account and after confirming the environment variables:

```bash
node Backend/infrastructure/secure-s3-cloudfront.js
```

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
