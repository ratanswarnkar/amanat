import { Audio, Video } from 'expo-av';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/ui/AppCard';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function FileDetailsScreen() {
  // useLocalSearchParams reads route params sent from Vault screen.
  const { title, fileName, uri, type } = useLocalSearchParams();
  const [audioSound, setAudioSound] = useState(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const safeTitle = typeof title === 'string' ? title : 'No title';
  const safeFileName = typeof fileName === 'string' ? fileName : 'No file name';
  const safeUri = typeof uri === 'string' ? uri : '';
  const safeType = typeof type === 'string' ? type.toLowerCase() : '';

  // Media type is detected using text checks like "image", "audio", or "video".
  const mediaKind = useMemo(() => {
    if (safeType.includes('image')) return 'image';
    if (safeType.includes('audio')) return 'audio';
    if (safeType.includes('video')) return 'video';
    return 'unknown';
  }, [safeType]);

  useEffect(() => {
    return () => {
      if (audioSound) {
        audioSound.unloadAsync();
      }
    };
  }, [audioSound]);

  const handleToggleAudio = async () => {
    if (!safeUri) return;

    if (!audioSound) {
      const { sound } = await Audio.Sound.createAsync({ uri: safeUri }, { shouldPlay: true });
      setAudioSound(sound);
      setIsAudioPlaying(true);
      return;
    }

    if (isAudioPlaying) {
      await audioSound.pauseAsync();
      setIsAudioPlaying(false);
    } else {
      await audioSound.playAsync();
      setIsAudioPlaying(true);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>File Details</Text>

      <AppCard variant="outlined">
        <Text style={styles.cardTitle}>{safeTitle}</Text>
        <Text style={styles.cardSubtitle}>{safeFileName}</Text>
        {/* Preview logic: choose UI based on the detected media type. */}
        <View style={styles.previewContainer}>
          {mediaKind === 'image' && safeUri ? (
            <Image source={{ uri: safeUri }} style={styles.imagePreview} resizeMode="contain" />
          ) : null}

          {mediaKind === 'audio' && safeUri ? (
            <AppButton
              title={isAudioPlaying ? 'Pause Audio' : 'Play Audio'}
              onPress={handleToggleAudio}
              style={styles.audioButton}
              variant="secondary"
            />
          ) : null}

          {mediaKind === 'video' && safeUri ? (
            <Video source={{ uri: safeUri }} style={styles.videoPreview} useNativeControls resizeMode="contain" />
          ) : null}

          {mediaKind === 'unknown' || !safeUri ? (
            <Text style={styles.noPreviewText}>Preview is not available for this file.</Text>
          ) : null}
        </View>

        <View style={styles.metaContainer}>
          <Text style={styles.metaLabel}>File Type</Text>
          <Text style={styles.metaValue}>{safeType || 'Unknown type'}</Text>
        </View>
      </AppCard>

      <AppButton
        title="Back to Vault"
        onPress={() => router.replace('/amanat/vault')}
        variant="ghost"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingTop: 64,
  },
  heading: {
    ...typography.headingLarge,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  previewContainer: {
    marginTop: spacing.sm + spacing.xs,
  },
  imagePreview: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
  videoPreview: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    backgroundColor: '#000000',
  },
  audioButton: {
    marginTop: spacing.xs,
  },
  noPreviewText: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  metaContainer: {
    marginTop: spacing.sm + spacing.xs,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metaLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  metaValue: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
