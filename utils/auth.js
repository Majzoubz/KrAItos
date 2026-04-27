import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

const SESSION_KEY = 'greengain_session_v2';
const OTP_TTL_MS  = 10 * 60 * 1000; // 10 minutes

const hashPassword = (password) => {
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) + hash) + password.charCodeAt(i);
    hash = hash & hash;
  }
  return 'fl_' + Math.abs(hash).toString(16) + '_' + password.length;
};

const emailToId = (email) => {
  return email.toLowerCase().trim()
    .replace(/@/g, '__at__')
    .replace(/\./g, '__dot__');
};

const generateOTP = () => String(Math.floor(100000 + Math.random() * 900000));

// Checks whether the email domain actually has mail servers (MX records).
// Uses Google's public DNS-over-HTTPS — free, no API key.
async function domainCanReceiveEmail(email) {
  try {
    const domain = email.split('@')[1];
    if (!domain) return false;
    const res  = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
    const data = await res.json();
    return data.Status === 0 && Array.isArray(data.Answer) && data.Answer.length > 0;
  } catch {
    return true; // if DNS check fails (network issue), fail open so users aren't blocked
  }
}

// Sends OTP email via Resend (free, 100 emails/day — one API key from resend.com).
// Set EXPO_PUBLIC_RESEND_KEY in .env.  If not set, OTP is logged to console only.
async function sendOTPEmail(toEmail, toName, code) {
  const key = process.env.EXPO_PUBLIC_RESEND_KEY || '';
  if (!key) {
    console.warn(`[DEV] OTP for ${toEmail}: ${code}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      from: 'KrAItos <onboarding@resend.dev>',
      to: toEmail,
      subject: 'Your KrAItos verification code',
      text: `Hi ${toName},\n\nYour KrAItos verification code is:\n\n${code}\n\nIt expires in 10 minutes.\n\nIf you did not create an account, ignore this email.`,
    }),
  });
  if (!res.ok) throw new Error(`Email send failed (${res.status})`);
}

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

      // Validate email domain has real mail servers
      const domainOk = await domainCanReceiveEmail(email);
      if (!domainOk) {
        return { error: 'This email address does not appear to be valid. Please use a real email.' };
      }

      const code = generateOTP();

      const userData = {
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        uid,
        passwordHash: hashPassword(password),
        emailVerified: false,
        createdAt: Date.now(),
        mealsScanned: 0,
        workoutsLogged: 0,
        streak: 0,
        lastActive: null,
      };

      await Promise.all([
        setDoc(userRef, userData),
        setDoc(doc(db, 'otpVerifications', uid), {
          code,
          expiresAt: Date.now() + OTP_TTL_MS,
        }),
      ]);

      await sendOTPEmail(email.toLowerCase().trim(), fullName.trim(), code);

      return { needsVerification: true, uid, email: email.toLowerCase().trim(), fullName: fullName.trim() };
    } catch (e) {
      console.error('Signup error:', e);
      return { error: 'Signup failed. Check your internet connection.' };
    }
  },

  async verifyOTP(uid, code) {
    try {
      const otpRef  = doc(db, 'otpVerifications', uid);
      const otpSnap = await getDoc(otpRef);

      if (!otpSnap.exists()) {
        return { error: 'Verification code not found. Please request a new one.' };
      }

      const { code: stored, expiresAt } = otpSnap.data();

      if (Date.now() > expiresAt) {
        return { error: 'This code has expired. Please request a new one.' };
      }

      if (code.trim() !== stored) {
        return { error: 'Incorrect code. Please check your email and try again.' };
      }

      const userRef = doc(db, 'users', uid);
      await Promise.all([
        updateDoc(userRef, { emailVerified: true }),
        deleteDoc(otpRef),
      ]);

      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ uid }));
      const snap = await getDoc(userRef);
      return { user: { ...snap.data(), uid } };
    } catch (e) {
      console.error('OTP verify error:', e);
      return { error: 'Verification failed. Check your internet connection.' };
    }
  },

  async resendOTP(uid, email, fullName) {
    try {
      const code = generateOTP();
      await setDoc(doc(db, 'otpVerifications', uid), {
        code,
        expiresAt: Date.now() + OTP_TTL_MS,
      });
      await sendOTPEmail(email, fullName, code);
      return { success: true };
    } catch (e) {
      console.error('Resend OTP error:', e);
      return { error: 'Could not resend code. Check your internet connection.' };
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

      // emailVerified === undefined → old account created before this feature, let in
      if (userData.emailVerified === false) {
        return {
          error: 'Please verify your email before logging in.',
          needsVerification: true,
          uid,
          email: userData.email,
          fullName: userData.fullName,
        };
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
