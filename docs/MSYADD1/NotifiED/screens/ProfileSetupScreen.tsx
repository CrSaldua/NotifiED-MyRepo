import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal } from 'react-native';
import { markProfileCompleted, clearSession } from '../utils/auth';
import { supabase } from '../utils/supabase';

type ProgramLevel = 'shs' | 'associate' | 'bachelor' | 'masters';

const SCHOOLS: { label: string; value: string }[] = [
  { label: 'Senior High School', value: 'SHS' },
  { label: 'School of Architecture', value: 'SARCH' },
  { label: 'School of Computing and Information Technology', value: 'SOCIT' },
  { label: 'School of Engineering', value: 'SOE' },
  { label: 'School of Management', value: 'SOM' },
  { label: 'School of Multimedia and Arts', value: 'SOMA' },
  { label: 'Graduate School', value: 'GS' },
];

const PROGRAMS: { label: string; value: string; level: ProgramLevel; school: string }[] = [
  { label: 'Senior High School', value: 'SHS', level: 'shs', school: 'SHS' },

  { label: 'Bachelor of Science in Architecture', value: 'BSARCH', level: 'bachelor', school: 'SARCH' },

  { label: 'Bachelor of Science in Computer Science', value: 'BSCS', level: 'bachelor', school: 'SOCIT' },
  { label: 'Bachelor of Science in Information Technology', value: 'BSIT', level: 'bachelor', school: 'SOCIT' },
  { label: 'Associate in Computer Technology', value: 'ACT', level: 'associate', school: 'SOCIT' },

  { label: 'Bachelor of Science in Civil Engineering', value: 'BSCE', level: 'bachelor', school: 'SOE' },
  { label: 'Bachelor of Science in Computer Engineering', value: 'BSCOE', level: 'bachelor', school: 'SOE' },

  { label: 'Bachelor of Science in Accountancy', value: 'BSA', level: 'bachelor', school: 'SOM' },
  { label: 'Bachelor of Science in Business Administration major in Business Analytics', value: 'BSBA-BA', level: 'bachelor', school: 'SOM' },
  { label: 'Bachelor of Science in Business Administration major in Digital Marketing', value: 'BSBA-DM', level: 'bachelor', school: 'SOM' },
  { label: 'Bachelor of Science in Business Administration major in Financial Management', value: 'BSBA-FM', level: 'bachelor', school: 'SOM' },
  { label: 'Bachelor of Science in Tourism Management', value: 'BSTM', level: 'bachelor', school: 'SOM' },

  { label: 'Bachelor of Arts in Psychology', value: 'ABPSYCH', level: 'bachelor', school: 'SOMA' },
  { label: 'Bachelor of Multimedia Arts', value: 'BMMA', level: 'bachelor', school: 'SOMA' },

  { label: 'Master in Management', value: 'MM', level: 'masters', school: 'GS' },
  { label: 'Master in Information Systems', value: 'MIS', level: 'masters', school: 'GS' },
  { label: 'Master in Information Technology', value: 'MIT', level: 'masters', school: 'GS' },
  { label: 'Master of Engineering major in Computer Engineering', value: 'MECOE', level: 'masters', school: 'GS' },
  { label: 'Master in Game Design', value: 'MGD', level: 'masters', school: 'GS' },
  { label: 'Master of Science in Computer Science', value: 'MSCS', level: 'masters', school: 'GS' },
];

const YEAR_LEVELS_BY_PROGRAM_LEVEL: Record<ProgramLevel, { label: string; value: string }[]> = {
  shs: [
    { label: 'Grade 11', value: '11' },
    { label: 'Grade 12', value: '12' },
  ],
  associate: [
    { label: '1st Year', value: '1' },
    { label: '2nd Year', value: '2' },
  ],
  bachelor: [
    { label: '1st Year', value: '1' },
    { label: '2nd Year', value: '2' },
    { label: '3rd Year', value: '3' },
    { label: '4th Year', value: '4' },
  ],
  masters: [],
};

const formatStudentId = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
};

const buildFullName = (firstName: string, middleName: string, lastName: string) => {
  const parts = [firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean);
  return parts.join(' ');
};

type OrganizationRow = { organization_id: string; name: string; category: string | null; school: string | null };

