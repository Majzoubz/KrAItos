# FitLife - AI-Powered Fitness & Nutrition App

## Overview
FitLife is a React Native / Expo fitness application that runs on web via `react-native-web`. It provides AI-powered nutrition coaching, food scanning, workout planning, and progress tracking.

## Tech Stack
- **Framework**: React Native with Expo SDK 54
- **Web Support**: `react-native-web` (runs in browser via Metro bundler)
- **Package Manager**: npm
- **Backend/Database**: Firebase (Firestore + Auth)
- **AI**: Groq AI API (llama-3.3-70b-versatile for text, llama-4-scout for vision)
- **Language**: JavaScript (ES6+)

## Project Structure
```
App.js              # Root entry, manual navigation (no expo-router)
screens/            # All screen components
  AuthScreen.js     # Login / Sign Up
  HomeScreen.js     # Dashboard
  FoodScannerScreen.js  # Camera food analysis
  FoodlogScreen.js  # Food log history
  AICoachScreen.js  # AI chat coach
  MyPlanScreen.js   # Personalized plans
  TrackerScreen.js  # Water & streak tracking
  ARScreen.js       # AR workout guide
  ProfileScreen.js  # User profile
components/
  BottomNav.js      # Mobile bottom navigation
  WebLayout.js      # Desktop sidebar layout
  UI.js             # Shared UI primitives
utils/
  firebase.js       # Firebase init & Firestore
  auth.js           # Auth logic
  api.js            # Groq AI integration
  storage.js        # AsyncStorage wrapper
  platform.js       # Platform detection helpers
constants/
  theme.js          # Color palette & design tokens
```

## Environment Variables Required
The app needs the following environment variables (set as Replit Secrets):
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_GROQ_API_KEY` (used in utils/api.js)

## Running the App
The workflow "Start application" runs:
```
npx expo start --web --port 5000 --host lan
```
This serves the web version at port 5000 via Metro bundler.

## Navigation
The app uses manual state-based navigation (not expo-router). Screen changes are handled via `navigate()` function in `App.js`.

## Layout
- **Mobile / Narrow web**: Bottom navigation bar (`BottomNav`)
- **Wide web (>768px)**: Sidebar layout (`WebLayout`)
