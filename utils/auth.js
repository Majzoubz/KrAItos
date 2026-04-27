import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

const SESSION_KEY = 'greengain_session_v2';
const OTP_TTL_MS  = 10 * 60 * 1000;

const hashPassword = (password) => {
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) + hash) + password.charCodeAt(i);
    hash = hash & hash;
  }
  return 'fl_' + Math.abs(hash).toString(16) + '_' + password.length;
};

const emailToId = (email) =>
  email.toLowerCase().trim()
    .replace(/@/g, '__at__')
    .replace(/\./g, '__dot__');

const generateOTP = () => String(Math.floor(100000 + Math.random() * 900000));

async function sendOTPEmail(toEmail, toName, code) {
  const serviceId  = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID  || '';
  const templateId = process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID || '';
  const publicKey  = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY  || '';

  if (!serviceId || !templateId || !publicKey) {
    console.log(`\n==============================`);
    console.log(`  OTP for ${toEmail}: ${code}`);
    console.log(`==============================\n`);
    return;
  }

  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id:      serviceId,
      template_id:     templateId,
      user_id:         publicKey,
      template_params: { to_email: toEmail, to_name: toName, otp_code: code },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Email send failed (${res.status}): ${body}`);
  }
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
        const data = existing.data();
        // Allow re-sending OTP if account exists but was never verified
        if (data.emailVerified === false) {
          const code = generateOTP();
          await setDoc(doc(db, 'otpVerifications', uid), { code, expiresAt: Date.now() + OTP_TTL_MS });
          try { await sendOTPEmail(email.toLowerCase().trim(), data.fullName, code); } catch {}
          return { needsVerification: true, uid, email: data.email, fullName: data.fullName };
        }
        return { error: 'An account with this email already exists.' };
      }

      const code    = generateOTP();
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

      try {
        await sendOTPEmail(email.toLowerCase().trim(), fullName.trim(), code);
      } catch (e) {
        console.warn('Email send failed (OTP in terminal above):', e.message);
      }

      return { needsVerification: true, uid, email: email.toLowerCase().trim(), fullName: fullName.trim() };
    } catch (e) {
      console.error('Signup error:', e);
      return { error: 'Signup failed. Check your internet connection.' };
    }
  },

  async verifyOTP(uid, code) {
    try {
      const otpSnap = await getDoc(doc(db, 'otpVerifications', uid));
      if (!otpSnap.exists()) return { error: 'Verification code not found. Please request a new one.' };

      const { code: stored, expiresAt } = otpSnap.data();
      if (Date.now() > expiresAt) return { error: 'This code has expired. Please request a new one.' };
      if (code.trim() !== stored)  return { error: 'Incorrect code. Please check your email and try again.' };

      await Promise.all([
        updateDoc(doc(db, 'users', uid), { emailVerified: true }),
        deleteDoc(doc(db, 'otpVerifications', uid)),
      ]);

      return { success: true };
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
      const uid  = emailToId(email);
      const snap = await getDoc(doc(db, 'users', uid));
      if (!snap.exists()) return { error: 'No account found with this email.' };

      const userData = snap.data();
      if (userData.passwordHash !== hashPassword(password)) return { error: 'Incorrect password.' };

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
      } else { streak = 1; }
      await updateDoc(doc(db, 'users', uid), { streak, lastActive: today });
      return await Auth.getUserData(uid);
    } catch { return null; }
  },
};
