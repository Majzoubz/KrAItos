# GreenGain - AI-Powered Fitness & Nutrition App

## Overview
GreenGain is a React Native / Expo fitness application that runs on web via `react-native-web`. It provides AI-powered nutrition coaching, food scanning, workout planning, and progress tracking. Inspired by MacroFactor and Cal AI.

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
assets/
  logo.png          # GreenGain neon green logo (dumbbell + apple + leaf)
screens/
  WelcomeScreen.js  # Animated landing page with logo, glow effects, feature grid
  AuthScreen.js     # Login / Sign Up (defaults to signup first)
  OnboardingScreen.js # 19-step questionnaire with section transitions & building screen
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
  WebLayout.js      # Desktop sidebar layout with logo
  UI.js             # Shared UI primitives
utils/
  firebase.js       # Firebase init & Firestore (env var based)
  auth.js           # Auth logic (custom hash + Firestore, not Firebase Auth SDK)
  api.js            # Groq AI integration
  storage.js        # Firestore data storage
  platform.js       # Platform detection helpers
constants/
  theme.js          # Color palette & design tokens (lime green #7FFF00)
```

## Environment Variables Required
The app needs the following environment variables (set as Replit Secrets):
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_GROQ_KEY` (used in utils/api.js)

## Running the App
The workflow "Start application" runs:
```
EXPO_NO_DOTENV=1 npx expo start --web --port 5000 --host lan
```
This serves the web version at port 5000 via Metro bundler.

## Navigation Flow
1. **Welcome Screen** — Animated landing with GreenGain logo, pulsing glow, feature grid
2. **Auth Screen** — Sign Up (default) / Log In with logo
3. **Onboarding** — 19-step questionnaire divided into sections:
   - **About You** (12 steps): Gender, birthday, units, height, weight, max weight, weight trend, body fat, activity level, training experience, cardio experience, exercise frequency
   - **Your Goal** (3 steps): Primary goal, target weight, weekly rate of change
   - **Program** (4 steps): Nutrition approach, training preference, calorie strategy, protein target
   - Animated section transitions between each section
   - "Building Your Program" screen with phase checklist at the end
4. **Main App** — Dashboard with bottom nav (mobile) or sidebar (desktop)

Returning users who already completed onboarding skip directly to Home after login.

## Design System
- **Color palette**: Lime/Chartreuse green (#7FFF00) + pure black (#000000) + white (#FFFFFF)
- **Theme file**: `constants/theme.js`
- **Surface colors**: `#0A0A0A` (surface), `#111111` (card), `#1A1A1A` (border)
- **Green glows**: `rgba(127,255,0,0.15)`, `rgba(127,255,0,0.08)`, `rgba(127,255,0,0.04)`
- **Cards**: Dark surface with subtle borders, rounded corners (16px)
- **Buttons**: Lime green, bold text, rounded 16px
- **Logo**: Neon green dumbbell + apple + leaf icon on black
- **Onboarding inputs**: Visual cards for selection, icons, grid layouts for frequency

## Layout
- **Mobile / Narrow web**: Bottom navigation bar (`BottomNav`)
- **Wide web (>768px)**: Sidebar layout (`WebLayout`)
- **Units**: Supports Metric (kg/cm) and Imperial (lbs/ft-in) throughout onboarding
