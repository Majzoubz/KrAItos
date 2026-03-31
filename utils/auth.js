import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'fitlife_session_v2';
const USERS_KEY = 'fitlife_users';

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

const getAllUsers = async () => {
  try {
    const raw = await AsyncStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

const saveAllUsers = async (users) => {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const Auth = {
  onAuthChange(callback) {
    Auth.getSession().then(user => callback(user));
    return () => {};
  },

  async signup(fullName, email, password) {
    try {
      const uid = emailToId(email);
      const users = await getAllUsers();

      if (users[uid]) {
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

      users[uid] = userData;
      await saveAllUsers(users);
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ uid }));
      return { user: userData };
    } catch (e) {
      console.error('Signup error:', e);
      return { error: 'Signup failed. Please try again.' };
    }
  },

  async login(email, password) {
    try {
      const uid = emailToId(email);
      const users = await getAllUsers();
      const userData = users[uid];

      if (!userData) {
        return { error: 'No account found with this email.' };
      }

      if (userData.passwordHash !== hashPassword(password)) {
        return { error: 'Incorrect password.' };
      }

      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ uid }));
      return { user: { ...userData, uid } };
    } catch (e) {
      console.error('Login error:', e);
      return { error: 'Login failed. Please try again.' };
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
      const users = await getAllUsers();
      return users[uid] ? { ...users[uid], uid } : null;
    } catch { return null; }
  },

  async updateUser(uid, updates) {
    try {
      const users = await getAllUsers();
      if (!users[uid]) return null;
      users[uid] = { ...users[uid], ...updates };
      await saveAllUsers(users);
      return { ...users[uid], uid };
    } catch { return null; }
  },

  async logActivity(uid) {
    try {
      const users = await getAllUsers();
      const user = users[uid];
      if (!user) return null;
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      let streak = user.streak || 0;
      if (user.lastActive === today) {
      } else if (user.lastActive === yesterday) {
        streak += 1;
      } else {
        streak = 1;
      }
      users[uid] = { ...user, streak, lastActive: today };
      await saveAllUsers(users);
      return { ...users[uid], uid };
    } catch { return null; }
  },
};
