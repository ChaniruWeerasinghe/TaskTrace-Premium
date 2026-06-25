# TaskTrace Premium v2.0

A **State-of-the-Art** project tracking and team collaboration platform. Built with a focus on **Premium Aesthetics**, **Real-time Synchronization**, and **Integrated Communication**.

TaskTrace v2.0 leverages **Firebase Cloud Infrastructure** and **Agora RTC** to provide a seamless environment for modern development teams.

## Features Overview

| Feature | Description |
| :--- | :--- |
| **Real-time Engine** | Instant synchronization of projects, tasks, and members across all devices via Firebase. |
| **Voice Meetings** | High-fidelity voice collaboration powered by Agora RTC. |
| **Smart Analytics** | Dynamic velocity charts and team performance metrics for deep insights. |
| **Participation Reports** | Automated tracking of speaking time with historical access for every session. |
| **Subtask Ecosystem** | Granular mission breakdowns with logic-enhanced completion flows. |
| **Secure Core** | Professional Firebase Auth integration with profile-to-member mapping. |
| **Admin Shield** | Specialized "Admin Mode" for advanced system cleanup and meeting management. |
| **Premium Design** | State-of-the-art glassmorphism UI with fluid animations and responsive layout. |

## Key Features In-Depth

### Integrated Meeting Room
- **Voice Collaboration**: Real-time audio powered by Agora RTC.
- **Participation Analytics**: Automated tracking of speaking time and engagement.
- **Historical Reports**: Access detailed participation logs for any past meeting directly from the history grid.
- **Smart Entry**: Integrated "Who are you?" identity verification for guest invitees.

### Secure Access & Admin Control
- **Firebase Authentication**: Secure Sign-in, Sign-up, and Password recovery.
- **Admin Mission Mode**: Advanced "Root" access for force-ending meetings and purging legacy data (triggered via logo interaction).
- **Identity Mapping**: Deep integration between Firebase Auth users and Project Member profiles.

### Advanced Mission Analytics
- **Performance Charting**: Dynamic velocity graphs tracking daily task and subtask completions.
- **Comprehensive Reports**: Visual status distribution across team members.
- **Deadline Independence**: Intelligent activity tracking that works even for projects without defined sprint dates.

### Modern Workflow Management
- **Subtask Ecosystem**: Detailed mission breakdown with bulk-completion logic ("Mark All Done").
- **Smart Positioning**: UI dropdowns and overlays that intelligently avoid clipping by detecting screen edges.
- **Live Sync**: Real-time updates across all pages using Firebase Realtime Database.

## Build Stack
- **Frontend**: HTML5, Vanilla JavaScript (ES6+), Tailwind CSS (Premium Glassmorphism).
- **Communication**: Agora RTC SDK.
- **Backend & Auth**: Firebase Cloud (Realtime DB, Authentication, Hosting).
- **Visuals**: Lucide Icons, Custom Keyframe Animations.

## Getting Started
1. **Clone the repository**:
   ```bash
   git clone https://github.com/Chanii2024/TaskTrace-Premium.git
   ```
2. **Setup**: This project is optimized for Firebase Hosting. Ensure your `firebase.js` (or inline config) is populated with your project credentials.
3. **Local Testing**: Serve the directory using any static server (e.g., Live Server, `npx serve`, or `python -m http.server`).

## Deployment
```bash
# Login to your Firebase console
firebase login

# Deploy all changes to production
firebase deploy --only hosting
```

---
*Developed with ❤️ by **Chaniru Weerasinghe***
