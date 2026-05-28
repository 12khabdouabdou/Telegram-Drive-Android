# Telegram Drive - Android App

**Telegram Drive** is an open-source, cross-platform application that turns your Telegram account into an unlimited, secure cloud storage drive. This is the **Android version** built with **Tauri**, **Rust**, and **React**, featuring all the same capabilities as the desktop app.

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Android-blue)]()
[![Build Status](https://github.com/12khabdouabdou/Telegram-Drive-Android/actions/workflows/android.yml/badge.svg)](https://github.com/12khabdouabdou/Telegram-Drive-Android/actions)

</div>

## 📱 Android Features

This Android app includes **all desktop features**:

### Core Features
- ✅ **Unlimited Cloud Storage** - Store unlimited files on Telegram's infrastructure
- ✅ **File Management** - Upload, download, delete, move, rename files
- ✅ **Folder System** - Create/delete folders (Telegram channels)
- ✅ **Grid & List Views** - Toggle between grid and list display
- ✅ **Multi-Select** - Long-press to select multiple files for batch operations
- ✅ **Search** - Search files by name within folders

### Media
- ✅ **Video Streaming** - Stream videos directly without downloading
- ✅ **Audio Playback** - Built-in audio player with controls
- ✅ **PDF Viewer** - View PDFs with zoom and page navigation
- ✅ **Image Gallery** - Full-screen image viewer with swipe navigation

### Sharing
- ✅ **Share Links** - Generate downloadable links
- ✅ **Password Protection** - Secure shares with passwords
- ✅ **Expiration** - Set link expiration (1h, 1d, 7d, custom)
- ✅ **Revoke Access** - Cancel shared links anytime
- ✅ **Share Dashboard** - Manage all active shares

### Network
- ✅ **Proxy Support** - SOCKS5 and MTProto proxy configuration
- ✅ **VPN Optimizer** - Network tuning for unstable connections
- ✅ **Bandwidth Throttling** - Control upload/download limits
- ✅ **Connection Testing** - Test network connectivity

### UI/UX
- ✅ **Dark & Light Theme** - Full theme support
- ✅ **Touch Optimized** - Large touch targets, gestures
- ✅ **Floating Bottom Nav** - Ergonomic thumb-friendly navigation
- ✅ **Bottom Sheet Menus** - Context menus and actions
- ✅ **Pull-to-Refresh** - Sync folder contents
- ✅ **Transfer Progress** - Real-time upload/download progress

## 📦 Installation

### Build from Source

1. **Prerequisites:**
   - Node.js 18+
   - Rust (latest stable)
   - Android SDK (API 34+)
   - Java JDK 17

2. **Build the APK:**
   ```bash
   git clone https://github.com/12khabdouabdou/Telegram-Drive-Android.git
   cd Telegram-Drive-Android
   cd app && npm install
   npm run tauri build -- --target aarch64-linux-android --bundles android
   ```

3. **APK Location:**
   - Find your APK at: `app/src-tauri/target/*/android-build/*.apk`

### Sideload the APK

1. Download the built APK from GitHub Releases or Actions artifacts
2. Enable "Install from Unknown Sources":
   - Go to **Settings → Apps → Special App Access → Install unknown apps**
   - Select your browser or file manager
3. Open the APK and tap **Install**
4. On first launch, enter your Telegram API credentials

## 🔧 Getting API Credentials

1. Visit [my.telegram.org](https://my.telegram.org)
2. Log in with your phone number
3. Go to "API development tools"
4. Create a new application
5. Copy your `api_id` and `api_hash`

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, TailwindCSS 4, Framer Motion
- **Backend**: Rust (Tauri 2), Grammers (Telegram Client)
- **Streaming**: Actix-web
- **Database**: SQLite
- **Build Tool**: Vite 7

## 📁 Project Structure

```
Telegram-Drive-Android/
├── app/
│   ├── src/
│   │   ├── components/
│   │   │   ├── mobile/          # Mobile-specific components
│   │   │   │   ├── MobileDashboard.tsx
│   │   │   │   ├── BottomNavBar.tsx
│   │   │   │   ├── TouchFileList.tsx
│   │   │   │   ├── MobileMediaPlayer.tsx
│   │   │   │   ├── MobilePdfViewer.tsx
│   │   │   │   ├── MobileImageGallery.tsx
│   │   │   │   ├── MobileShareDialog.tsx
│   │   │   │   ├── MobileShareDashboard.tsx
│   │   │   │   ├── MobileNetworkSettings.tsx
│   │   │   │   ├── CreateFolderModal.tsx
│   │   │   │   ├── MoveToFolderModal.tsx
│   │   │   │   └── ContextMenu.tsx
│   │   │   ├── desktop/         # Desktop components
│   │   │   └── shared/          # Shared components
│   │   ├── hooks/               # Custom React hooks
│   │   ├── context/             # React contexts
│   │   └── types.ts             # TypeScript types
│   ├── src-tauri/               # Rust backend
│   │   └── src/
│   │       ├── commands/        # Tauri commands
│   │       ├── lib.rs           # Main library
│   │       ├── server.rs        # Streaming server
│   │       └── ...
│   └── package.json
├── .github/
│   └── workflows/
│       ├── main.yml             # Multi-platform CI
│       ├── release.yml          # Release workflow
│       └── android.yml          # Android build
└── README.md
```

## ⚙️ GitHub Actions

This repo includes CI/CD workflows that automatically:

- **Build Android APK** on every push to `main` or `develop`
- **Build Desktop Apps** (Windows, macOS, Linux) on every push
- **Create Releases** with all platform binaries

### Workflow Files

| File | Purpose |
|------|---------|
| `main.yml` | Build all platforms on push/PR |
| `android.yml` | Dedicated Android build workflow |
| `release.yml` | Create GitHub releases with binaries |

## ⚠️ Important Notes

1. **Unsigned APK**: The CI builds produce unsigned APKs. For Google Play distribution, you'll need to sign the APK.

2. **Permissions**: The app requires:
   - `INTERNET` - For Telegram API communication
   - `READ_EXTERNAL_STORAGE` - For file uploads
   - `WRITE_EXTERNAL_STORAGE` - For downloads
   - `FOREGROUND_SERVICE` - For background transfers

3. **Privacy**: All data stays local. API keys and credentials are stored on-device only.

## 📄 License

Licensed under the **MIT License**.

---

*Disclaimer: This application is not affiliated with Telegram FZ-LLC. Use responsibly and in accordance with Telegram's Terms of Service.*