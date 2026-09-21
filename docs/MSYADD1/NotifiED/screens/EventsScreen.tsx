import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, RefreshControl, useWindowDimensions,
} from 'react-native';
import { getSession } from '../utils/auth';
import { supabase } from '../utils/supabase';

const AUTO_ADVANCE_INTERVAL_MS = 5000;

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

type OrganizationRow = {
  organization_id: string;
  name: string;
  category: string | null;
};

function formatDate(date: string | null): string {
  if (!date) return 'TBA';
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(time: string | null): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${m} ${suffix}`;
}

export default function EventsScreen() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [preferredOrgs, setPreferredOrgs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
  const { width: windowWidth } = useWindowDimensions();
  const carouselCardWidth = windowWidth - 40;

  const loadData = useCallback(async () => {
    const session = await getSession();

    const [eventsResult, orgsResult, studentResult] = await Promise.all([
      supabase.from('event').select('*').order('event_date', { ascending: true }),
      supabase.from('organization').select('organization_id,name,category'),
      session?.email
        ? supabase.from('student').select('preferred_organizations').eq('ms_account_id', session.email).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (eventsResult.data) setEvents(eventsResult.data as EventRow[]);
    if (orgsResult.data) setOrganizations(orgsResult.data as OrganizationRow[]);
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

  const categoryByOrg = useMemo(
    () => Object.fromEntries(organizations.map((o) => [o.name, o.category ?? 'Other'])),
    [organizations]
  );

  const categories = useMemo(() => {
    const dynamic = Array.from(new Set(organizations.map((o) => o.category).filter(Boolean))) as string[];
    return ['All', ...(preferredOrgs.length > 0 ? ['For You'] : []), ...dynamic];
  }, [organizations, preferredOrgs]);

  const isFollowed = (e: EventRow) =>
    !!e.organization_name && preferredOrgs.includes(e.organization_name);

  const filteredEvents = events.filter((e) => {
    const matchesCategory =
      activeCategory === 'All'
        ? true
        : activeCategory === 'For You'
        ? isFollowed(e)
        : categoryByOrg[e.organization_name ?? ''] === activeCategory;

    if (!matchesCategory) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.title.toLowerCase().includes(q) ||
      (e.organization_name ?? '').toLowerCase().includes(q) ||
      (e.location ?? '').toLowerCase().includes(q)
    );
  });

  const byDateAscending = (a: EventRow, b: EventRow) => {
    if (!a.event_date && !b.event_date) return 0;
    if (!a.event_date) return 1;
    if (!b.event_date) return -1;
    return a.event_date.localeCompare(b.event_date);
  };

  // Prefer events from followed orgs (soonest first); fall back to high-priority events,
  // then just the first few overall. Always computed from the full `events` list so the
  // carousel stays fixed regardless of the active category.
  const suggestedEvents = useMemo(() => {
    const followedEvents = events.filter(isFollowed).sort(byDateAscending).slice(0, 8);
    if (followedEvents.length > 0) return followedEvents;

    const highPriorityEvents = events.filter((e) => e.priority === 'high');
    if (highPriorityEvents.length > 0) return highPriorityEvents.slice(0, 5);

    return events.slice(0, 5);
  }, [events, preferredOrgs]);

  useEffect(() => {
    setActiveCarouselIndex(0);
  }, [suggestedEvents.map((e) => e.event_id).join(',')]);

  // Carousel events intentionally also appear here — the carousel is a highlighted
  // preview, not the only place to find that event.
  const upcoming = filteredEvents;
  const followedCount = events.filter(isFollowed).length;

  const handleCarouselScrollEnd = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / carouselCardWidth);
    setActiveCarouselIndex(index);
  };

  const carouselScrollRef = useRef<ScrollView>(null);
  const autoAdvanceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAutoAdvance = useCallback(() => {
    if (autoAdvanceIntervalRef.current) {
      clearInterval(autoAdvanceIntervalRef.current);
      autoAdvanceIntervalRef.current = null;
    }
  }, []);

  const startAutoAdvance = useCallback(() => {
    clearAutoAdvance();
    if (suggestedEvents.length <= 1) return;

    autoAdvanceIntervalRef.current = setInterval(() => {
      setActiveCarouselIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % suggestedEvents.length;
        carouselScrollRef.current?.scrollTo({ x: nextIndex * carouselCardWidth, animated: true });
        return nextIndex;
      });
    }, AUTO_ADVANCE_INTERVAL_MS);
  }, [clearAutoAdvance, suggestedEvents.length, carouselCardWidth]);

  // The carousel is hidden on "For You" (see render below); pause auto-advance while
  // hidden so it doesn't drift the active index out of sync with the collapsed ScrollView.
  useEffect(() => {
    if (activeCategory === 'For You') {
      clearAutoAdvance();
      setActiveCarouselIndex(0);
      return;
    }
    startAutoAdvance();
    return clearAutoAdvance;
  }, [activeCategory, startAutoAdvance, clearAutoAdvance]);

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
      <Text style={styles.heading}>Events</Text>

      {preferredOrgs.length > 0 && followedCount > 0 && activeCategory !== 'For You' && (
        <TouchableOpacity style={styles.forYouBanner} onPress={() => setActiveCategory('For You')}>
          <Text style={styles.forYouBannerText}>
            🔔 {followedCount} event{followedCount !== 1 ? 's' : ''} from organizations you follow
          </Text>
          <Text style={styles.forYouBannerArrow}>View →</Text>
        </TouchableOpacity>
      )}

      <TextInput
        style={styles.searchInput}
        placeholder="Search events, organization, or keyword"
        placeholderTextColor="#6B7280"
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
        {categories.map((cat) => {
          const active = activeCategory === cat;
          const isForYou = cat === 'For You';
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, active && styles.categoryChipActive, isForYou && !active && styles.forYouChip]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                {isForYou ? '★ ' : ''}{cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {activeCategory !== 'For You' && suggestedEvents.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Suggested Events</Text>
          <ScrollView
            ref={carouselScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScrollBeginDrag={clearAutoAdvance}
            onMomentumScrollEnd={(event) => {
              handleCarouselScrollEnd(event);
              startAutoAdvance();
            }}
            style={styles.carouselScroll}
          >
            {suggestedEvents.map((event) => (
              <View
                key={event.event_id}
                style={[styles.featuredCard, styles.carouselCard, { width: carouselCardWidth }]}
              >
                {isFollowed(event) && (
                  <View style={styles.followingBadge}>
                    <Text style={styles.followingBadgeText}>★ Following</Text>
                  </View>
                )}
                <Text style={styles.featuredTitle}>{event.title}</Text>
                <Text style={styles.featuredMeta}>
                  {formatDate(event.event_date)} {event.start_time ? `· ${formatTime(event.start_time)}` : ''}
                  {event.location ? ` · ${event.location}` : ''}
                </Text>
                {event.organization_name && (
                  <Text style={styles.featuredOrg}>{event.organization_name}</Text>
                )}
                {event.description && <Text style={styles.featuredDesc}>{event.description}</Text>}
              </View>
            ))}
          </ScrollView>
          {suggestedEvents.length > 1 && (
            <View style={styles.paginationRow}>
              {suggestedEvents.map((event, index) => (
                <View
                  key={event.event_id}
                  style={[styles.paginationDot, index === activeCarouselIndex && styles.paginationDotActive]}
                />
              ))}
            </View>
          )}
        </>
      )}

      <Text style={styles.sectionTitle}>
        {activeCategory === 'All' ? 'Upcoming Events' : `${activeCategory} Events`}
      </Text>
      <View style={styles.card}>
        {upcoming.length === 0 ? (
          <Text style={styles.emptyText}>
            {activeCategory === 'For You'
              ? "No upcoming events from orgs you follow yet."
              : 'No other events in this category yet.'}
          </Text>
        ) : (
          upcoming.map((event) => (
            <View key={event.event_id} style={styles.eventRow}>
              <View style={styles.dateBox}>
                <Text style={styles.dateText}>{formatDate(event.event_date)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.eventTitleRow}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  {isFollowed(event) && <Text style={styles.smallStar}>★</Text>}
                </View>
                <Text style={styles.eventLocation}>
                  {formatTime(event.start_time) ? `${formatTime(event.start_time)} · ` : ''}
                  📍 {event.location ?? 'TBA'} {event.organization_name ? `· ${event.organization_name}` : ''}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1729' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  heading: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 16 },
  forYouBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#3B2F0B', borderWidth: 1, borderColor: '#FFC107',
    borderRadius: 12, padding: 12, marginBottom: 16,
  },
  forYouBannerText: { color: '#FFC107', fontSize: 13, fontWeight: '600', flex: 1 },
  forYouBannerArrow: { color: '#FFC107', fontSize: 13, fontWeight: '700' },
  searchInput: {
    backgroundColor: '#1E293B', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: '#fff', marginBottom: 14,
  },
  categoryRow: { marginBottom: 18 },
  categoryChip: {
    backgroundColor: '#1E293B', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16,
    marginRight: 8, borderWidth: 1, borderColor: '#374151',
  },
  categoryChipActive: { backgroundColor: '#FFC107', borderColor: '#FFC107' },
  forYouChip: { borderColor: '#FFC107' },
  categoryChipText: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },
  categoryChipTextActive: { color: '#0F1729' },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 10, marginTop: 4 },
  featuredCard: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 20 },
  carouselScroll: { marginBottom: 4 },
  carouselCard: { marginBottom: 0 },
  paginationRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  paginationDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#374151', marginHorizontal: 3 },
  paginationDotActive: { backgroundColor: '#FFC107', width: 16 },
  followingBadge: { backgroundColor: '#2563EB', alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 8 },
  followingBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  featuredTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 4 },
  featuredMeta: { color: '#FFC107', fontSize: 12, marginBottom: 4 },
  featuredOrg: { color: '#9CA3AF', fontSize: 12, marginBottom: 8 },
  featuredDesc: { color: '#9CA3AF', fontSize: 13, lineHeight: 18 },
  card: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 20 },
  emptyText: { color: '#6B7280', fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  eventRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  dateBox: { backgroundColor: '#0F1729', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginRight: 12, minWidth: 60, alignItems: 'center' },
  dateText: { color: '#FFC107', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  eventTitleRow: { flexDirection: 'row', alignItems: 'center' },
  eventTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  smallStar: { color: '#FFC107', fontSize: 12, marginLeft: 6 },
  eventLocation: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
});