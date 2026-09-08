import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useGetSiteVisitorCount, useListMedia } from '@workspace/api-client-react';
import { MediaCard } from '@/components/MediaCard';
import { useColors } from '@/hooks/useColors';
import { router } from 'expo-router';

export default function HomeScreen() {
  const colors = useColors();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const params = useMemo(() => ({ type: filter, q: search.trim() || undefined, limit: 100 }), [filter, search]);
  const mediaQuery = useListMedia(params);
  const visitorQuery = useGetSiteVisitorCount();
  const media = mediaQuery.data || [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={media}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <MediaCard media={item} onPress={() => router.push(`/media/${item.id}`)} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={mediaQuery.isFetching} onRefresh={() => mediaQuery.refetch()} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View>
            <View style={styles.topbar}>
              <View style={styles.brandMark}><Text style={[styles.brandLetter, { color: colors.primaryForeground }]}>P</Text><View style={[styles.dot, { backgroundColor: colors.accent }]} /></View>
              <Text style={[styles.brand, { color: colors.foreground }]}>picha<Text style={{ color: colors.primary }}>pulse</Text></Text>
              <View style={styles.headerActions}><View style={[styles.visitorPill, { backgroundColor: colors.card, borderColor: colors.border }]}><Feather name="eye" size={12} color={colors.mutedForeground} /><Text style={[styles.visitorCount, { color: colors.mutedForeground }]}>{(visitorQuery.data?.count || 0).toLocaleString('en-KE')}</Text></View><Pressable onPress={() => router.push('/about')} hitSlop={10}><Feather name="info" size={20} color={colors.foreground} /></Pressable></View>
            </View>
            <View style={styles.hero}>
              <Text style={[styles.kicker, { color: colors.primary }]}>LIVE FROM AROUND KENYA</Text>
              <Text style={[styles.heading, { color: colors.foreground }]}>See what’s{'\n'}<Text style={{ color: colors.primary }}>moving.</Text></Text>
              <Text style={[styles.description, { color: colors.mutedForeground }]}>Trade photography, community clips, and the small flashes of life that make a place feel like home.</Text>
            </View>
            <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="search" size={18} color={colors.mutedForeground} />
              <TextInput value={search} onChangeText={setSearch} placeholder="Search places, people, moments..." placeholderTextColor={colors.mutedForeground} style={[styles.search, { color: colors.foreground }]} />
            </View>
            <View style={styles.filters}>
              <Text style={[styles.showMe, { color: colors.mutedForeground }]}>SHOW ME</Text>
              {(['all', 'image', 'video'] as const).map((value) => (
                <Pressable key={value} onPress={() => setFilter(value)} style={[styles.filter, { backgroundColor: filter === value ? colors.secondary : colors.card }]}>
                  <Text style={{ color: filter === value ? colors.secondaryForeground : colors.mutedForeground, fontSize: 12, fontWeight: '800' }}>{value === 'all' ? 'Everything' : value === 'image' ? 'Photos' : 'Clips'}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.sectionHeading}>
              <View><Text style={[styles.kicker, { color: colors.primary }]}>FRESH DROPS</Text><Text style={[styles.sectionTitle, { color: colors.foreground }]}>The pulse right now</Text></View>
              <Text style={[styles.count, { color: colors.mutedForeground }]}>{media.length ? `${media.length} stories` : ''}</Text>
            </View>
            {mediaQuery.isLoading && <ActivityIndicator color={colors.primary} style={styles.loader} />}
            {mediaQuery.isError && <Text style={[styles.error, { color: colors.destructive }]}>The pulse is out of reach. Pull to try again.</Text>}
            {!mediaQuery.isLoading && !mediaQuery.isError && !media.length && <View style={[styles.empty, { borderColor: colors.border }]}><Feather name="search" size={25} color={colors.foreground} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>{search ? 'Nothing by that name yet.' : 'The board is warming up.'}</Text><Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{search ? 'Try a different place, person, or phrase.' : 'Be the first to put a moment on the map.'}</Text><Pressable onPress={() => router.push('/upload')} style={[styles.primaryButton, { backgroundColor: colors.primary }]}><Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Share the first moment</Text></Pressable></View>}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 30 },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingTop: 18, paddingBottom: 20 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  visitorPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderRadius: 20 },
  visitorCount: { fontSize: 10, fontWeight: '700' },
  brandMark: { position: 'relative', width: 35, height: 35, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e65d42', borderRadius: 11 },
  brandLetter: { fontSize: 18, fontWeight: '800' },
  dot: { position: 'absolute', top: -3, right: -3, width: 9, height: 9, borderRadius: 5 },
  brand: { flex: 1, marginLeft: 10, fontSize: 20, fontWeight: '800', letterSpacing: -1 },
  hero: { paddingTop: 18, paddingBottom: 25 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  heading: { marginTop: 12, fontSize: 51, lineHeight: 47, fontWeight: '800', letterSpacing: -3 },
  description: { marginTop: 18, fontSize: 15, lineHeight: 22 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', height: 50, paddingHorizontal: 15, borderWidth: 1, borderRadius: 25 },
  search: { flex: 1, marginLeft: 10, fontSize: 13 },
  filters: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 15 },
  showMe: { marginRight: 2, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  filter: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 20 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 20, paddingBottom: 15 },
  sectionTitle: { marginTop: 5, fontSize: 26, fontWeight: '800', letterSpacing: -1.1 },
  count: { fontSize: 10 },
  loader: { marginVertical: 28 },
  error: { paddingVertical: 24, fontSize: 14, textAlign: 'center' },
  empty: { alignItems: 'center', padding: 28, borderWidth: 1, borderStyle: 'dashed', borderRadius: 20 },
  emptyTitle: { marginTop: 14, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  emptyText: { marginTop: 7, fontSize: 13, textAlign: 'center' },
  primaryButton: { marginTop: 18, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 22 },
  primaryButtonText: { fontSize: 12, fontWeight: '800' },
});
