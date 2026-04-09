import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import AppCard from '../../../components/ui/AppCard';
import AppHeader from '../../../components/ui/AppHeader';
import CaretakerModeBanner from '../../../components/ui/CaretakerModeBanner';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';

const dashboardCards = [
  {
    title: 'Medicine Tracker',
    subtitle: 'Manage prescriptions and schedules',
    icon: 'medkit-outline',
    route: '/healthcare/medicines',
  },
  {
    title: 'Schedules',
    subtitle: 'Create recurring medicine plans',
    icon: 'time-outline',
    route: '/healthcare/schedules',
  },
  {
    title: 'Missed Dose',
    subtitle: 'Check today and missed adherence',
    icon: 'alert-circle-outline',
    route: '/healthcare/missed-dose',
  },
  {
    title: 'Inventory',
    subtitle: 'Track remaining medicine stock',
    icon: 'cube-outline',
    route: '/healthcare/inventory',
  },
  {
    title: 'Health Records',
    subtitle: 'Upload reports and documents',
    icon: 'folder-open-outline',
    route: '/healthcare/records',
  },
];

export default function HealthcareDashboardScreen() {
  const { width } = useWindowDimensions();
  const stacked = width < 420;

  return (
    <View style={styles.container}>
      <AppHeader title="Healthcare" showBack />

      <ScrollView contentContainerStyle={styles.content}>
        <CaretakerModeBanner />
        <AppCard variant="elevated" style={styles.heroCard}>
          <Text style={styles.headerTitle}>Health Records</Text>
          <Text style={styles.headerSubtitle}>Track medicines, reminders, records, and support contacts in one place.</Text>
        </AppCard>
        <View style={[styles.grid, stacked && styles.gridStacked]}>
          {dashboardCards.map((card) => (
            <AppCard
              key={card.title}
              variant="elevated"
              style={[styles.card, stacked && styles.cardStacked]}
              onPress={() => router.push(card.route)}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={card.icon} size={22} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
            </AppCard>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerTitle: {
    ...typography.headingLarge,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  heroCard: {
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  gridStacked: {
    flexDirection: 'column',
  },
  card: {
    flexBasis: '48%',
    maxWidth: '48%',
    borderRadius: 16,
    marginBottom: 16,
  },
  cardStacked: {
    flexBasis: '100%',
    maxWidth: '100%',
    width: '100%',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});

