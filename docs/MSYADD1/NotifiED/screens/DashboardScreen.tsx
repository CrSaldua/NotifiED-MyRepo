import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { clearSession } from '../utils/auth';

// TODO: replace with real data once event/announcement tables + AI pipeline exist
const importantEvent = {
  title: 'Organization Fair 2026',
  date: 'Today',
  location: 'Student Affairs Office',
  description: 'Visit the annual Organization Fair and discover student organizations, activities, and opportunities available on campus!',
};

const upcomingEvents = [
  { time: '10:00 AM', title: 'Organization Fair', location: 'MPH1' },
  { time: '1:00 PM', title: 'Cybersecurity Seminar', location: 'Auditorium' },
  { time: '4:30 PM', title: 'Basketball Tryouts', location: 'Gymnasium' },
];

export default function DashboardScreen({ navigation }: any) {
  const handleLogout = async () => {
    await clearSession();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.brand}>Notifi<Text style={styles.brandAccent}>ED</Text></Text>
        <TouchableOpacity onPress={handleLogout} style={styles.profileIcon}>
          <Text style={styles.profileIconText}>👤</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.greeting}>Good morning, Student! 👋</Text>
      <Text style={styles.subGreeting}>Here's what's happening on campus today.</Text>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>📣 Important Events</Text>
      </View>
      <View style={styles.importantCard}>
        <View style={styles.badge}><Text style={styles.badgeText}>Important</Text></View>
        <Text style={styles.importantTitle}>{importantEvent.title}</Text>
        <Text style={styles.importantMeta}>{importantEvent.date} · {importantEvent.location}</Text>
        <Text style={styles.importantDesc}>{importantEvent.description}</Text>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>📅 Upcoming Events</Text>
      </View>
      <View style={styles.card}>
        {upcomingEvents.map((event, i) => (
          <View key={i} style={styles.eventRow}>
            <View style={styles.timeBox}>
              <Text style={styles.timeText}>{event.time}</Text>
            </View>
            <View>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventLocation}>📍 {event.location}</Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1729' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  brand: { color: '#fff', fontSize: 20, fontWeight: '700' },
  brandAccent: { color: '#FFC107' },
  profileIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  profileIconText: { fontSize: 16 },
  greeting: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  subGreeting: { color: '#9CA3AF', fontSize: 13, marginBottom: 20 },
  sectionHeaderRow: { marginBottom: 10, marginTop: 8 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  importantCard: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 20 },
  badge: { backgroundColor: '#FFC107', alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 8 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#0F1729' },
  importantTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 4 },
  importantMeta: { color: '#FFC107', fontSize: 12, marginBottom: 8 },
  importantDesc: { color: '#9CA3AF', fontSize: 13, lineHeight: 18 },
  card: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 20 },
  eventRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  timeBox: { backgroundColor: '#0F1729', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginRight: 12, minWidth: 72 },
  timeText: { color: '#FFC107', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  eventTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  eventLocation: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  logoutButton: { marginTop: 12, borderWidth: 1, borderColor: '#374151', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
});