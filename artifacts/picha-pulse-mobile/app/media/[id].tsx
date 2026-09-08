import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getGetMediaQueryKey, useGetMedia } from '@workspace/api-client-react';
import { objectUrl } from '@/lib/api';
import { useColors } from '@/hooks/useColors';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';

export default function MediaDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mediaQuery = useGetMedia(Number(id), { query: { queryKey: getGetMediaQueryKey(Number(id)), enabled: Boolean(id) } });
  const [zoom, setZoom] = useState(1);
  const media = mediaQuery.data;
  if (mediaQuery.isLoading) return <View style={[styles.center, { backgroundColor: colors.foreground }]}><ActivityIndicator color={colors.accent} /></View>;
  if (!media) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={[styles.emptyTitle, { color: colors.foreground }]}>This moment moved on.</Text></View>;
  return (
    <ScrollView style={{ backgroundColor: colors.foreground }} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.viewer}>
        <Pressable onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.background + 'E6' }]}><Feather name="arrow-left" size={16} color={colors.foreground} /><Text style={[styles.backText, { color: colors.foreground }]}>Back</Text></Pressable>
        <ScrollView horizontal={!media.type || media.type === 'image'} contentContainerStyle={styles.mediaScroll} maximumZoomScale={2.5} minimumZoomScale={1}>
          {media.type === 'video' ? (
            <NativeVideo media={media} colors={colors} />
          ) : (
            <Image source={{ uri: objectUrl(media.objectPath) }} resizeMode="contain" style={[styles.detailImage, { transform: [{ scale: zoom }] }]} />
          )}
        </ScrollView>
        {media.type === 'image' && <View style={[styles.zoomBar, { backgroundColor: colors.background + 'E8' }]}><Pressable onPress={() => setZoom(Math.max(1, zoom - 0.25))} style={styles.iconButton}><Feather name="zoom-out" size={17} color={colors.foreground} /></Pressable><Text style={[styles.zoomText, { color: colors.foreground }]}>{Math.round(zoom * 100)}%</Text><Pressable onPress={() => setZoom(Math.min(2.5, zoom + 0.25))} style={styles.iconButton}><Feather name="zoom-in" size={17} color={colors.foreground} /></Pressable></View>}
      </View>
      <View style={[styles.details, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.kicker, { color: colors.accent }]}>{media.type === 'image' ? 'TRADE STILL' : 'COMMUNITY CLIP'}</Text>
        <Text style={[styles.title, { color: colors.secondaryForeground }]}>{media.title}</Text>
        <Text style={[styles.description, { color: colors.secondaryForeground + 'BF' }]}>{media.description || 'A moment shared from the community.'}</Text>
        <View style={styles.pills}><View style={[styles.pill, { backgroundColor: colors.secondaryForeground + '18' }]}><Feather name="map-pin" size={13} color={colors.accent} /><Text style={{ color: colors.secondaryForeground }}>{media.location || 'Kenya'}</Text></View><View style={[styles.pill, { backgroundColor: colors.secondaryForeground + '18' }]}><Feather name="eye" size={13} color={colors.accent} /><Text style={{ color: colors.secondaryForeground }}>{media.views.toLocaleString('en-KE')} views</Text></View></View>
        <View style={styles.shared}><Text style={[styles.sharedLabel, { color: colors.secondaryForeground + '8A' }]}>SHARED BY</Text><Text style={[styles.sharedName, { color: colors.secondaryForeground }]}>{media.uploaderName || 'A neighbour'}</Text></View>
      </View>
    </ScrollView>
  );
}

function NativeVideo({ media, colors }: { media: any; colors: ReturnType<typeof useColors> }) {
  const player = useVideoPlayer({ uri: objectUrl(media.objectPath) }, (instance) => {
    instance.loop = false;
  });
  const [started, setStarted] = useState(false);
  return (
    <View style={[styles.nativeVideo, { backgroundColor: colors.secondary }]}>
      {!started && media.thumbnailObjectPath && <Image source={{ uri: objectUrl(media.thumbnailObjectPath) }} resizeMode="cover" style={StyleSheet.absoluteFill} />}
      <VideoView player={player} style={styles.nativeVideoView} contentFit="contain" nativeControls onFirstFrameRender={() => setStarted(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewer: { height: 430, backgroundColor: '#16242D', justifyContent: 'center' },
  back: { position: 'absolute', top: 18, left: 18, zIndex: 2, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 22 },
  backText: { fontSize: 12, fontWeight: '800' },
  mediaScroll: { minWidth: '100%', minHeight: '100%', alignItems: 'center', justifyContent: 'center' },
  detailImage: { width: 360, height: 360 },
  videoFallback: { width: 310, minHeight: 230, alignItems: 'center', justifyContent: 'center', padding: 28, borderRadius: 24 },
  nativeVideo: { width: '100%', minHeight: 310, alignItems: 'center', justifyContent: 'center' },
  nativeVideoView: { width: '100%', height: 360 },
  videoText: { marginTop: 14, fontSize: 22, fontWeight: '800' },
  videoHint: { marginTop: 8, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  zoomBar: { position: 'absolute', bottom: 18, right: 18, flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4, borderRadius: 24 },
  iconButton: { width: 35, height: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  zoomText: { paddingHorizontal: 4, fontSize: 10, fontWeight: '800' },
  details: { padding: 24, minHeight: 300 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  title: { marginTop: 16, fontSize: 36, lineHeight: 37, fontWeight: '800', letterSpacing: -1.5 },
  description: { marginTop: 18, fontSize: 15, lineHeight: 23 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 24 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 20 },
  shared: { marginTop: 34, paddingTop: 17, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.14)' },
  sharedLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  sharedName: { marginTop: 7, fontSize: 18, fontWeight: '800' },
  emptyTitle: { fontSize: 24, fontWeight: '800' },
});