import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { clearSession, getSession } from '../utils/auth';
import { supabase } from '../utils/supabase';

type EventRow = {
  event_id: string;
  organization_name: string | null;
  title: string;
  description: string | null;
  event_date: string | null;
  start_time: string | null;
  location: string | null;
  priority: string | null;
};

type AnnouncementRow = {
  announcement_id: string;
  organization_name: string | null;
  title: string;
  content: string | null;
  priority: string | null;
  created_at: string;
};

function formatTime(time: string | null): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${m} ${suffix}`;
}

export default function DashboardScreen({ navigation }: any) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [preferredOrgs, setPreferredOrgs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const session = await getSession();

    const [eventsResult, announcementsResult, studentResult] = await Promise.all([
      supabase.from('event').select('*').order('event_date', { ascending: true }).limit(20),
      supabase.from('announcement').select('*').order('created_at', { ascending: false }).limit(5),
      session?.email
        ? supabase.from('student').select('preferred_organizations').eq('ms_account_id', session.email).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (eventsResult.data) setEvents(eventsResult.data as EventRow[]);
    if (announcementsResult.data) setAnnouncements(announcementsResult.data as AnnouncementRow[]);
    if (studentResult?.data?.preferred_organizations) {
      setPreferredOrgs(studentResult.data.preferred_organizations);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleLogout = async () => {
    await clearSession();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const isFollowed = (e: EventRow) =>
    !!e.organization_name && preferredOrgs.includes(e.organization_name);

  const personalizedEvents = events.filter(isFollowed);
  const isPersonalized = personalizedEvents.length > 0;

  // Prefer a followed org's event as the top pick; fall back to highest priority, then first event
  const suggested =
    personalizedEvents[0] ??
    events.find((e) => e.priority === 'high') ??
    events[0];

  const pool = isPersonalized ? personalizedEvents : events;
  const upcomingEvents = pool.filter((e) => e.event_id !== suggested?.event_id).slice(0, 4);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#FFC107" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFC107" />}
    >
      <View style={styles.header}>
        <Text style={styles.brand}>Notifi<Text style={styles.brandAccent}>ED</Text></Text>
        <TouchableOpacity onPress={handleLogout} style={styles.profileIcon}>
          <Text style={styles.profileIconText}>👤</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.greeting}>Good morning, Student! 👋</Text>
      <Text style={styles.subGreeting}>Here's what's happening on campus today.</Text>

      {suggested && (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>📌 Suggested Events</Text>
          </View>
          <View style={styles.importantCard}>
            {isFollowed(suggested) ? (
              <View style={styles.followBadge}>
                <Text style={styles.followBadgeText}>★ From an org you follow</Text>
              </View>
            ) : (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{suggested.priority ?? 'Event'}</Text>
              </View>
            )}
            <Text style={styles.importantTitle}>{suggested.title}</Text>
            <Text style={styles.importantMeta}>
              {suggested.event_date ?? ''} {suggested.location ? `· ${suggested.location}` : ''}
            </Text>
            {suggested.description ? (
              <Text style={styles.importantDesc}>{suggested.description}</Text>
            ) : null}
          </View>
        </>
      )}

      <View style={styles.columnsRow}>
        <View style={styles.columnHalf}>
          <Text style={styles.sectionTitleSmall}>📅 Upcoming Events</Text>
          {!isPersonalized && (
            <Text style={styles.hintText}>Follow orgs to personalize this</Text>
          )}
          <View style={styles.halfCard}>
            {upcomingEvents.length === 0 ? (
              <Text style={styles.emptyText}>No upcoming events yet.</Text>
            ) : (
              upcomingEvents.map((event) => (
                <View key={event.event_id} style={styles.eventRowCompact}>
                  <Text style={styles.timeTextCompact}>{formatTime(event.start_time) || '—'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitleCompact} numberOfLines={1}>{event.title}</Text>
                    <Text style={styles.eventLocationCompact} numberOfLines={1}>
                      {event.location ?? 'TBA'}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.columnHalf}>
          <Text style={styles.sectionTitleSmall}>🗓️ My Schedule</Text>
          <View style={[styles.halfCard, styles.placeholderCard]}>
            <Text style={styles.placeholderEmoji}>🚧</Text>
            <Text style={styles.placeholderText}>Personal timetable coming soon</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>📰 Announcements</Text>
      </View>
      <View style={styles.card}>
        {announcements.length === 0 ? (
          <Text style={styles.emptyText}>No announcements yet.</Text>
        ) : (
          announcements.map((a) => (
            <View key={a.announcement_id} style={styles.announcementRow}>
              <Text style={styles.eventTitle}>{a.title}</Text>
              {a.organization_name ? <Text style={styles.eventLocation}>{a.organization_name}</Text> : null}
              {a.content ? <Text style={styles.announcementContent} numberOfLines={2}>{a.content}</Text> : null}
            </View>
          ))
        )}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1729' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  brand: { color: '#fff', fontSize: 20, fontWeight: '700' },
  brandAccent: { color: '#FFC107' },
  profileIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  profileIconText: { fontSize: 16 },
  greeting: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  subGreeting: { color: '#9CA3AF', fontSize: 13, marginBottom: 20 },
  sectionHeaderRow: { marginBottom: 10, marginTop: 8 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  sectionTitleSmall: { color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  hintText: { color: '#6B7280', fontSize: 10, marginBottom: 8 },
  importantCard: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 20 },
  badge: { backgroundColor: '#FFC107', alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 8 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#0F1729', textTransform: 'capitalize' },
  followBadge: { backgroundColor: '#2563EB', alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 8 },
  followBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  importantTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 4 },
  importantMeta: { color: '#FFC107', fontSize: 12, marginBottom: 8 },
  importantDesc: { color: '#9CA3AF', fontSize: 13, lineHeight: 18 },
  columnsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  columnHalf: { flex: 1 },
  halfCard: { backgroundColor: '#1E293B', borderRadius: 14, padding: 12, minHeight: 120 },
  placeholderCard: { justifyContent: 'center', alignItems: 'center' },
  placeholderEmoji: { fontSize: 22, marginBottom: 6 },
  placeholderText: { color: '#6B7280', fontSize: 11, textAlign: 'center' },
  card: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 20 },
  emptyText: { color: '#6B7280', fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  eventRowCompact: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  timeTextCompact: { color: '#FFC107', fontSize: 10, fontWeight: '600', marginRight: 8, minWidth: 44 },
  eventTitleCompact: { color: '#fff', fontSize: 12, fontWeight: '600' },
  eventLocationCompact: { color: '#9CA3AF', fontSize: 10, marginTop: 1 },
  eventTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  eventLocation: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  announcementRow: { marginBottom: 14 },
  announcementContent: { color: '#9CA3AF', fontSize: 12, marginTop: 4 },
  logoutButton: { marginTop: 12, borderWidth: 1, borderColor: '#374151', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
});