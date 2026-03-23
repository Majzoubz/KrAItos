import React from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { C } from '../constants/theme';
import { Auth } from '../utils/auth';

export default function ProfileScreen({ user, onLogout }) {
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
            <Text style={[s.statVal, { color: C.green }]}>{user.streak || 0}</Text>
            <Text style={s.statLabel}>Day Streak</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: C.blue }]}>{user.mealsScanned || 0}</Text>
            <Text style={s.statLabel}>Meals Scanned</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: C.purple }]}>{user.workoutsLogged || 0}</Text>
            <Text style={s.statLabel}>Plans Generated</Text>
          </View>
        </View>

        <View style={s.infoCard}>
          <Text style={s.infoTitle}>Account Info</Text>
          <View style={s.infoRow}>
            <Text style={s.infoKey}>Name</Text>
            <Text style={s.infoVal}>{user.fullName}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoKey}>Email</Text>
            <Text style={s.infoVal}>{user.email}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoKey}>Joined</Text>
            <Text style={s.infoVal}>{joinDate}</Text>
          </View>
        </View>

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
  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: C.bg, fontSize: 32, fontWeight: '900' },
  name: { color: C.white, fontSize: 22, fontWeight: '900' },
  email: { color: C.muted, fontSize: 14, marginTop: 4 },
  joined: { color: C.muted, fontSize: 12, marginTop: 4 },
  statsRow: { flexDirection: 'row', marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14, alignItems: 'center', marginRight: 8 },
  statVal: { fontSize: 24, fontWeight: '900' },
  statLabel: { color: C.muted, fontSize: 11, marginTop: 4, textAlign: 'center' },
  infoCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 24 },
  infoTitle: { color: C.green, fontWeight: '800', fontSize: 14, marginBottom: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  infoKey: { color: C.muted, fontSize: 14 },
  infoVal: { color: C.white, fontSize: 14, fontWeight: '600' },
  logoutBtn: { borderWidth: 1.5, borderColor: C.danger, paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  logoutText: { color: C.danger, fontSize: 15, fontWeight: '800' },
});