# Upwork Toolkit - your own freelance assistant

**Upwork Toolkit** is a browser extension for Upwork freelancers that helps them save time and earn more by automating job discovery and proposal writing.

**Core Problem**: Freelancers miss opportunities because they can't constantly monitor Upwork's job feed.

**Solution**: Light job monitoring with notifications. Cover letters come from the separate Bid Mac app, which receives new jobs through the webhook. This fork never touches the proposal page.

**Account safety (2026-09-27)**: after a "Misuse of Upwork Systems" flag, this fork checks Upwork like a person with one tab open: once a minute, one feed, only while the owner is at the Mac, and a 30 minute pause after any pushback. Do not speed it up, add feeds, or add anything that fills or submits forms.

---

## Tech Stack

- **Framework**: React 19.1 + TypeScript 5.8
- **Build Tool**: WXT 0.20.6 (browser extension framework, Chrome MV3)
- **UI**: Material-UI 9.1 with Emotion styling
- **Error Tracking**: Sentry 10
- **Analytics**: Google Analytics 4
- **HTTP**: Axios 1.18

---

## Architecture

```
uptoolkit/
├── entrypoints/
│   ├── background/           # Service worker
│   │   ├── index.ts          # Alarms & listeners setup
│   │   └── fetchJobs.ts      # Job fetching (every 60s, chosen feed only, gated by idle/pause/schedule)
│   └── options/              # Extension popup/settings
│       ├── pages/
│       │   ├── Home.tsx      # Job list dashboard
│       │   ├── Settings.tsx  # User preferences
│       │   ├── Faq.tsx       # Help content
│       │   ├── Logs.tsx      # Debug logs
│       │   └── Debug.tsx     # Hidden debug tools
├── api/
│   ├── upwork.ts             # Upwork GraphQL API
│   └── gqlQueries.ts         # GraphQL query definitions
├── utils/
│   ├── globalState.ts        # Cloud-synced state management
│   ├── jobs.ts               # Job caching
│   ├── notifications.ts      # Desktop notifications
│   ├── pacing.ts             # Idle interval, pause-after-error, working-hours gate
│   ├── analytics.ts          # GA4 tracking
│   ├── sentry.ts             # Error reporting
│   └── logger.ts             # Application logging
├── components/               # Shared UI components
├── hooks/                    # Custom React hooks
└── contexts/                 # React contexts
```

---

## Core Features

### 1. Job Monitoring & Notifications

- **Fetching**: every 60 seconds (5s first run in dev), the chosen feed only. Skipped while Chrome reports the Mac idle (5 min) or locked, outside working hours, and for 30 minutes after any Upwork error except a network error. The token cookie is loaded at most once per cycle, with no retry chain.
- **Three feed sources**:
  - My Feed / Saved Searches (custom filters)
  - Best Matches (algorithmic recommendations)
  - Most Recent (newest jobs)
- **Desktop notifications** with clickable actions
- **Sound notifications** with volume control (0-100%)
- **Badge counter** showing unseen jobs
- **Job deduplication** to prevent repeat notifications

### 2. Scheduled Notifications (Working Hours)

- Enable/disable scheduling
- Multiple time windows per day
- Day-of-week selection
- US (12-hour) or 24-hour time format
- Jobs outside schedule are cached silently

### 3. Job Browsing Interface

- Job cards with: title, type, budget, client info, skills
- Compact/detailed list toggle
- Click-through to Upwork job page
- Optional: auto-open proposal page in new tab

### 4. User Settings

- **Master toggle**: Enable/disable extension
- **Dark mode**: On / Off / System
- **Sound**: Enable/disable + volume
- **Feed source**: Select preferred job feed
- **Open proposal page**: Auto-open apply page

---

## API Integrations

### Upwork API (`api/upwork.ts`)

- GraphQL endpoint: `https://www.upwork.com/api/graphql/v1`
- Cookie-based authentication
- Queries: MyFeed, BestMatches, MostRecent

### External Services

- **Sentry**: Error tracking
- **Google Analytics 4**: Usage analytics

