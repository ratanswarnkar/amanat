import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useContext, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import BrandMark from '../../components/ui/BrandMark';
import CaretakerModeBanner from '../../components/ui/CaretakerModeBanner';
import ProfileBadge from '../../components/ui/ProfileBadge';
import { AuthContext } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const MODULES = [
  {
    title: 'Vault',
    subtitle: 'Secure documents and trusted access',
    icon: 'shield-checkmark-outline',
    route: '/vault',
    badge: 'Encrypted',
  },
  {
    title: 'Reports',
    subtitle: 'Records, activity, and protected insights',
    icon: 'document-text-outline',
    route: '/healthcare',
    badge: 'Live Sync',
  },
];

const PARTICLES = [
  { size: 10, top: '10%', left: '10%', opacity: 0.2, duration: 5800, delay: 0 },
  { size: 14, top: '20%', left: '82%', opacity: 0.18, duration: 7200, delay: 800 },
  { size: 12, top: '62%', left: '14%', opacity: 0.15, duration: 6900, delay: 1200 },
  { size: 18, top: '75%', left: '74%', opacity: 0.12, duration: 7800, delay: 600 },
  { size: 8, top: '48%', left: '56%', opacity: 0.1, duration: 6400, delay: 1500 },
];

function FloatingParticle({ particle }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(particle.delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: particle.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: particle.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [particle.delay, particle.duration, progress]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          width: particle.size,
          height: particle.size,
          top: particle.top,
          left: particle.left,
          opacity: particle.opacity,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -18],
              }),
            },
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 10],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.18],
              }),
            },
          ],
        },
      ]}
    />
  );
}

