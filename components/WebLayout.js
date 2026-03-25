import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { C } from '../constants/theme';

const NAV_ITEMS = [
  { screen: 'home',    label: 'Dashboard'   },
  { screen: 'scanner', label: 'Food Scanner' },
  { screen: 'foodlog', label: 'Food Log'     },
  { screen: 'tracker', label: 'Tracker'      },
  { screen: 'plan',    label: 'My Plan'      },
  { screen: 'coach',   label: 'AI Coach'     },
  { screen: 'profile', label: 'Profile'      },
];

export default function WebLayout({ current, onNavigate, user, children }) {
  return (
    <View style={s.root}>
      {/* Sidebar */}
      <View style={s.sidebar}>
        <View style={s.logo}>
          <View style={s.logoCircle}><Text style={s.logoText}>FL</Text></View>
          <Text style={s.logoName}>FitLife</Text>
        </View>

        <View style={s.nav}>
          {NAV_ITEMS.map(item => (
            <TouchableOpacity
              key={item.screen}
              style={[s.navItem, current === item.screen && s.navItemActive]}
              onPress={() => onNavigate(item.screen)}
            >
              <Text style={[s.navLabel, current === item.screen && s.navLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {user && (
          <View style={s.userBox}>
            <View style={s.userAvatar}>
              <Text style={s.userAvatarText}>{user.fullName?.[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.userName} numberOfLines={1}>{user.fullName}</Text>
              <Text style={s.userEmail} numberOfLines={1}>{user.email}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Main content */}
      <View style={s.main}>
        {children}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: C.bg },
  sidebar: { width: 240, backgroundColor: C.surface, borderRightWidth: 1, borderRightColor: C.border, paddingTop: 32, paddingHorizontal: 16, justifyContent: 'space-between' },
  logo: { flexDirection: 'row', alignItems: 'center', marginBottom: 40, paddingHorizontal: 8 },
  logoCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: C.green, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  logoText: { color: C.green, fontSize: 13, fontWeight: '900' },
  logoName: { color: C.white, fontSize: 20, fontWeight: '900' },
  nav: { flex: 1 },
  navItem: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4 },
  navItemActive: { backgroundColor: C.green + '22' },
  navLabel: { color: C.muted, fontSize: 14, fontWeight: '600' },
  navLabelActive: { color: C.green, fontWeight: '800' },
  userBox: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderTopWidth: 1, borderTopColor: C.border },
  userAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  userAvatarText: { color: C.bg, fontWeight: '900', fontSize: 15 },
  userName: { color: C.white, fontWeight: '700', fontSize: 13 },
  userEmail: { color: C.muted, fontSize: 11 },
  main: { flex: 1, overflow: 'hidden' },
});