import { Ionicons } from '@expo/vector-icons';
import { Audio, ResizeMode, Video } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { API_URL } from '../../src/config/env';
import { getToken } from '../../src/utils/secureStore';

const buildSecureViewUrl = (id) => {
  const fileId = String(id || '').trim();
  if (!fileId) return '';
  const base = String(API_URL || '').trim().replace(/\/+$/, '');
  return `${base}/api/vault/files/${fileId}/view`;
};

const getFileKind = ({ fileType, fileName, fileUrl }) => {
  const type = String(fileType || '').toLowerCase();
  const name = String(fileName || '').toLowerCase();
  const url = String(fileUrl || '').toLowerCase();

  if (type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp)$/.test(name) || /\.(png|jpg|jpeg|gif|webp|bmp)(\?|$)/.test(url)) return 'image';
  if (type.startsWith('video/') || /\.(mp4|mov|m4v|avi|webm)$/.test(name) || /\.(mp4|mov|m4v|avi|webm)(\?|$)/.test(url)) return 'video';
  if (type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg)$/.test(name) || /\.(mp3|wav|m4a|aac|ogg)(\?|$)/.test(url)) return 'audio';
  if (type.includes('pdf') || name.endsWith('.pdf') || /\.pdf(\?|$)/.test(url)) return 'pdf';
  return 'unsupported';
};

const getLocalExtension = ({ fileType, fileName }) => {
  const lowerName = String(fileName || '').toLowerCase();
  const byName = lowerName.includes('.') ? lowerName.slice(lowerName.lastIndexOf('.')) : '';
  if (byName && byName.length <= 10) return byName;

  const lowerType = String(fileType || '').toLowerCase();
  if (lowerType.includes('pdf')) return '.pdf';
  if (lowerType.startsWith('image/')) return '.jpg';
  if (lowerType.startsWith('video/')) return '.mp4';
  if (lowerType.startsWith('audio/')) return '.mp3';
  return '.bin';
};

export default function VaultViewerScreen() {
  const params = useLocalSearchParams();

  const fileId = String(params?.id || '');
  const fileName = String(params?.file_name || 'Vault File');
  const fileType = String(params?.file_type || '');

  const secureUrl = useMemo(() => buildSecureViewUrl(fileId), [fileId]);
  const fileKind = useMemo(() => getFileKind({ fileType, fileName, fileUrl: secureUrl }), [fileType, fileName, secureUrl]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [localUri, setLocalUri] = useState('');
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadToken = async () => {
      const stored = await getToken();
      if (!mounted) return;
      setToken(String(stored || ''));
      setAuthReady(true);
    };

    loadToken();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;

    let mounted = true;
    let downloadedUri = '';

    const downloadSecureFile = async () => {
      try {
        setLoading(true);
        setError('');
        setLocalUri('');

        if (!secureUrl) {
          throw new Error('File id is missing.');
        }

        if (fileKind === 'unsupported') {
          setLoading(false);
          return;
        }

        const extension = getLocalExtension({ fileType, fileName });
        const targetPath = `${FileSystem.cacheDirectory}vault-${fileId}-${Date.now()}${extension}`;

        const result = await FileSystem.downloadAsync(secureUrl, targetPath, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (result.status < 200 || result.status >= 300) {
          throw new Error(`Failed to fetch secure file (${result.status})`);
        }

        downloadedUri = result.uri;

        if (!mounted) return;

        setLocalUri(result.uri);
        setLoading(false);
      } catch (downloadError) {
        if (!mounted) return;
        setLoading(false);
        setError(downloadError?.message || 'Failed to load file.');
      }
    };

    downloadSecureFile();

    return () => {
      mounted = false;
      if (downloadedUri) {
        FileSystem.deleteAsync(downloadedUri, { idempotent: true }).catch(() => {});
      }
    };
  }, [authReady, secureUrl, token, fileKind, fileType, fileName, fileId]);

  useEffect(() => {
    let mounted = true;
    let createdSound = null;

    const setupAudio = async () => {
      if (fileKind !== 'audio' || !localUri) {
        return;
      }

      try {
        const loaded = await Audio.Sound.createAsync(
          { uri: localUri },
          { shouldPlay: false },
          (status) => {
            if (!status.isLoaded || !mounted) return;
            setIsPlaying(Boolean(status.isPlaying));
          }
        );

        createdSound = loaded.sound;
        if (!mounted) {
          await loaded.sound.unloadAsync();
          return;
        }

        setSound(loaded.sound);
      } catch (_error) {
        if (mounted) {
          setError('Failed to prepare audio playback.');
        }
      }
    };

    setupAudio();

    return () => {
      mounted = false;
      if (createdSound) {
        createdSound.unloadAsync().catch(() => {});
      }
      setSound(null);
      setIsPlaying(false);
    };
  }, [fileKind, localUri]);

  const toggleAudio = async () => {
    try {
      if (!sound) return;

      const status = await sound.getStatusAsync();
      if (!status.isLoaded) return;

      if (status.isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (_error) {
      setError('Audio playback failed.');
    }
  };

  const renderContent = () => {
    if (!secureUrl) {
      return <Text style={styles.message}>File id is missing.</Text>;
    }

    if (!authReady || loading) {
      return <ActivityIndicator size="large" color="#8FB3FF" />;
    }

    if (error) {
      return <Text style={styles.errorText}>{error}</Text>;
    }

    if (fileKind === 'image') {
      return <Image source={{ uri: localUri }} style={styles.image} resizeMode="contain" />;
    }

    if (fileKind === 'video') {
      return (
        <Video
          source={{ uri: localUri }}
          style={styles.video}
          useNativeControls
          shouldPlay={false}
          resizeMode={ResizeMode.CONTAIN}
          onError={() => setError('Failed to load video.')}
        />
      );
    }

    if (fileKind === 'audio') {
      return (
        <View style={styles.audioWrap}>
          <Ionicons name="musical-notes-outline" size={72} color="#8FB3FF" />
          <Pressable style={styles.audioButton} onPress={toggleAudio}>
            <Text style={styles.audioButtonText}>{isPlaying ? 'Pause' : 'Play'}</Text>
          </Pressable>
        </View>
      );
    }

    if (fileKind === 'pdf') {
      return (
        <WebView
          source={{ uri: localUri }}
          style={styles.webview}
          originWhitelist={['*']}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color="#8FB3FF" />
            </View>
          )}
          onError={() => setError('Failed to load PDF document.')}
        />
      );
    }

    return <Text style={styles.message}>Unsupported file type.</Text>;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#EAF1FF" />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {fileName}
        </Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.body}>{renderContent()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070D1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2742',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12203A',
  },
  title: {
    flex: 1,
    marginHorizontal: 10,
    color: '#EAF1FF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  audioWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  audioButton: {
    backgroundColor: '#2E5CAA',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  audioButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  webview: {
    width: '100%',
    height: '100%',
    backgroundColor: '#070D1A',
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#070D1A',
  },
  message: {
    color: '#C9D9FF',
    fontSize: 15,
  },
  errorText: {
    color: '#FF8A8A',
    fontSize: 15,
  },
});
