import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

const SESSION_KEY = 'fitlife_session_v2';

// Simple but consistent hash - same input always gives same output
const hashPassword = (password) => {
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) + hash) + password.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'fl_' + Math.abs(hash).toString(16) + '_' + password.length;
};

// Use email as document ID - sanitize it safely
const emailToId = (email) => {
  return email.toLowerCase().trim()
    .replace(/@/g, '__at__')
    .replace(/\./g, '__dot__');
};

export const Auth = {
  onAuthChange(callback) {
    Auth.getSession().then(user => callback(user));
    return () => {};
  },

  async signup(fullName, email, password) {
    try {
      const uid     = emailToId(email);
      const userRef = doc(db, 'users', uid);
      const existing = await getDoc(userRef);

      if (existing.exists()) {
        return { error: 'An account with this email already exists.' };
      }

      const userData = {
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        uid,
        passwordHash: hashPassword(password),
        createdAt: Date.now(),
        mealsScanned: 0,
        workoutsLogged: 0,
        streak: 0,
        lastActive: null,
      };

      await setDoc(userRef, userData);
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ uid }));
      return { user: userData };
    } catch (e) {
      console.error('Signup error:', e);
      return { error: 'Signup failed. Check your internet connection.' };
    }
  },

  async login(email, password) {
    try {
      const uid     = emailToId(email);
      const userRef = doc(db, 'users', uid);
      const snap    = await getDoc(userRef);

      if (!snap.exists()) {
        return { error: 'No account found with this email.' };
      }

      const userData = snap.data();
      if (userData.passwordHash !== hashPassword(password)) {
        return { error: 'Incorrect password.' };
      }

      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ uid }));
      return { user: { ...userData, uid } };
    } catch (e) {
      console.error('Login error:', e);
      return { error: 'Login failed. Check your internet connection.' };
    }
  },

  async logout() {
    await AsyncStorage.removeItem(SESSION_KEY);
  },

  async getSession() {
    try {
      const raw = await AsyncStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const { uid } = JSON.parse(raw);
      if (!uid) return null;
      return await Auth.getUserData(uid);
    } catch { return null; }
  },

  async getUserData(uid) {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      return snap.exists() ? { ...snap.data(), uid } : null;
    } catch { return null; }
  },

  async updateUser(uid, updates) {
    try {
      await updateDoc(doc(db, 'users', uid), updates);
      return await Auth.getUserData(uid);
    } catch { return null; }
  },

  async logActivity(uid) {
    try {
      const user = await Auth.getUserData(uid);
      if (!user) return null;
      const today     = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      let streak = user.streak || 0;
      if (user.lastActive === today) {
        // already counted today, no change
      } else if (user.lastActive === yesterday) {
        streak += 1;
      } else {
        streak = 1;
      }
      await updateDoc(doc(db, 'users', uid), { streak, lastActive: today });
      return await Auth.getUserData(uid);
    } catch { return null; }
  },
};