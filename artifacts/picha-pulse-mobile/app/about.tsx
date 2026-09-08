import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/hooks/useColors';

export default function AboutScreen() {
  const colors = useColors();
  const { user, logout } = useAuth();
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.back}><Feather name="arrow-left" size={17} color={colors.foreground} /><Text style={[styles.backText, { color: colors.foreground }]}>Back</Text></Pressable>
      <Text style={[styles.kicker, { color: colors.primary }]}>ABOUT THE PULSE</Text>
      <Text style={[styles.heading, { color: colors.foreground }]}>Kenya,{'\n'}<Text style={{ color: colors.primary }}>in frame.</Text></Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>Picha Pulse is a daily window into what people across Kenya are seeing, making, trading, and talking about right now.</Text>
      <View style={[styles.card, { backgroundColor: colors.primary }]}><Text style={[styles.cardTitle, { color: colors.primaryForeground }]}>The people closest to the moment tell it best.</Text><Text style={[styles.cardCaption, { color: colors.primaryForeground + 'B8' }]}>BUILT FOR THE EVERYDAY EXTRAORDINARY</Text></View>
      <View style={[styles.info, { borderColor: colors.border }]}><Feather name="database" size={22} color={colors.primary} /><View style={styles.infoText}><Text style={[styles.infoTitle, { color: colors.foreground }]}>One shared pulse</Text><Text style={[styles.infoBody, { color: colors.mutedForeground }]}>This app uses the same secure media catalog and storage as the Picha Pulse website.</Text></View></View>
      {user && <Pressable onPress={() => void logout()} style={[styles.logout, { borderColor: colors.border }]}><Feather name="log-out" size={16} color={colors.foreground} /><Text style={[styles.logoutText, { color: colors.foreground }]}>Log out</Text></Pressable>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, marginBottom: 35 },
  backText: { fontSize: 13, fontWeight: '800' },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  heading: { marginTop: 12, fontSize: 58, lineHeight: 53, fontWeight: '800', letterSpacing: -3.5 },
  body: { marginTop: 22, fontSize: 16, lineHeight: 24 },
  card: { minHeight: 225, justifyContent: 'space-between', marginTop: 30, padding: 22, borderRadius: 22 },
  cardTitle: { maxWidth: 280, fontSize: 28, lineHeight: 30, fontWeight: '800', letterSpacing: -1 },
  cardCaption: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  info: { flexDirection: 'row', gap: 14, marginTop: 20, padding: 18, borderWidth: 1, borderRadius: 18 },
  infoText: { flex: 1 },
  infoTitle: { fontSize: 16, fontWeight: '800' },
  infoBody: { marginTop: 6, fontSize: 13, lineHeight: 19 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 25, paddingVertical: 14, borderWidth: 1, borderRadius: 14 },
  logoutText: { fontSize: 14, fontWeight: '800' },
});