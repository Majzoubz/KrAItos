import React from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, Alert, Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Auth } from '../utils/auth';

export default function ProfileScreen({ user, onLogout, onNavigate }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const joinDate = new Date(user.createdAt).toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const doLogout = async () => {
    try { await Auth.logout(); } catch {}
    onLogout && onLogout();
  };

  const confirmLogout = () => {
    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined' && window.confirm
        ? window.confirm('Are you sure you want to log out?')
        : true;
      if (ok) doLogout();
      return;
    }
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: doLogout },
    ]);
  };

  const MENU = [
    { label: 'Health & Activity', sub: 'Steps, heart rate, sleep, smart watch', screen: 'health' },
    { label: 'Settings',         sub: 'Language, theme, notifications',    screen: 'settings' },
    { label: 'AR Workout',       sub: 'Coming soon - glasses integration', screen: 'ar' },
    { label: 'Weight Tracker',   sub: 'Log and view your weight history',  screen: 'tracker' },
    { label: 'Calorie Log',      sub: 'Track your daily calorie intake',   screen: 'tracker' },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <Text style={s.titleBarText}>My Profile</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll}>

        <View style={s.avatarSection}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{user.fullName[0].toUpperCase()}</Text>
          </View>
          <Text style={s.name}>{user.fullName}</Text>
          <Text style={s.email}>{user.email}</Text>
          <Text style={s.joined}>Member since {joinDate}</Text>
        </View>

        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statVal}>{user.streak || 0}</Text>
            <Text style={s.statLabel}>Day Streak</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statVal}>{user.mealsScanned || 0}</Text>
            <Text style={s.statLabel}>Meals Scanned</Text>
          </View>
          <View style={[s.statCard, { marginRight: 0 }]}>
            <Text style={s.statVal}>{user.workoutsLogged || 0}</Text>
            <Text style={s.statLabel}>Plans Made</Text>
          </View>
        </View>

        <View style={s.infoCard}>
          <Text style={s.infoTitle}>ACCOUNT DETAILS</Text>
          {[['Name', user.fullName], ['Email', user.email], ['Joined', joinDate]].map(([key, val]) => (
            <View key={key} style={s.infoRow}>
              <Text style={s.infoKey}>{key}</Text>
              <Text style={s.infoVal} numberOfLines={1}>{val}</Text>
            </View>
          ))}
        </View>

        <Text style={s.menuTitle}>More Features</Text>
        {MENU.map((item, i) => (
          <TouchableOpacity key={i} style={s.menuItem} onPress={() => onNavigate(item.screen)}>
            <View style={s.menuDot} />
            <View style={{ flex: 1 }}>
              <Text style={s.menuLabel}>{item.label}</Text>
              <Text style={s.menuSub}>{item.sub}</Text>
            </View>
            <Text style={s.menuArrow}>→</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={s.logoutBtn} onPress={confirmLogout}>
          <Text style={s.logoutText}>Log Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  titleBar: { padding: 16, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  titleBarText: { color: C.white, fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  scroll: { padding: 20, paddingBottom: 100 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: C.bg, fontSize: 32, fontWeight: '900' },
  name: { color: C.white, fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
  email: { color: C.muted, fontSize: 14, marginTop: 4 },
  joined: { color: C.muted, fontSize: 12, marginTop: 4 },
  statsRow: { flexDirection: 'row', marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 16, alignItems: 'center', marginRight: 8, borderWidth: 1, borderColor: C.border },
  statVal: { fontSize: 24, fontWeight: '900', color: C.green },
  statLabel: { color: C.muted, fontSize: 11, marginTop: 4, textAlign: 'center' },
  infoCard: { backgroundColor: C.card, borderRadius: 18, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: C.border },
  infoTitle: { color: C.green, fontWeight: '700', fontSize: 11, marginBottom: 14, letterSpacing: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  infoKey: { color: C.muted, fontSize: 14 },
  infoVal: { color: C.white, fontSize: 14, fontWeight: '600', maxWidth: '60%' },
  menuTitle: { color: C.white, fontWeight: '800', fontSize: 14, marginBottom: 10, letterSpacing: 0.5 },
  menuItem: { backgroundColor: C.card, borderRadius: 16, padding: 18, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  menuDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green, marginRight: 14 },
  menuLabel: { color: C.white, fontWeight: '700', fontSize: 14 },
  menuSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  menuArrow: { color: C.green, fontSize: 16, fontWeight: '700', marginLeft: 8 },
  logoutBtn: { borderWidth: 1.5, borderColor: C.muted + '40', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 20 },
  logoutText: { color: C.muted, fontSize: 15, fontWeight: '800' },
});
