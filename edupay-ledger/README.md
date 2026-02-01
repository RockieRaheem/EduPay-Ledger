# 📚 eBursar

**Desktop-First School Fee Management System for Ugandan Schools**

*Built for School Bursars • Works Offline • Syncs When Online*

[![Windows](https://img.shields.io/badge/Download-Windows-0078D6?style=for-the-badge&logo=windows)](https://github.com/your-org/ebursar/releases)
[![macOS](https://img.shields.io/badge/Download-macOS-000000?style=for-the-badge&logo=apple)](https://github.com/your-org/ebursar/releases)
[![Linux](https://img.shields.io/badge/Download-Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black)](https://github.com/your-org/ebursar/releases)

![Version](https://img.shields.io/badge/Version-1.0.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Offline](https://img.shields.io/badge/Offline-Ready-success)
![Tests](https://img.shields.io/badge/Tests-58%20passing-brightgreen)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Download and Installation](#download-and-installation)
- [Quick Start Guide](#quick-start-guide)
- [How It Works](#how-it-works)
- [For Developers](#for-developers)
- [System Requirements](#system-requirements)
- [Support](#support)

---

## Overview

**eBursar** is a comprehensive school fee management desktop application designed specifically for **School Bursars** in Ugandan primary and secondary schools. 

### The Problem We Solve

| Challenge | Our Solution |
|-----------|--------------|
| **Paper-based tracking** leads to errors and lost records | Digital records with automatic backups |
| **No internet in rural areas** makes cloud apps useless | **Works completely offline** - no internet required |
| **Revenue leakage** from poor reconciliation | Real-time balance tracking and audit trails |
| **Mobile Money tracking** is manual and error-prone | Integrated MTN & Airtel Money tracking |
| **No receipts** means disputes with parents | Automatic receipt generation with unique numbers |

### Who Is This For?

🎯 **Primary Users: School Bursars**
- Record fee payments (cash, mobile money, bank transfer)
- Track student balances and arrears
- Generate receipts and reports
- Manage installment plans

📊 **Secondary Users: School Administrators**
- View collection dashboards
- Monitor arrears and outstanding fees
- Access audit trails and reports

---

## Key Features

### Offline-First Architecture
```
┌─────────────────────────────────────────────────────────────┐
│  eBursar Desktop App                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Local Database (IndexedDB)                          │   │
│  │  • All student records                               │   │
│  │  • Payment history                                   │   │
│  │  • Receipts & reports                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↕ Auto-sync when online            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Cloud Backup (Firebase)                             │   │
│  │  • Encrypted data sync                               │   │
│  │  • Multi-device access                               │   │
│  │  • Automatic conflict resolution                     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Core Functionality

| Feature | Description |
|---------|-------------|
| **Student Directory** | Complete student database with search, filter by class/stream |
| **Payment Recording** | Record Cash, MTN MoMo, Airtel Money, Bank Transfer payments |
| **Auto Receipts** | Generate printable receipts with unique receipt numbers |
| **Balance Tracking** | Real-time view of each student's fee balance |
| **Arrears Management** | Track overdue payments with severity levels |
| **Installment Plans** | Configure payment plans per term with deadlines |
| **Reports** | Daily, weekly, monthly, and term-based collection reports |
| **Audit Trail** | Complete history of all transactions for accountability |

### Security and Data Safety

- **Local-first storage** - Your data stays on your computer
- **Encrypted sync** - When syncing online, all data is encrypted
- **Role-based access** - Different permissions for bursars vs admins
- **Automatic backups** - Local backups every hour
- **Audit logs** - Every action is recorded with timestamps

---

## Download and Installation

### Windows

1. **Download** the installer: `ebursar-Setup-1.0.0.exe`
2. **Run** the installer (you may need to click "More info" → "Run anyway")
3. **Launch** eBursar from your desktop or Start menu
4. **Create account** or use demo mode to explore

### macOS

1. **Download** the disk image: `ebursar-1.0.0.dmg`
2. **Open** the DMG file
3. **Drag** eBursar to your Applications folder
4. **Launch** from Applications (first time: right-click → Open)

### Linux

```bash
# Ubuntu/Debian
sudo dpkg -i ebursar_1.0.0_amd64.deb

# Fedora/RHEL
sudo rpm -i ebursar-1.0.0.x86_64.rpm

# AppImage (any distro)
chmod +x ebursar-1.0.0.AppImage
./ebursar-1.0.0.AppImage
```

---

## Quick Start Guide

### First Time Setup

1. **Launch the app** and click "Get Started"
2. **Enter school details:**
   - School name
   - Location (District, Sub-county)
   - Contact information
3. **Set up fee structure:**
   - Term fees by class
   - Optional fees (lunch, transport, etc.)
4. **Import or add students:**
   - Import from Excel/CSV
   - Or add students manually
5. **Start recording payments!**

### Recording a Payment

```
1. Click "Record Payment" or press Ctrl+P
2. Search for student by name or ID
3. Select payment method:
   • Cash
   • MTN Mobile Money (enter transaction ID)
   • Airtel Money (enter transaction ID)
   • Bank Transfer (enter reference)
4. Enter amount
5. Click "Record Payment"
6. Receipt is automatically generated!
```

### Viewing Reports

- **Dashboard** → Overview of today's collections
- **Reports** → Detailed reports by date range
- **Export** → Download as PDF or Excel

---

## How It Works

### Offline Mode

eBursar stores **all data locally** on your computer using IndexedDB. This means:

✅ Works without internet connection  
✅ Fast performance (no waiting for server)  
✅ Your data is always accessible  
✅ No monthly server costs  

### Online Sync

When internet is available, ebursar automatically:

1. **Uploads** new payments and records to the cloud
2. **Downloads** any changes from other devices
3. **Resolves conflicts** using last-write-wins strategy
4. **Backs up** your entire database

### Sync Status Indicators

| Icon | Status |
|------|--------|
| 🟢 | Online - All data synced |
| 🟡 | Syncing - Upload/download in progress |
| 🔴 | Offline - Working locally |
| ⚠️ | Sync error - Will retry automatically |

---

## For Developers

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Desktop Framework** | Electron 28 |
| **Frontend** | Next.js 14, React 18, TypeScript |
| **UI Components** | Tailwind CSS, Custom Design System |
| **Local Database** | IndexedDB via Dexie.js |
| **Cloud Sync** | Firebase Firestore |
| **State Management** | Zustand |
| **Forms & Validation** | React Hook Form + Zod |
| **Testing** | Jest + React Testing Library |

### Project Structure

```
ebursar/
├── electron/                # Electron main process
│   ├── main.ts             # App entry point
│   ├── preload.ts          # Secure bridge to renderer
│   └── updater.ts          # Auto-update logic
├── app/                     # Next.js pages (App Router)
│   ├── dashboard/          # Main dashboard
│   ├── students/           # Student management
│   ├── payments/           # Payment recording
│   ├── arrears/            # Arrears tracking
│   ├── reports/            # Financial reports
│   └── settings/           # App settings
├── components/
│   ├── ui/                 # Reusable UI components
│   └── navigation/         # Sidebar, TopNav
├── lib/
│   ├── db/                 # IndexedDB setup & queries
│   ├── sync/               # Online sync logic
│   ├── firebase.ts         # Firebase configuration
│   └── utils.ts            # Helper functions
├── hooks/                   # Custom React hooks
├── types/                   # TypeScript definitions
└── __tests__/              # Test files
```

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/ebursar.git
cd ebursar

# Install dependencies
npm install

# Run in development mode
npm run dev              # Web version
npm run electron:dev     # Desktop version

# Run tests
npm test

# Build for production
npm run electron:build   # Creates installers for all platforms
```

### Environment Variables

Create `.env.local` for development:

```env
# Firebase (for cloud sync - optional for offline-only use)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# App Configuration
NEXT_PUBLIC_APP_MODE=desktop
NEXT_PUBLIC_SYNC_ENABLED=true
```

### Building Installers

```bash
# Windows (.exe installer)
npm run electron:build:win

# macOS (.dmg)
npm run electron:build:mac

# Linux (.deb, .rpm, .AppImage)
npm run electron:build:linux

# All platforms
npm run electron:build:all
```

---

## System Requirements

### Minimum Requirements

| Component | Requirement |
|-----------|-------------|
| **OS** | Windows 10, macOS 10.14, Ubuntu 18.04 |
| **RAM** | 4 GB |
| **Storage** | 500 MB free space |
| **Display** | 1280 x 720 resolution |

### Recommended

| Component | Recommendation |
|-----------|----------------|
| **OS** | Windows 11, macOS 12+, Ubuntu 22.04 |
| **RAM** | 8 GB |
| **Storage** | 1 GB free space (for large databases) |
| **Display** | 1920 x 1080 resolution |
| **Internet** | For cloud sync (not required for basic use) |

---

## Support

### Getting Help

- **User Guide**: Built into the app (Help → User Guide)
- **Email Support**: kamwangaraheem2050@gmail.com
- **WhatsApp**: +256704057370
- **Report Issues**: [GitHub Issues](https://github.com/your-org/ebursar/issues)

### Frequently Asked Questions

<details>
<summary><strong>Can I use eBursar without internet?</strong></summary>

Yes! eBursar is designed to work completely offline. All your data is stored locally on your computer. Internet is only needed for:
- Initial setup (optional - you can use demo mode)
- Syncing data to cloud backup
- Accessing from multiple devices
</details>

<details>
<summary><strong>What happens if my computer crashes?</strong></summary>

If you have cloud sync enabled, all your data is safely backed up. Simply install eBursar on a new computer, log in with your account, and all data will sync automatically.

If you're using offline-only mode, we recommend enabling automatic local backups (Settings → Backup → Enable Auto Backup).
</details>

<details>
<summary><strong>Can multiple bursars use the same system?</strong></summary>

Yes! With cloud sync enabled:
- Each bursar installs the app on their computer
- They log in with their account
- Data syncs automatically between all devices
- Conflict resolution handles simultaneous edits
</details>

<details>
<summary><strong>How do I import existing student data?</strong></summary>

Go to Students → Import → Upload Excel/CSV file. The app will guide you through mapping columns to the correct fields. Download our template for the correct format.
</details>

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Built for Ugandan schools with ❤️
- Designed with input from school bursars across Uganda

---

**eBursar** - Simplifying School Fee Management

*No Internet? No Problem.*

