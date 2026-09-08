import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import type { Media } from '@workspace/api-client-react';
import { objectUrl } from '@/lib/api';
import { useColors } from '@/hooks/useColors';

function formatWhen(date: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr`;
  return new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short' }).format(new Date(date));
}

export function MediaCard({ media, onPress }: { media: Media; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      testID={`card-media-${media.id}`}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.92 : 1 }]}
    >
      <View style={styles.imageWrap}>
        <Image source={{ uri: objectUrl(media.thumbnailObjectPath || media.objectPath) }} contentFit="cover" style={styles.image} />
        {media.type === 'video' && (
          <>
            <View style={styles.playOverlay}><View style={[styles.playButton, { backgroundColor: colors.background + 'EA' }]}><Feather name="play" size={17} color={colors.foreground} /></View></View>
            <View style={[styles.clipBadge, { backgroundColor: colors.foreground }]}>
              <Feather name="play" size={11} color={colors.background} />
              <Text style={[styles.badgeText, { color: colors.background }]}>CLIP</Text>
            </View>
          </>
        )}
        <View style={[styles.location, { backgroundColor: colors.background + 'E6' }]}>
          <Feather name="map-pin" size={11} color={colors.primary} />
          <Text style={[styles.locationText, { color: colors.foreground }]} numberOfLines={1}>{media.location || 'Kenya'}</Text>
        </View>
      </View>
      <View style={styles.content}>
        <View style={styles.metaRow}>
          <Text style={[styles.kicker, { color: colors.primary }]}>{media.type === 'image' ? 'STILL' : 'SHORT CLIP'}</Text>
          <Text style={[styles.time, { color: colors.mutedForeground }]}>{formatWhen(media.createdAt)}</Text>
        </View>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>{media.title}</Text>
        <View style={styles.bottomRow}>
          <Text style={[styles.byline, { color: colors.mutedForeground }]} numberOfLines={1}>by <Text style={{ color: colors.foreground, fontWeight: '700' }}>{media.uploaderName || 'A neighbour'}</Text></Text>
          <Text style={[styles.views, { color: colors.mutedForeground }]}>{media.views.toLocaleString('en-KE')} views</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', borderWidth: 1, borderRadius: 18, marginBottom: 14 },
  imageWrap: { aspectRatio: 1.25, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  playOverlay: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  playButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  clipBadge: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20 },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  location: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '72%', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20 },
  locationText: { fontSize: 11, fontWeight: '700' },
  content: { padding: 15 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  kicker: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  time: { fontSize: 10 },
  title: { fontSize: 17, fontWeight: '800', lineHeight: 21 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 15 },
  byline: { flex: 1, fontSize: 11 },
  views: { fontSize: 10 },
});