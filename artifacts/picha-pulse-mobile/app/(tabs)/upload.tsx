import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { createVideoPlayer } from 'expo-video';
import { Feather } from '@expo/vector-icons';
import { useCreateMedia, useRequestUploadUrl } from '@workspace/api-client-react';
import { useAuth } from '@/lib/auth';
import { uploadLocalFile } from '@/lib/api';
import { useColors } from '@/hooks/useColors';
import { router } from 'expo-router';

export default function UploadScreen() {
  const colors = useColors();
  const { user, isLoading, login } = useAuth();
  const requestUpload = useRequestUploadUrl();
  const createMedia = useCreateMedia();
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [videoPoster, setVideoPoster] = useState<any>(null);

  const choose = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.9 });
    if (!result.canceled) {
      const selected = result.assets[0];
      setAsset(selected);
      setVideoPoster(null);
      if (selected.type === 'video') {
        try {
          const player = createVideoPlayer({ uri: selected.uri });
          const [poster] = await player.generateThumbnailsAsync([0]);
          setVideoPoster(poster);
          player.release();
        } catch {
          // The API generates a durable poster after upload if native extraction is unavailable.
        }
      }
    }
  };

  const publish = async () => {
    if (!asset || !title.trim() || !user) return;
    setBusy(true);
    try {
      const mimeType = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
      const response = await requestUpload.mutateAsync({ data: { name: asset.fileName || `picha-${Date.now()}`, size: asset.fileSize || 1, contentType: mimeType } });
      await uploadLocalFile(response.uploadURL, asset.uri, mimeType);
      await createMedia.mutateAsync({ data: { title: title.trim(), description: description.trim(), location: location.trim(), type: asset.type === 'video' ? 'video' : 'image', mimeType, objectPath: response.objectPath, uploaderName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined } });
      Alert.alert('Published to the pulse', 'Your moment is now live for people around Kenya to discover.', [{ text: 'See the feed', onPress: () => router.replace('/') }]);
    } catch (error) {
      Alert.alert('Upload paused', error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  if (!user) return <View style={[styles.center, { backgroundColor: colors.background, padding: 30 }]}><View style={[styles.lockIcon, { backgroundColor: colors.accent }]}><Feather name="upload-cloud" size={28} color={colors.foreground} /></View><Text style={[styles.loginTitle, { color: colors.foreground }]}>Bring the next{'\n'}<Text style={{ color: colors.primary }}>moment.</Text></Text><Text style={[styles.loginBody, { color: colors.mutedForeground }]}>Log in to upload a photo or short clip. Your view of Kenya belongs here.</Text><Pressable onPress={login} style={[styles.primaryButton, { backgroundColor: colors.primary }]}><Feather name="log-in" size={16} color={colors.primaryForeground} /><Text style={[styles.primaryText, { color: colors.primaryForeground }]}>Log in to share</Text></Pressable></View>;
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.form}>
      <Text style={[styles.kicker, { color: colors.primary }]}>YOUR CORNER OF THE STORY</Text>
      <Text style={[styles.heading, { color: colors.foreground }]}>Share what{'\n'}<Text style={{ color: colors.primary }}>you see.</Text></Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>Photos and short clips from the people who are actually there.</Text>
      <Pressable onPress={choose} style={[styles.picker, { borderColor: asset ? colors.primary : colors.border, backgroundColor: colors.card }]}>
        {asset ? <><View style={styles.preview}>{videoPoster ? <Image source={videoPoster} contentFit="cover" style={styles.posterPreview} /> : <Feather name={asset.type === 'video' ? 'video' : 'image'} size={32} color={colors.accent} />}<Text style={[styles.previewName, { color: colors.cardForeground }]} numberOfLines={1}>{asset.fileName || 'Selected media'}</Text></View><Text style={[styles.change, { color: colors.primary }]}>Choose a different file</Text></> : <><View style={[styles.uploadIcon, { backgroundColor: colors.accent }]}><Feather name="upload-cloud" size={28} color={colors.foreground} /></View><Text style={[styles.pickTitle, { color: colors.cardForeground }]}>Choose a photo or clip</Text><Text style={[styles.pickHint, { color: colors.mutedForeground }]}>JPG, PNG, MP4 up to 100 MB</Text></>}
      </Pressable>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.cardForeground }]}>Give it a little context</Text>
        <Field label="HEADLINE · REQUIRED" value={title} onChangeText={setTitle} placeholder="What are we looking at?" colors={colors} />
        <Field label="SHORT NOTE" value={description} onChangeText={setDescription} placeholder="The detail that makes this moment yours..." multiline colors={colors} />
        <Field label="WHERE WAS THIS?" value={location} onChangeText={setLocation} placeholder="e.g. Gikambura, Kiambu" colors={colors} />
        <Pressable disabled={!asset || !title.trim() || busy} onPress={publish} style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: !asset || !title.trim() || busy ? 0.45 : 1 }]}>{busy ? <ActivityIndicator color={colors.primaryForeground} /> : <Feather name="upload-cloud" size={17} color={colors.primaryForeground} />}<Text style={[styles.primaryText, { color: colors.primaryForeground }]}>{busy ? 'Publishing…' : 'Publish to the pulse'}</Text></Pressable>
      </View>
    </ScrollView>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline, colors }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.field}><Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.mutedForeground} multiline={multiline} style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }, multiline && styles.multiline]} /></View>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  form: { padding: 20, paddingBottom: 40 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  heading: { marginTop: 12, fontSize: 50, lineHeight: 47, fontWeight: '800', letterSpacing: -3 },
  body: { marginTop: 18, fontSize: 15, lineHeight: 22, maxWidth: 350 },
  picker: { minHeight: 210, marginTop: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderRadius: 22, padding: 24 },
  uploadIcon: { width: 62, height: 62, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  pickTitle: { marginTop: 16, fontSize: 19, fontWeight: '800' },
  pickHint: { marginTop: 7, fontSize: 12 },
  preview: { alignItems: 'center', maxWidth: '100%' },
  posterPreview: { width: 160, height: 100, borderRadius: 12 },
  previewName: { marginTop: 13, fontSize: 15, fontWeight: '800' },
  change: { marginTop: 14, fontSize: 12, fontWeight: '800' },
  card: { marginTop: 20, padding: 18, borderWidth: 1, borderRadius: 20 },
  sectionTitle: { marginBottom: 20, fontSize: 21, fontWeight: '800' },
  field: { marginBottom: 16 },
  label: { marginBottom: 7, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  input: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderRadius: 12, fontSize: 14 },
  multiline: { minHeight: 95, textAlignVertical: 'top' },
  primaryButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 4, paddingHorizontal: 20, borderRadius: 14 },
  primaryText: { fontSize: 14, fontWeight: '800' },
  lockIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  loginTitle: { marginTop: 20, fontSize: 42, lineHeight: 40, fontWeight: '800', textAlign: 'center', letterSpacing: -2 },
  loginBody: { maxWidth: 320, marginTop: 16, fontSize: 14, lineHeight: 21, textAlign: 'center' },
});