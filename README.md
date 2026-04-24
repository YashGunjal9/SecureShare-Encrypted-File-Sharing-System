# 🔐 SecureShare — Encrypted File Sharing System

> **Computer Engineering Mini Project** — Secure File Upload & Sharing with Encryption, Expiry Links & 50GB Large File Support

![SecureShare](https://img.shields.io/badge/Stack-Node.js%20%7C%20React%20%7C%20MongoDB%20%7C%20Google%20Drive-6366f1?style=flat-square)
![Encryption](https://img.shields.io/badge/Encryption-AES--256--GCM-22d3ee?style=flat-square)
![File Size](https://img.shields.io/badge/Max%20File%20Size-50GB-a78bfa?style=flat-square)

---

## ✨ Features

| Feature | Details |
|---|---|
| 🔐 **AES-256-GCM Encryption** | Chunk-level encryption in browser via Web Crypto API |
| 🚀 **50GB File Support** | Resumable chunked upload directly to Google Drive |
| ⏳ **Expiry Links** | Set 1h / 6h / 24h / custom expiry on every share link |
| ⬇️ **Download Limits** | Cap how many times a link can be used |
| 🔑 **Zero-Knowledge** | Backend never sees your file bytes or encryption key |
| 🔄 **Resume Uploads** | Connection drops? Upload continues from where it stopped |
| 📊 **Analytics** | Track downloads, storage used, link activity |
| 🌙 **Futuristic UI** | Dark glassmorphism design with smooth animations |
| 🔒 **JWT Auth** | Secure login with bcrypt password hashing |
| 🤖 **Auto Cleanup** | Cron job auto-deactivates expired links every hour |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React)                           │
│                                                                     │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │  File Input  │───▶│ Web Crypto API   │───▶│ Chunk Upload     │  │
│  │  Drag & Drop │    │ AES-256-GCM Enc  │    │ (Direct→Drive)   │  │
│  └──────────────┘    └──────────────────┘    └────────┬─────────┘  │
└───────────────────────────────────────────────────────┼────────────┘
                                                        │ PUT chunks
          ┌─────────────────────────────────────────────┼────────────┐
          │              GOOGLE DRIVE API               │            │
          │                                             ▼            │
          │                              ┌──────────────────────┐    │
          │                              │  Resumable Upload    │    │
          │                              │  Session (50GB)      │    │
          │                              └──────────────────────┘    │
          └─────────────────────────────────────────────────────────┘
                                         ▲
          ┌──────────────────────────────┼─────────────────────────┐
          │           BACKEND (Express)  │                         │
          │                             │ Create session           │
          │  ┌────────┐  ┌───────────┐  │  ┌────────────────────┐ │
          │  │ JWT    │  │ Rate      │──┘  │ Google OAuth 2.0   │ │
          │  │ Auth   │  │ Limiting  │     └────────────────────┘ │
          │  └────────┘  └───────────┘                            │
          │                                                        │
          │  ┌──────────────────────────────────────────────────┐ │
          │  │                  MongoDB                         │ │
          │  │  Users | Files (metadata) | SharedLinks          │ │
          │  └──────────────────────────────────────────────────┘ │
          └────────────────────────────────────────────────────────┘
```

**Key insight**: Backend only creates the Google Drive resumable session. The actual file bytes flow **directly** from the browser to Google Drive — the backend never buffers them. This enables 50GB uploads without server memory constraints.

---

## 📁 Project Structure

```
secure-share/
├── backend/
│   ├── server.js                 # Express app entry point
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── config/
│       │   └── db.js             # MongoDB connection
│       ├── models/
│       │   ├── User.js           # bcrypt hashing, JWT
│       │   ├── File.js           # Drive ID, encryption metadata
│       │   └── SharedLink.js     # UUID token, expiry, download limits
│       ├── middleware/
│       │   ├── auth.js           # JWT verification
│       │   └── validate.js       # Joi input validation (50GB limit)
│       ├── controllers/
│       │   ├── authController.js # signup / login / me
│       │   ├── fileController.js # upload session, save, list, delete
│       │   └── shareController.js# create / access / download / revoke
│       ├── routes/
│       │   ├── auth.js
│       │   ├── files.js
│       │   └── share.js
│       └── utils/
│           ├── googleDrive.js    # OAuth2 client, resumable session
│           └── cron.js           # Hourly expiry check, daily cleanup
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    ├── .env.example
    └── src/
        ├── main.jsx
        ├── App.jsx               # Router + protected routes
        ├── index.css             # Futuristic dark theme
        ├── context/
        │   └── AuthContext.jsx   # JWT state management
        ├── utils/
        │   ├── api.js            # Axios with JWT interceptor
        │   ├── encryption.js     # AES-256-GCM chunk encryption
        │   └── upload.js         # Resumable Drive upload engine
        ├── pages/
        │   └── LandingPage.jsx
        └── components/
            ├── Auth/
            │   ├── Login.jsx
            │   └── Signup.jsx
            ├── Dashboard/
            │   ├── Dashboard.jsx   # Main dashboard with stats
            │   ├── UploadZone.jsx  # Drag & drop + encrypt + upload
            │   └── FileCard.jsx    # File list item + share modal
            └── Share/
                └── SharePage.jsx  # Public access + download + decrypt
```

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free tier)
- Google Cloud Console account

---

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/secure-share.git
cd secure-share
```

---

### 2. Google Drive API Setup

**Step 1**: Go to [console.cloud.google.com](https://console.cloud.google.com)

**Step 2**: Create a new project → name it **"SecureShare"**

**Step 3**: Enable the **Google Drive API**
- APIs & Services → Library → Search "Google Drive API" → Enable

**Step 4**: Configure OAuth Consent Screen
- APIs & Services → OAuth consent screen
- User Type: External
- Add scope: `https://www.googleapis.com/auth/drive.file`

**Step 5**: Create OAuth 2.0 Credentials
- APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client IDs
- Application type: Web application
- Authorized redirect URIs: `http://localhost:5000/api/auth/google/callback`
- Copy **Client ID** and **Client Secret**

**Step 6**: Get Refresh Token
1. Go to [OAuth2 Playground](https://developers.google.com/oauthplayground)
2. Click ⚙️ (Settings) → check "Use your own OAuth credentials"
3. Enter your Client ID and Client Secret
4. In Step 1: enter `https://www.googleapis.com/auth/drive.file` → Authorize
5. In Step 2: click "Exchange authorization code for tokens"
6. Copy the **refresh_token** from the response

---

### 3. Backend Setup

```bash
cd backend
cp .env.example .env
```

Fill in your `.env`:
```env
PORT=5000
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/secureshare
JWT_SECRET=change_this_to_a_long_random_string_in_production
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
GOOGLE_REFRESH_TOKEN=your_refresh_token
FRONTEND_URL=http://localhost:5173
```

```bash
npm install
npm run dev
# ✅ Server running on http://localhost:5000
```

---

### 4. Frontend Setup

```bash
cd frontend
cp .env.example .env
```

```env
VITE_API_URL=http://localhost:5000/api
VITE_FRONTEND_URL=http://localhost:5173
```

```bash
npm install
npm run dev
# ✅ Frontend running on http://localhost:5173
```

---

## 📡 API Reference

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | ❌ | Register new user |
| POST | `/api/auth/login` | ❌ | Login, returns JWT |
| GET | `/api/auth/me` | ✅ | Get current user profile |

### Files
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/files/upload-session` | ✅ | Create Drive resumable session |
| POST | `/api/files/save` | ✅ | Save file metadata after upload |
| GET | `/api/files` | ✅ | List user's files (paginated) |
| DELETE | `/api/files/:id` | ✅ | Delete file + Drive entry |
| GET | `/api/files/:id/stats` | ✅ | File stats + link history |

### Share
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/share/create` | ✅ | Create expiring share link |
| GET | `/api/share/:token` | ❌ | Validate link + get file info |
| GET | `/api/share/:token/download` | ❌ | Get download URL + increment count |
| GET | `/api/share` | ✅ | List all user's share links |
| DELETE | `/api/share/:id` | ✅ | Revoke a share link |

---

## 🔐 Encryption — How It Works

```
User Password + Random Salt (16 bytes)
           │
           ▼
    PBKDF2-SHA256 (250,000 iterations)
           │
           ▼
    AES-256-GCM CryptoKey
           │
    ┌──────┴──────────────────────────────┐
    │                                     │
    ▼                                     ▼
Chunk 1 + Random IV₁  →  Ciphertext₁   Chunk N + IVₙ  →  Ciphertextₙ
    │                                     │
    └──────────────────┬──────────────────┘
                       │
                       ▼
           Encrypted file (uploaded to Drive)
           IV list + Salt stored in MongoDB
           Password NEVER stored anywhere
```

**Why AES-GCM?** Provides authenticated encryption — detects if the file was tampered with.

**Why per-chunk IVs?** Prevents patterns — even if two chunks have the same plaintext, their ciphertext will be different.

**Why PBKDF2 with 250k iterations?** Makes brute-force attacks computationally expensive (each guess takes ~250ms).

---

## 🌍 Deployment

### Backend → Render.com

1. Push code to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your GitHub repo
4. Settings:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `node server.js`
5. Add all environment variables from `.env`
6. Deploy!

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Settings:
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add environment variable:
   - `VITE_API_URL` = `https://your-app.onrender.com/api`
   - `VITE_FRONTEND_URL` = `https://your-app.vercel.app`
5. Deploy!

---

## 🧪 Security Checklist

- [x] Passwords hashed with bcrypt (12 salt rounds)
- [x] JWT tokens with expiry (7d default)
- [x] Input validation with Joi (50GB limit enforced)
- [x] Helmet.js for secure HTTP headers
- [x] Rate limiting (20 auth attempts / 15min)
- [x] CORS restricted to frontend origin
- [x] File bytes never pass through backend
- [x] Encryption key never stored on server
- [x] Expiry enforced server-side (not just client)
- [x] Download count enforced atomically

---

## 📸 Screenshots

> _Add screenshots here after running the project_

- `screenshots/landing.png` — Landing page
- `screenshots/dashboard.png` — File dashboard with stats
- `screenshots/upload.png` — Upload zone with encryption toggle
- `screenshots/share-modal.png` — Share link creation
- `screenshots/share-page.png` — Public share/download page

---

## 👨‍💻 Built With

- **Frontend**: React 18, Vite, React Router, Framer Motion, Lucide Icons
- **Backend**: Node.js, Express, Helmet, express-rate-limit, node-cron
- **Database**: MongoDB Atlas with Mongoose ODM
- **Storage**: Google Drive API (resumable uploads)
- **Auth**: JWT + bcryptjs
- **Encryption**: Web Crypto API (AES-256-GCM, PBKDF2)
- **Validation**: Joi

---

*SecureShare — Computer Engineering Mini Project*
