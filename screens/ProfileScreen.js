import React from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { C } from '../constants/theme';
import { Auth } from '../utils/auth';

export default function ProfileScreen({ user, onLogout, onNavigate }) {
  const joinDate = new Date(user.createdAt).toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const confirmLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => {
        await Auth.logout();
        onLogout();
      }},
    ]);
  };

  const MENU = [
    { label: 'AR Workout',       sub: 'Coming soon - glasses integration', screen: 'ar',      color: C.purple },
    { label: 'Weight Tracker',   sub: 'Log and view your weight history',  screen: 'tracker', color: C.blue   },
    { label: 'Calorie Log',      sub: 'Track your daily calorie intake',   screen: 'tracker', color: C.orange },
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
          <View style={[s.statCard, { borderTopColor: C.green }]}>
            <Text style={[s.statVal, { color: C.green }]}>{user.streak || 0}</Text>
            <Text style={s.statLabel}>Day Streak</Text>
          </View>
          <View style={[s.statCard, { borderTopColor: C.blue }]}>
            <Text style={[s.statVal, { color: C.blue }]}>{user.mealsScanned || 0}</Text>
            <Text style={s.statLabel}>Meals Scanned</Text>
          </View>
          <View style={[s.statCard, { borderTopColor: C.purple, marginRight: 0 }]}>
            <Text style={[s.statVal, { color: C.purple }]}>{user.workoutsLogged || 0}</Text>
            <Text style={s.statLabel}>Plans Made</Text>
          </View>
        </View>

        <View style={s.infoCard}>
          <Text style={s.infoTitle}>Account Details</Text>
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
            <View style={[s.menuDot, { backgroundColor: item.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.menuLabel}>{item.label}</Text>
              <Text style={s.menuSub}>{item.sub}</Text>
            </View>
            <Text style={[s.menuArrow, { color: item.color }]}>-&gt;</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={s.logoutBtn} onPress={confirmLogout}>
          <Text style={s.logoutText}>Log Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  titleBar: { padding: 16, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  titleBarText: { color: C.white, fontSize: 20, fontWeight: '900' },
  scroll: { padding: 20, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: C.bg, fontSize: 32, fontWeight: '900' },
  name: { color: C.white, fontSize: 22, fontWeight: '900' },
  email: { color: C.muted, fontSize: 14, marginTop: 4 },
  joined: { color: C.muted, fontSize: 12, marginTop: 4 },
  statsRow: { flexDirection: 'row', marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14, alignItems: 'center', marginRight: 8, borderTopWidth: 3 },
  statVal: { fontSize: 24, fontWeight: '900' },
  statLabel: { color: C.muted, fontSize: 11, marginTop: 4, textAlign: 'center' },
  infoCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 20 },
  infoTitle: { color: C.green, fontWeight: '800', fontSize: 13, marginBottom: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  infoKey: { color: C.muted, fontSize: 14 },
  infoVal: { color: C.white, fontSize: 14, fontWeight: '600', maxWidth: '60%' },
  menuTitle: { color: C.white, fontWeight: '800', fontSize: 14, marginBottom: 10 },
  menuItem: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  menuDot: { width: 10, height: 10, borderRadius: 5, marginRight: 14 },
  menuLabel: { color: C.white, fontWeight: '700', fontSize: 14 },
  menuSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  menuArrow: { fontSize: 16, fontWeight: '900', marginLeft: 8 },
  logoutBtn: { borderWidth: 1.5, borderColor: C.danger, paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  logoutText: { color: C.danger, fontSize: 15, fontWeight: '800' },
});