export default function ProfileSetupScreen({ navigation, route }: any) {
  const email = route?.params?.email ?? 'Unknown account';
  const [step, setStep] = useState(1);

  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);

  useEffect(() => {
   supabase
     .from('organization')
     .select('organization_id,name,category,school')
     .then(({ data }) => {
       if (data) setOrganizations(data as OrganizationRow[]);
       });
  }, []);

  // Step 1 fields
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [school, setSchool] = useState('');
  const [program, setProgram] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [section, setSection] = useState('');

  // Step 2 fields
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);

  const [activePicker, setActivePicker] = useState<'school' | 'program' | 'yearLevel' | null>(null);

  const programsInSchool = school ? PROGRAMS.filter((p) => p.school === school) : [];
  const selectedProgramLevel = PROGRAMS.find((p) => p.value === program)?.level;
  const yearLevelOptions = selectedProgramLevel ? YEAR_LEVELS_BY_PROGRAM_LEVEL[selectedProgramLevel] : [];
  const requiresYearLevel = selectedProgramLevel ? selectedProgramLevel !== 'masters' : true;

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
   () => new Set(organizations.filter((o) => o.school && o.school === school).map((o) => o.name)),
   [organizations, school]
 );

  const canContinueStep1 = Boolean(
    firstName.trim() && lastName.trim() && studentId && school && program && (!requiresYearLevel || yearLevel) && section
  );

  const toggleOrg = (org: string) => {
    setSelectedOrgs((prev) =>
      prev.includes(org) ? prev.filter((o) => o !== org) : [...prev, org]
    );
  };

  const handleFinish = async () => {
    const { error } = await supabase.from('student').insert({
      ms_account_id: email,
      name: buildFullName(firstName, middleName, lastName),
      student_number: studentId,
      school,
      program,
      year_level: yearLevel,
      section,
      preferred_organizations: selectedOrgs,
    });

    if (error) {
      console.error('Supabase insert error:', error);
      if (error.code === '23505') {
        Alert.alert(
          'Student ID already registered',
          'This Student ID is already linked to another account. Double-check your ID or contact the SAO if you believe this is an error.'
        );
      } else {
        Alert.alert('Error', 'Could not save your profile. Please try again.');
      }
      return;
    }

    await markProfileCompleted();
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
  };

  const handleLogout = async () => {
    await clearSession();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 24 }}>
      <Text style={styles.brand}>Notifi<Text style={styles.brandAccent}>ED</Text></Text>
      <Text style={styles.heading}>
        {step === 1 ? "Let's set up your profile!" : "What are you into?"}
      </Text>
      <Text style={styles.subheading}>
        {step === 1
          ? 'Tell us a little about yourself so we can personalize your NotifiED experience.'
          : 'Pick a few categories, then tap the organizations you want to hear from.'}
      </Text>

      <View style={styles.stepper}>
        <View style={[styles.stepCircle, step >= 1 && styles.stepActive]}><Text style={styles.stepNum}>1</Text></View>
        <View style={styles.stepLine} />
        <View style={[styles.stepCircle, step >= 2 && styles.stepActive]}><Text style={styles.stepNum}>2</Text></View>
        <View style={styles.stepLine} />
        <View style={styles.stepCircle}><Text style={styles.stepNum}>3</Text></View>
      </View>
      <View style={styles.stepLabels}>
        <Text style={step === 1 ? styles.stepLabelActive : styles.stepLabelDone}>Your Information</Text>
        <Text style={step === 2 ? styles.stepLabelActive : styles.stepLabel}>Preferences</Text>
        <Text style={styles.stepLabel}>Done</Text>
      </View>

      {step === 1 && (
        <>
          <Text style={styles.label}>First Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your first name"
            placeholderTextColor="#6B7280"
            value={firstName}
            onChangeText={setFirstName}
          />

          <Text style={styles.label}>Middle Name <Text style={styles.optionalLabel}>(optional)</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your middle name"
            placeholderTextColor="#6B7280"
            value={middleName}
            onChangeText={setMiddleName}
          />

          <Text style={styles.label}>Last Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your last name"
            placeholderTextColor="#6B7280"
            value={lastName}
            onChangeText={setLastName}
          />

          <Text style={styles.label}>Student ID</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 2020-100000"
            placeholderTextColor="#6B7280"
            value={studentId}
            onChangeText={(text) => setStudentId(formatStudentId(text))}
            keyboardType="number-pad"
            maxLength={11}
          />

          <Text style={styles.label}>School</Text>
          <TouchableOpacity style={styles.selectField} onPress={() => setActivePicker('school')}>
            <Text style={school ? styles.selectValue : styles.selectPlaceholder} numberOfLines={2}>
              {school ? SCHOOLS.find((s) => s.value === school)?.label : 'Select your school'}
            </Text>
            <Text style={styles.selectChevron}>▾</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Program</Text>
          <TouchableOpacity
            style={[styles.selectField, !school && styles.selectFieldDisabled]}
            disabled={!school}
            onPress={() => setActivePicker('program')}
          >
            <Text
              style={program ? styles.selectValue : styles.selectPlaceholder}
              numberOfLines={2}
            >
              {program
                ? PROGRAMS.find((p) => p.value === program)?.label
                : school
                ? 'Select your program'
                : 'Select a school first'}
            </Text>
            <Text style={styles.selectChevron}>▾</Text>
          </TouchableOpacity>

          {requiresYearLevel && program && (
            <>
              <Text style={styles.label}>Year Level</Text>
              <TouchableOpacity style={styles.selectField} onPress={() => setActivePicker('yearLevel')}>
                <Text style={yearLevel ? styles.selectValue : styles.selectPlaceholder}>
                  {yearLevel ? yearLevelOptions.find((y) => y.value === yearLevel)?.label : 'Select your year level'}
                </Text>
                <Text style={styles.selectChevron}>▾</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.label}>Section</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. IT242"
            placeholderTextColor="#6B7280"
            value={section}
            onChangeText={setSection}
            autoCapitalize="characters"
          />

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>🛡 Your information is safe</Text>
            <Text style={styles.infoText}>
              We only use your information to personalize your experience and will never share it.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.continueButton, !canContinueStep1 && { opacity: 0.5 }]}
            disabled={!canContinueStep1}
            onPress={() => setStep(2)}
          >
            <Text style={styles.continueText}>Continue →</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 2 && (
        <>
          <View style={styles.chipRow}>
            {Object.keys(orgCategories).map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.genreChip, activeCategory === cat && styles.genreChipActive]}
                onPress={() => setActiveCategory(activeCategory === cat ? null : cat)}
              >
                <Text style={[styles.genreChipText, activeCategory === cat && styles.genreChipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeCategory && (
            <View style={styles.orgSection}>
              <Text style={styles.orgSectionTitle}>{activeCategory} Organizations</Text>
              {suggestedOrgNames.size > 0 && (
                <Text style={styles.suggestedHint}>⭐ Suggested based on your school</Text>
              )}
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

          {selectedOrgs.length > 0 && (
            <Text style={styles.selectedCount}>
              {selectedOrgs.length} organization{selectedOrgs.length !== 1 ? 's' : ''} selected
            </Text>
          )}

          <TouchableOpacity style={styles.continueButton} onPress={handleFinish}>
            <Text style={styles.continueText}>Finish →</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>

      <Modal
        visible={activePicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActivePicker(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setActivePicker(null)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {activePicker === 'school'
                ? 'Select your school'
                : activePicker === 'program'
                ? 'Select your program'
                : 'Select your year level'}
            </Text>
            <ScrollView style={styles.modalList}>
              {(activePicker === 'school'
                ? SCHOOLS
                : activePicker === 'program'
                ? programsInSchool
                : yearLevelOptions
              ).map((item) => {
                const isSelected =
                  activePicker === 'school'
                    ? item.value === school
                    : activePicker === 'program'
                    ? item.value === program
                    : item.value === yearLevel;
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
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                      {item.label}
                    </Text>
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
  brand: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  brandAccent: { color: '#FFC107' },
  heading: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subheading: { color: '#9CA3AF', fontSize: 14, marginBottom: 24 },
  stepper: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' },
  stepActive: { backgroundColor: '#FFC107' },
  stepNum: { color: '#fff', fontWeight: '600', fontSize: 13 },
  stepLine: { flex: 1, height: 2, backgroundColor: '#374151', marginHorizontal: 4 },
  stepLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  stepLabelActive: { color: '#FFC107', fontSize: 12, fontWeight: '600' },
  stepLabelDone: { color: '#9CA3AF', fontSize: 12 },
  stepLabel: { color: '#6B7280', fontSize: 12 },
  label: { color: '#fff', fontSize: 13, marginBottom: 6, marginTop: 12 },
  optionalLabel: { color: '#6B7280', fontSize: 11, fontWeight: '400' },
  input: { backgroundColor: '#1E293B', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#fff' },
  selectField: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectFieldDisabled: { opacity: 0.5 },
  selectValue: { color: '#fff', fontSize: 14, flex: 1, marginRight: 8 },
  selectPlaceholder: { color: '#6B7280', fontSize: 14, flex: 1, marginRight: 8 },
  selectChevron: { color: '#9CA3AF', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '70%',
  },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  modalList: { flexGrow: 0 },
  modalItem: { paddingVertical: 14, paddingHorizontal: 12, borderRadius: 8 },
  modalItemSelected: { backgroundColor: '#2563EB' },
  modalItemText: { color: '#E5E7EB', fontSize: 14 },
  modalItemTextSelected: { color: '#fff', fontWeight: '700' },
  infoBox: { backgroundColor: '#1E293B', borderRadius: 10, padding: 14, marginTop: 24, marginBottom: 20 },
  infoTitle: { color: '#fff', fontWeight: '600', fontSize: 13, marginBottom: 4 },
  infoText: { color: '#9CA3AF', fontSize: 12 },
  continueButton: { backgroundColor: '#FFC107', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  continueText: { fontWeight: '700', fontSize: 16 },
  backButton: { alignItems: 'center', marginTop: 12 },
  backText: { color: '#9CA3AF', fontSize: 13 },
  logoutButton: { marginTop: 16, alignItems: 'center' },
  logoutText: { color: '#9CA3AF', fontSize: 13 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  genreChip: { backgroundColor: '#1E293B', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16, marginRight: 8, marginBottom: 8 },
  genreChipActive: { backgroundColor: '#FFC107' },
  genreChipText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  genreChipTextActive: { color: '#0F1729' },
  orgSection: { marginTop: 16, marginBottom: 8 },
  orgSectionTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  suggestedHint: { color: '#FFC107', fontSize: 11, marginBottom: 8 },
  orgChip: { backgroundColor: '#1E293B', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: '#374151' },
  orgChipSelected: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  orgChipText: { color: '#9CA3AF', fontSize: 12 },
  orgChipTextSelected: { color: '#fff', fontWeight: '600' },
  selectedCount: { color: '#FFC107', fontSize: 12, marginTop: 8, marginBottom: 4, textAlign: 'center' },
});