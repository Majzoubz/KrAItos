import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { C } from '../constants/theme';

const NAV_ITEMS = [
  { screen: 'home',    label: 'Dashboard',    icon: '⌂' },
  { screen: 'scanner', label: 'Food Scanner',  icon: '◎' },
  { screen: 'foodlog', label: 'Food Log',      icon: '☰' },
  { screen: 'tracker', label: 'Tracker',       icon: '◈' },
  { screen: 'plan',    label: 'My Plan',       icon: '◇' },
  { screen: 'profile', label: 'Profile',       icon: '●' },
];

export default function WebLayout({ current, onNavigate, user, children }) {
  return (
    <View style={s.root}>
      <View style={s.sidebar}>
        <View style={s.logo}>
          <Image source={require('../assets/logo.png')} style={s.logoImg} resizeMode="contain" />
          <View>
            <Text style={s.logoName}>GreenGain</Text>
            <Text style={s.logoSub}>AI FITNESS</Text>
          </View>
        </View>

        <View style={s.nav}>
          {NAV_ITEMS.map(item => (
            <TouchableOpacity
              key={item.screen}
              style={[s.navItem, current === item.screen && s.navItemActive]}
              onPress={() => onNavigate(item.screen)}
            >
              <Text style={[s.navIcon, current === item.screen && s.navIconActive]}>{item.icon}</Text>
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
  logoImg: { width: 36, height: 36, marginRight: 10 },
  logoName: { color: C.white, fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  logoSub: { color: C.green, fontSize: 8, fontWeight: '700', letterSpacing: 3 },
  nav: { flex: 1 },
  navItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4 },
  navItemActive: { backgroundColor: C.greenGlow },
  navIcon: { color: C.muted, fontSize: 16, width: 28 },
  navIconActive: { color: C.green },
  navLabel: { color: C.muted, fontSize: 14, fontWeight: '600' },
  navLabelActive: { color: C.green, fontWeight: '800' },
  userBox: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderTopWidth: 1, borderTopColor: C.border },
  userAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  userAvatarText: { color: C.bg, fontWeight: '900', fontSize: 15 },
  userName: { color: C.white, fontWeight: '700', fontSize: 13 },
  userEmail: { color: C.muted, fontSize: 11 },
  main: { flex: 1, overflow: 'hidden' },
});