function CubeModule({ module, fullWidth }) {
  const rotate = useRef(new Animated.Value(0)).current;
  const active = useRef(new Animated.Value(0)).current;
  const [isPressed, setIsPressed] = useState(false);

  useEffect(() => {
    rotate.setValue(0);
    const duration = isPressed ? 8500 : 14500;
    const loop = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    loop.start();
    return () => loop.stop();
  }, [isPressed, rotate]);

  const setPressedState = (pressed) => {
    setIsPressed(pressed);
    Animated.spring(active, {
      toValue: pressed ? 1 : 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 5,
    }).start();
  };

  const cubeTransform = [
    { perspective: 1000 },
    {
      rotateY: rotate.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
      }),
    },
    {
      rotateX: rotate.interpolate({
        inputRange: [0, 1],
        outputRange: ['-16deg', '-376deg'],
      }),
    },
    {
      scale: active.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.05],
      }),
    },
  ];

  const shellTransform = {
    transform: [
      {
        scale: active.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.02],
        }),
      },
    ],
  };

  const glowOpacity = active.interpolate({
    inputRange: [0, 1],
    outputRange: [0.38, 0.72],
  });

  return (
    <Pressable
      onPress={() => router.push(module.route)}
      onPressIn={() => setPressedState(true)}
      onPressOut={() => setPressedState(false)}
      style={[styles.moduleWrapper, fullWidth && styles.moduleWrapperFull]}
    >
      <Animated.View style={[styles.moduleCard, shellTransform]}>
        <Animated.View style={[styles.cubeGlow, { opacity: glowOpacity }]} />

        <View style={styles.badge}>
          <Text style={styles.badgeText}>{module.badge}</Text>
        </View>

        <Animated.View style={[styles.cubeStage, { transform: cubeTransform }]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.96)', 'rgba(175,216,255,0.72)', 'rgba(10,132,255,0.86)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.face, styles.frontFace]}
          />
          <LinearGradient
            colors={['rgba(29,78,216,0.92)', 'rgba(30,58,138,0.98)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.face, styles.backFace]}
          />
          <LinearGradient
            colors={['rgba(255,255,255,0.9)', 'rgba(147,197,253,0.52)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.face, styles.topFace]}
          />
          <LinearGradient
            colors={['rgba(96,165,250,0.84)', 'rgba(15,23,42,0.94)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.face, styles.rightFace]}
          />
          <View style={styles.centerCore} />
        </Animated.View>

        <View pointerEvents="none" style={styles.labelOverlay}>
          <View style={styles.iconOrb}>
            <Ionicons name={module.icon} size={24} color="#F8FBFF" />
          </View>
          <Text style={styles.moduleTitle}>{module.title}</Text>
          <Text style={styles.moduleSubtitle}>{module.subtitle}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function MainDashboardScreen() {
  const { width } = useWindowDimensions();
  const { logout, user } = useContext(AuthContext);
  const stacked = width < 860;
  const displayName = String(user?.name || user?.full_name || '').trim() || 'Profile';

  useEffect(() => {
    if (user?.hasSecurityQuestions === false) {
      router.replace('/security-questions/setup');
    }
  }, [user]);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
        <LinearGradient
          colors={['#020817', '#08152E', '#12306C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View pointerEvents="none" style={styles.orbOne} />
        <View pointerEvents="none" style={styles.orbTwo} />
        {PARTICLES.map((particle, index) => (
          <FloatingParticle key={`${particle.top}-${particle.left}-${index}`} particle={particle} />
        ))}

        <View style={styles.headerShadow}>
          <LinearGradient
            colors={['#0B1B46', '#12306C', '#2B7FFF']}
            start={{ x: 0, y: 0.4 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.header}
          >
            <View style={styles.headerLeft}>
              <BrandMark light />
            </View>

            <View style={styles.headerActions}>
              <ProfileBadge user={user} onPress={() => router.push('/profile')} light />
              <Pressable
                onPress={handleLogout}
                style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}
                hitSlop={10}
              >
                <Ionicons name="log-out-outline" size={22} color="#F8FBFF" />
              </Pressable>
            </View>
          </LinearGradient>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <CaretakerModeBanner />
          <View style={styles.heroSection}>
            <Text style={styles.eyebrow}>AMANAT DASHBOARD</Text>
            <Text style={styles.title}>Welcome back, {displayName}.</Text>
            <Text style={styles.subtitle}>
              Secure modules, calmer motion, and clearer paths into your vault and healthcare data.
            </Text>
          </View>

          <View style={[styles.moduleGrid, stacked && styles.moduleGridStacked]}>
            {MODULES.map((module) => (
              <CubeModule key={module.title} module={module} fullWidth={stacked} />
            ))}
          </View>
        </ScrollView>
      </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerShadow: {
    shadowColor: '#020817',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 2,
  },
  header: {
    minHeight: 66,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginLeft: spacing.md,
  },
  logoutButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  logoutButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg - 4,
    paddingTop: spacing.lg - 2,
    paddingBottom: spacing.xl + spacing.xs,
  },
  heroSection: {
    marginBottom: spacing.xl - 4,
  },
  eyebrow: {
    color: 'rgba(191,219,254,0.84)',
    ...typography.caption,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.2,
    textAlign: 'center',
    marginBottom: 14,
  },
  title: {
    color: colors.textPrimary,
    ...typography.headingLarge,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    textAlign: 'center',
    maxWidth: 760,
    alignSelf: 'center',
  },
  subtitle: {
    color: 'rgba(224,231,255,0.82)',
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 680,
    alignSelf: 'center',
    marginTop: 14,
  },
  moduleGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'stretch',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  moduleGridStacked: {
    flexDirection: 'column',
  },
  moduleWrapper: {
    width: 320,
    maxWidth: '100%',
    marginBottom: 6,
  },
  moduleWrapperFull: {
    width: '100%',
  },
  moduleCard: {
    height: 360,
    borderRadius: 34,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(191,219,254,0.18)',
    shadowColor: '#60A5FA',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.24,
    shadowRadius: 32,
    elevation: 14,
  },
  badge: {
    position: 'absolute',
    top: 18,
    left: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  badgeText: {
    color: '#DBEAFE',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  cubeGlow: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 999,
    backgroundColor: '#60A5FA',
    shadowColor: '#93C5FD',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
  },
  cubeStage: {
    width: 184,
    height: 184,
    alignItems: 'center',
    justifyContent: 'center',
  },
  face: {
    position: 'absolute',
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
  },
  frontFace: {
    width: 168,
    height: 168,
    transform: [{ translateX: -14 }, { translateY: 16 }],
  },
  backFace: {
    width: 150,
    height: 150,
    opacity: 0.42,
    transform: [{ translateX: 16 }, { translateY: -12 }],
  },
  topFace: {
    width: 156,
    height: 108,
    opacity: 0.82,
    transform: [{ translateY: -54 }, { rotate: '-12deg' }, { scaleX: 0.9 }],
  },
  rightFace: {
    width: 108,
    height: 156,
    opacity: 0.86,
    transform: [{ translateX: 58 }, { rotate: '10deg' }, { scaleY: 0.9 }],
  },
  centerCore: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  labelOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconOrb: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,19,42,0.46)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    marginBottom: 18,
  },
  moduleTitle: {
    color: '#FFFFFF',
    ...typography.headingMedium,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  moduleSubtitle: {
    color: 'rgba(224,231,255,0.88)',
    ...typography.caption,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 220,
  },
  particle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
    shadowColor: '#93C5FD',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
  },
  orbOne: {
    position: 'absolute',
    top: -70,
    right: -30,
    width: 250,
    height: 250,
    borderRadius: 999,
    backgroundColor: 'rgba(96,165,250,0.14)',
  },
  orbTwo: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
