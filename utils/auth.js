import { Storage, KEYS } from './storage';

export const Auth = {
  async signup(fullName, email, password) {
    const users = (await Storage.get(KEYS.USERS)) || {};
    if (users[email.toLowerCase()]) {
      return { error: 'An account with this email already exists.' };
    }
    const user = {
      fullName,
      email: email.toLowerCase(),
      password,
      createdAt: Date.now(),
      mealsScanned: 0,
      workoutsLogged: 0,
      streak: 0,
      lastActive: null,
    };
    users[email.toLowerCase()] = user;
    await Storage.set(KEYS.USERS, users);
    await Storage.set(KEYS.SESSION, { email: email.toLowerCase() });
    return { user };
  },

  async login(email, password) {
    const users = (await Storage.get(KEYS.USERS)) || {};
    const user = users[email.toLowerCase()];
    if (!user) return { error: 'No account found with this email.' };
    if (user.password !== password) return { error: 'Incorrect password.' };
    await Storage.set(KEYS.SESSION, { email: email.toLowerCase() });
    return { user };
  },

  async getSession() {
    const session = await Storage.get(KEYS.SESSION);
    if (!session) return null;
    const users = (await Storage.get(KEYS.USERS)) || {};
    return users[session.email] || null;
  },

  async logout() {
    await Storage.remove(KEYS.SESSION);
  },

  async updateUser(email, updates) {
    const users = (await Storage.get(KEYS.USERS)) || {};
    if (!users[email]) return;
    users[email] = { ...users[email], ...updates };
    await Storage.set(KEYS.USERS, users);
    return users[email];
  },

  async logActivity(email) {
    const users = (await Storage.get(KEYS.USERS)) || {};
    const user = users[email];
    if (!user) return;
    const today = new Date().toDateString();
    const lastActive = user.lastActive;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    let streak = user.streak || 0;
    if (lastActive === today) {
      // already logged today
    } else if (lastActive === yesterday) {
      streak += 1;
    } else {
      streak = 1;
    }
    users[email] = { ...user, streak, lastActive: today };
    await Storage.set(KEYS.USERS, users);
    return users[email];
  },
};