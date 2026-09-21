import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { clearSession, getSession } from '../utils/auth';
import { supabase } from '../utils/supabase';

type ProgramLevel = 'shs' | 'associate' | 'bachelor' | 'masters';

const SCHOOLS: { label: string; value: string }[] = [
  { label: 'Senior High School', value: 'SHS' },
  { label: 'School of Architecture', value: 'SARCH' },
  { label: 'School of Computing and Information Technology', value: 'SCIT' },
  { label: 'School of Engineering', value: 'SOE' },
  { label: 'School of Management', value: 'SOM' },
  { label: 'School of Multimedia and Arts', value: 'SMA' },
  { label: 'Graduate School', value: 'GS' },
];

const PROGRAMS: { label: string; value: string; level: ProgramLevel; school: string }[] = [
  { label: 'Senior High School', value: 'SHS', level: 'shs', school: 'SHS' },
  { label: 'Bachelor of Science in Architecture', value: 'BSARCH', level: 'bachelor', school: 'SARCH' },
  { label: 'Bachelor of Science in Computer Science', value: 'BSCS', level: 'bachelor', school: 'SCIT' },
  { label: 'Bachelor of Science in Information Technology', value: 'BSIT', level: 'bachelor', school: 'SCIT' },
  { label: 'Associate in Computer Technology', value: 'ACT', level: 'associate', school: 'SCIT' },
  { label: 'Bachelor of Science in Civil Engineering', value: 'BSCE', level: 'bachelor', school: 'SOE' },
  { label: 'Bachelor of Science in Computer Engineering', value: 'BSCOE', level: 'bachelor', school: 'SOE' },
  { label: 'Bachelor of Science in Accountancy', value: 'BSA', level: 'bachelor', school: 'SOM' },
  { label: 'Bachelor of Science in Business Administration major in Business Analytics', value: 'BSBA-BA', level: 'bachelor', school: 'SOM' },
  { label: 'Bachelor of Science in Business Administration major in Digital Marketing', value: 'BSBA-DM', level: 'bachelor', school: 'SOM' },
  { label: 'Bachelor of Science in Business Administration major in Financial Management', value: 'BSBA-FM', level: 'bachelor', school: 'SOM' },
  { label: 'Bachelor of Science in Tourism Management', value: 'BSTM', level: 'bachelor', school: 'SOM' },
  { label: 'Bachelor of Arts in Psychology', value: 'ABPSYCH', level: 'bachelor', school: 'SMA' },
  { label: 'Bachelor of Multimedia Arts', value: 'BMMA', level: 'bachelor', school: 'SMA' },
  { label: 'Master in Management', value: 'MM', level: 'masters', school: 'GS' },
  { label: 'Master in Information Systems', value: 'MIS', level: 'masters', school: 'GS' },
  { label: 'Master in Information Technology', value: 'MIT', level: 'masters', school: 'GS' },
  { label: 'Master of Engineering major in Computer Engineering', value: 'MECOE', level: 'masters', school: 'GS' },
  { label: 'Master in Game Design', value: 'MGD', level: 'masters', school: 'GS' },
  { label: 'Master of Science in Computer Science', value: 'MSCS', level: 'masters', school: 'GS' },
];

const YEAR_LEVELS_BY_PROGRAM_LEVEL: Record<ProgramLevel, { label: string; value: string }[]> = {
  shs: [{ label: 'Grade 11', value: '11' }, { label: 'Grade 12', value: '12' }],
  associate: [{ label: '1st Year', value: '1' }, { label: '2nd Year', value: '2' }],
  bachelor: [
    { label: '1st Year', value: '1' }, { label: '2nd Year', value: '2' },
    { label: '3rd Year', value: '3' }, { label: '4th Year', value: '4' },
  ],
  masters: [],
};

const COOLDOWN_DAYS = 7;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

type StudentRow = {
  ms_account_id: string;
  name: string;
  student_number: string;
  school: string;
  program: string;
  year_level: string;
  section: string;
  preferred_organizations: string[];
  academic_info_updated_at: string;
};

