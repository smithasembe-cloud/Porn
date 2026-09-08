import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useListMedia } from '@workspace/api-client-react';
import { MediaCard } from '@/components/MediaCard';
import { useColors } from '@/hooks/useColors';
import { router } from 'expo-router';

const SAVED_KEY = 'picha-pulse-saved-mobile';

export default function SavedScreen() {
  const colors = useColors();
  const [saved, setSaved] = useState<number[]>([]);
  const mediaQuery = useListMedia({ type: 'all', limit: 100 });
  useEffect(() => {
    // Saved media is intentionally device-local, matching the web app's privacy model.
    void (async () => {
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const value = await AsyncStorage.getItem(SAVED_KEY);
        setSaved(value ? JSON.parse(value) : []);
      } catch { setSaved([]); }
    })();
  }, []);
  const media = (mediaQuery.data || []).filter((item) => saved.includes(item.id));
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: colors.primary }]}>YOUR POCKET OF KENYA</Text>
        <Text style={[styles.heading, { color: colors.foreground }]}>Saved{'\n'}<Text style={{ color: colors.primary }}>moments.</Text></Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]}>Keep the stories that made you stop scrolling.</Text>
      </View>
      {mediaQuery.isLoading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : media.length ? (
        <FlatList data={media} keyExtractor={(item) => String(item.id)} renderItem={({ item }) => <MediaCard media={item} onPress={() => router.push(`/media/${item.id}`)} />} contentContainerStyle={styles.list} />
      ) : (
        <View style={styles.empty}>
          <Feather name="bookmark" size={27} color={colors.foreground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing tucked away yet.</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Tap save on any moment you want to find again.</Text>
          <Pressable onPress={() => router.replace('/')} style={[styles.button, { backgroundColor: colors.secondary }]}><Text style={[styles.buttonText, { color: colors.secondaryForeground }]}>Browse the pulse</Text></Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 22 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  heading: { marginTop: 10, fontSize: 48, lineHeight: 45, fontWeight: '800', letterSpacing: -3 },
  description: { marginTop: 18, fontSize: 14, lineHeight: 20, maxWidth: 290 },
  list: { paddingHorizontal: 20, paddingBottom: 30 },
  loader: { marginTop: 40 },
  empty: { alignItems: 'center', marginHorizontal: 20, marginTop: 30, padding: 36, borderWidth: 1, borderStyle: 'dashed', borderRadius: 20 },
  emptyTitle: { marginTop: 16, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  emptyText: { marginTop: 8, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  button: { marginTop: 20, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24 },
  buttonText: { fontSize: 13, fontWeight: '800' },
});