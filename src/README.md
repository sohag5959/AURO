# Auro Browser: Architectural Overview

Auro is a specialized student productivity workspace designed for classes, research, and exam prep. Unlike standard browsers, Auro prioritizes focus and study workflow through a localized simulation engine.

## 🏗️ Technical Architecture

### Frontend (React + Vite)
- **UI Framework**: React 19 with Tailwind CSS for high-performance styling.
- **State Management**: React Hooks (useState/useEffect) for real-time study tracking.
- **UI Patterns**: Adheres to the "Backend-for-Frontend" (BFF) pattern to ensure security.

### Backend (Node.js + Express)
- **Server Entry**: `server.ts` manages API proxying and static file serving.
- **AI Integration**: Securely communicates with Google Gemini API via server-side calls, keeping API keys hidden from client bundles.
- **Production Readiness**: Configured to run on Port 3000 as required by standard Cloud Run environments.

## 🛡️ Security Implementation
- **Zero Client-Side Secrets**: All sensitive API keys are stored in environment variables accessible only to the server.
- **XSS Protection**: Sanitized data handling for AI outputs and research snippets.
- **Ad-Shield**: Simulated filtering logic to minimize distractions during deep work.

## 🚀 Deployment
1. Build the production bundle: `npm run build`
2. Start the production server: `npm run start`

The application served on Port 3000 is ready for horizontal scaling and secure production use.