type OrganizationRow = { organization_id: string; name: string; category: string | null; school: string | null };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function ProfileScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [student, setStudent] = useState<StudentRow | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);

  const [school, setSchool] = useState('');
  const [program, setProgram] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [section, setSection] = useState('');
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activePicker, setActivePicker] = useState<'school' | 'program' | 'yearLevel' | null>(null);

  const loadData = useCallback(async () => {
    const session = await getSession();
    if (!session?.email) {
      setLoading(false);
      return;
    }

    const [studentResult, orgsResult] = await Promise.all([
      supabase.from('student').select('*').eq('ms_account_id', session.email).maybeSingle(),
      supabase.from('organization').select('organization_id,name,category,school'),
    ]);

    if (studentResult.data) {
      const s = studentResult.data as StudentRow;
      setStudent(s);
      setSchool(s.school);
      setProgram(s.program);
      setYearLevel(s.year_level);
      setSection(s.section);
      setSelectedOrgs(s.preferred_organizations ?? []);
    }
    if (orgsResult.data) setOrganizations(orgsResult.data as OrganizationRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const orgCategories = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    organizations.forEach((o) => {
      const cat = o.category ?? 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(o.name);
    });
    return grouped;
  }, [organizations]);
  
  const suggestedOrgNames = useMemo(
    () => new Set(organizations.filter((o) => o.school && o.school === student?.school).map((o) => o.name)),
    [organizations, student]
  );
 
  const cooldownEndsAt = student ? new Date(student.academic_info_updated_at).getTime() + COOLDOWN_MS : 0;
  const cooldownActive = Date.now() < cooldownEndsAt;

  const programsInSchool = school ? PROGRAMS.filter((p) => p.school === school) : [];
  const selectedProgramLevel = PROGRAMS.find((p) => p.value === program)?.level;
  const yearLevelOptions = selectedProgramLevel ? YEAR_LEVELS_BY_PROGRAM_LEVEL[selectedProgramLevel] : [];

  const toggleOrg = (org: string) => {
    setSelectedOrgs((prev) => (prev.includes(org) ? prev.filter((o) => o !== org) : [...prev, org]));
  };

  const hasAcademicChanges =
    student && (school !== student.school || program !== student.program || yearLevel !== student.year_level || section !== student.section);

  const hasOrgChanges =
    student && JSON.stringify([...selectedOrgs].sort()) !== JSON.stringify([...(student.preferred_organizations ?? [])].sort());

  const handleSaveOrgs = async () => {
    if (!student) return;
    setSaving(true);
    const { error } = await supabase
      .from('student')
      .update({ preferred_organizations: selectedOrgs })
      .eq('ms_account_id', student.ms_account_id);
    setSaving(false);

    if (error) {
      Alert.alert('Error', 'Could not save your organization preferences.');
      return;
    }
    setStudent({ ...student, preferred_organizations: selectedOrgs });
    Alert.alert('Saved', 'Your organization preferences have been updated.');
  };

  const handleSaveAcademic = async () => {
    if (!student || cooldownActive) return;
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('student')
      .update({ school, program, year_level: yearLevel, section, academic_info_updated_at: now })
      .eq('ms_account_id', student.ms_account_id);
    setSaving(false);

    if (error) {
      Alert.alert('Error', 'Could not save your academic information.');
      return;
    }
    setStudent({ ...student, school, program, year_level: yearLevel, section, academic_info_updated_at: now });
    Alert.alert('Saved', 'Your academic information has been updated.');
  };

  const handleLogout = async () => {
    await clearSession();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#FFC107" />
      </View>
    );
  }

  if (!student) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>Could not load your profile.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.heading}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.readOnlyLabel}>Full Name</Text>
        <Text style={styles.readOnlyValue}>{student.name}</Text>
        <Text style={[styles.readOnlyLabel, { marginTop: 12 }]}>Student ID</Text>
        <Text style={styles.readOnlyValue}>{student.student_number}</Text>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>🎓 Academic Information</Text>
      </View>

      {cooldownActive && (
        <View style={styles.cooldownBanner}>
          <Text style={styles.cooldownText}>
            🔒 You can change this again on {formatDate(new Date(cooldownEndsAt).toISOString())}.
          </Text>
        </View>
      )}

      <View style={[styles.card, cooldownActive && styles.cardLocked]}>
        <Text style={styles.label}>School</Text>
        <TouchableOpacity
          style={[styles.selectField, cooldownActive && styles.fieldDisabled]}
          disabled={cooldownActive}
          onPress={() => setActivePicker('school')}
        >
          <Text style={styles.selectValue} numberOfLines={2}>
            {SCHOOLS.find((s) => s.value === school)?.label ?? school}
          </Text>
          {!cooldownActive && <Text style={styles.selectChevron}>▾</Text>}
        </TouchableOpacity>

        <Text style={styles.label}>Program</Text>
        <TouchableOpacity
          style={[styles.selectField, cooldownActive && styles.fieldDisabled]}
          disabled={cooldownActive}
          onPress={() => setActivePicker('program')}
        >
          <Text style={styles.selectValue} numberOfLines={2}>
            {PROGRAMS.find((p) => p.value === program)?.label ?? program}
          </Text>
          {!cooldownActive && <Text style={styles.selectChevron}>▾</Text>}
        </TouchableOpacity>

        {yearLevelOptions.length > 0 && (
          <>
            <Text style={styles.label}>Year Level</Text>
            <TouchableOpacity
              style={[styles.selectField, cooldownActive && styles.fieldDisabled]}
              disabled={cooldownActive}
              onPress={() => setActivePicker('yearLevel')}
            >
              <Text style={styles.selectValue}>
                {yearLevelOptions.find((y) => y.value === yearLevel)?.label ?? yearLevel}
              </Text>
              {!cooldownActive && <Text style={styles.selectChevron}>▾</Text>}
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.label}>Section</Text>
        <TextInput
          style={[styles.input, cooldownActive && styles.fieldDisabled]}
          value={section}
          onChangeText={setSection}
          editable={!cooldownActive}
          autoCapitalize="characters"
        />

        <TouchableOpacity
          style={[
            styles.saveButton,
            (cooldownActive || !hasAcademicChanges || saving) && styles.saveButtonDisabled,
          ]}
          disabled={cooldownActive || !hasAcademicChanges || saving}
          onPress={handleSaveAcademic}
        >
          <Text style={styles.saveButtonText}>
            {cooldownActive ? 'Locked' : 'Save Academic Info'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>⭐ Organizations You Follow</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.chipRow}>
          {Object.keys(orgCategories).map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, activeCategory === cat && styles.categoryChipActive]}
              onPress={() => setActiveCategory(activeCategory === cat ? null : cat)}
            >
              <Text style={[styles.categoryChipText, activeCategory === cat && styles.categoryChipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeCategory && (
          <View style={styles.orgSection}>
            <View style={styles.chipRow}>
              {orgCategories[activeCategory].map((org) => {
                const selected = selectedOrgs.includes(org);
                const suggested = suggestedOrgNames.has(org);
                return (
                  <TouchableOpacity
                    key={org}
                    style={[styles.orgChip, selected && styles.orgChipSelected]}
                    onPress={() => toggleOrg(org)}
                  >
                    <Text style={[styles.orgChipText, selected && styles.orgChipTextSelected]}>
                      {selected ? '✓ ' : suggested ? '⭐ ' : ''}{org}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <Text style={styles.selectedCount}>
          {selectedOrgs.length} organization{selectedOrgs.length !== 1 ? 's' : ''} selected
        </Text>

        <TouchableOpacity
          style={[styles.saveButton, (!hasOrgChanges || saving) && styles.saveButtonDisabled]}
          disabled={!hasOrgChanges || saving}
          onPress={handleSaveOrgs}
        >
          <Text style={styles.saveButtonText}>Save Organizations</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>

      <Modal visible={activePicker !== null} transparent animationType="fade" onRequestClose={() => setActivePicker(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setActivePicker(null)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {activePicker === 'school' ? 'Select your school' : activePicker === 'program' ? 'Select your program' : 'Select your year level'}
            </Text>
            <ScrollView style={styles.modalList}>
              {(activePicker === 'school' ? SCHOOLS : activePicker === 'program' ? programsInSchool : yearLevelOptions).map((item) => {
                const isSelected =
                  activePicker === 'school' ? item.value === school : activePicker === 'program' ? item.value === program : item.value === yearLevel;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => {
                      if (activePicker === 'school') {
                        setSchool(item.value);
                        setProgram('');
                        setYearLevel('');
                      } else if (activePicker === 'program') {
                        setProgram(item.value);
                        setYearLevel('');
                      } else {
                        setYearLevel(item.value);
                      }
                      setActivePicker(null);
                    }}
                  >
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1729' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  heading: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 16 },
  emptyText: { color: '#6B7280', fontSize: 13 },
  sectionHeaderRow: { marginBottom: 10, marginTop: 20 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  card: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16 },
  cardLocked: { opacity: 0.9 },
  readOnlyLabel: { color: '#6B7280', fontSize: 11, textTransform: 'uppercase' },
  readOnlyValue: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 2 },
  cooldownBanner: { backgroundColor: '#3B2F0B', borderWidth: 1, borderColor: '#FFC107', borderRadius: 10, padding: 10, marginBottom: 10 },
  cooldownText: { color: '#FFC107', fontSize: 12, fontWeight: '600' },
  label: { color: '#fff', fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#0F1729', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#fff' },
  selectField: {
    backgroundColor: '#0F1729', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  fieldDisabled: { opacity: 0.5 },
  selectValue: { color: '#fff', fontSize: 14, flex: 1, marginRight: 8 },
  selectChevron: { color: '#9CA3AF', fontSize: 12 },
  saveButton: { backgroundColor: '#FFC107', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  saveButtonDisabled: { backgroundColor: '#374151' },
  saveButtonText: { color: '#0F1729', fontWeight: '700', fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  categoryChip: { backgroundColor: '#0F1729', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#374151' },
  categoryChipActive: { backgroundColor: '#FFC107', borderColor: '#FFC107' },
  categoryChipText: { color: '#9CA3AF', fontSize: 12, fontWeight: '600' },
  categoryChipTextActive: { color: '#0F1729' },
  orgSection: { marginTop: 8, marginBottom: 8 },
  orgChip: { backgroundColor: '#0F1729', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#374151' },
  orgChipSelected: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  orgChipText: { color: '#9CA3AF', fontSize: 12 },
  orgChipTextSelected: { color: '#fff', fontWeight: '600' },
  selectedCount: { color: '#FFC107', fontSize: 12, marginTop: 4, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1E293B', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '70%' },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  modalList: { flexGrow: 0 },
  modalItem: { paddingVertical: 14, paddingHorizontal: 12, borderRadius: 8 },
  modalItemSelected: { backgroundColor: '#2563EB' },
  modalItemText: { color: '#E5E7EB', fontSize: 14 },
  modalItemTextSelected: { color: '#fff', fontWeight: '700' },
  logoutButton: { marginTop: 24, borderWidth: 1, borderColor: '#374151', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
});