---

## Storage & State

### Global State (`utils/globalState.ts`)

Synced across devices via Chrome storage:

- `enabled`, `darkMode`, `compactList`
- `feedType`, `openProposalPage`
- `schedulingEnabled`, `schedules[]`
- `soundSettings { enabled, volume }`
- `usTimeFormat`
- `instanceId`, `pausedUntil`

### Local Storage

- `__JOBS` - Cached job list (last 50)
- `__LOGS` - Application logs (last 1000)

---

## Hidden/Development Features

### Debug Mode

- **Trigger**: Click version number 10+ times in Settings
- **Features**:
  - Reset global state to defaults
  - Clear all job data
  - View raw state as JSON
  - View all cached jobs

### Dev-Only Features

- First fetch after 5s instead of at once
- Debug analytics endpoint

### Alert System

- Infrastructure for feature announcements
- Tracks read/dismissed alerts
- 24-hour cooldown per alert type

---

## Browser Permissions

- `idle` - Detect user activity
- `alarms` - Schedule background tasks
- `storage` - Persist data
- `cookies` - Access Upwork auth
- `offscreen` - Audio playback
- `notifications` - Desktop notifications
- `declarativeNetRequest` - Modify requests

---

## Key Files Reference

| Purpose          | File                                  |
| ---------------- | ------------------------------------- |
| Background entry | `entrypoints/background/index.ts`     |
| Job fetching     | `entrypoints/background/fetchJobs.ts` |
| Options app      | `entrypoints/options/App.tsx`         |
| Global state     | `utils/globalState.ts`                |
| Upwork API       | `api/upwork.ts`                       |
| Theme config     | `theme.ts`                            |
| WXT config       | `wxt.config.ts`                       |

---

## Environment Variables

```
WXT_GA_API_SECRET          # Google Analytics secret
WXT_GA_MEASUREMENT_ID      # GA measurement ID
WXT_SENTRY_DSN             # Sentry error tracking
SENTRY_AUTH_TOKEN          # Sentry build auth
SENTRY_ORGANISATION        # Sentry org
SENTRY_PROJECT             # Sentry project
```

---

## Coding Conventions

### File Organization

- **Entrypoints**: One folder per extension context (background, offscreen, options)
- **API modules**: Separate file per external service (`api/upwork.ts`, `api/mobileNotifications.ts`)
- **Utils**: Single-responsibility utility files
- **Components**: Reusable UI in `components/`, page-specific in `entrypoints/options/pages/`

### TypeScript Patterns

- **Strict mode** enabled
- **Path aliases**: Use `@/` for imports from project root
- **Types**: API response types in `api/responses/`
- **Explicit return types** on exported functions

### React Patterns

- **Functional components** with hooks (no class components)
- **Custom hooks** for data fetching (`useFetch`, `useRequest`)
- **Context** for storage state (`StorageProvider`)
- **MUI components** with theme customization

### State Management

- **Global state**: `utils/globalState.ts` with WXT storage API
- **Reactive updates**: Use `storage.watch()` for cross-context sync
- **Default values**: Defined in `defaultGlobalState`

### Styling

- **MUI's sx prop** for component styling
- **Theme-aware**: Use `theme.palette`, `theme.spacing`
- **Dark mode**: Handled via theme.ts with system detection

### Error Handling

- **Sentry** for unhandled exceptions
- **Logger** utility for debug logging
- **Graceful degradation**: Show user-friendly alerts for errors
- **No retries against Upwork**: a failed cycle pauses checks (see `utils/pacing.ts`)

### Naming Conventions

- **Files**: camelCase for utils, PascalCase for components
- **Functions**: camelCase, verb-first (`fetchJobs`, `getJobDetails`)
- **Components**: PascalCase (`JobCard`, `ScheduleDialog`)
- **Constants**: SCREAMING_SNAKE_CASE (`FETCH_JOBS`, `PAUSE_AFTER_ERROR_MS`)

### API Calls

- **Axios** for HTTP requests
- **Request logging** via logger utility
- **Error responses** include status code and message
