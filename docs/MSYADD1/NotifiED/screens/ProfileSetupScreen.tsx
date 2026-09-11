import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { markProfileCompleted, clearSession } from '../utils/auth';
import { supabase } from '../utils/supabase';

export default function ProfileSetupScreen({ navigation, route }: any) {
  const email = route?.params?.email ?? 'Unknown account';
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [program, setProgram] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [section, setSection] = useState('');

  const canContinue = fullName && studentId && program && yearLevel && section;

  const handleContinue = async () => {
    const { error } = await supabase.from('student').insert({
      ms_account_id: email, // stand-in for the real oid/sub for now
      name: fullName,
      student_number: studentId,
      program,
      year_level: yearLevel,
      section,
    });

    if (error) {
      console.error('Supabase insert error:', error);
      Alert.alert('Error', 'Could not save your profile. Please try again.');
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
      <Text style={styles.heading}>Let's set up your profile!</Text>
      <Text style={styles.subheading}>
        Tell us a little about yourself so we can personalize your NotifiED experience.
      </Text>

      <View style={styles.stepper}>
        <View style={[styles.stepCircle, styles.stepActive]}><Text style={styles.stepNum}>1</Text></View>
        <View style={styles.stepLine} />
        <View style={styles.stepCircle}><Text style={styles.stepNum}>2</Text></View>
        <View style={styles.stepLine} />
        <View style={styles.stepCircle}><Text style={styles.stepNum}>3</Text></View>
      </View>
      <View style={styles.stepLabels}>
        <Text style={styles.stepLabelActive}>Your Information</Text>
        <Text style={styles.stepLabel}>Preferences</Text>
        <Text style={styles.stepLabel}>Done</Text>
      </View>

      <Text style={styles.label}>Full Name</Text>
      <TextInput style={styles.input} placeholder="Enter your full name" placeholderTextColor="#6B7280" value={fullName} onChangeText={setFullName} />

      <Text style={styles.label}>Student ID</Text>
      <TextInput style={styles.input} placeholder="Enter your student ID" placeholderTextColor="#6B7280" value={studentId} onChangeText={setStudentId} />

      <Text style={styles.label}>Program</Text>
      <View style={styles.pickerWrapper}>
        <Picker selectedValue={program} onValueChange={setProgram} style={styles.pickerText}>
          <Picker.Item label="Select your program" value="" />
          <Picker.Item label="BSCS" value="BSCS" />
          <Picker.Item label="BSIT" value="BSIT" />
          <Picker.Item label="BSMA" value="BSMA" />
        </Picker>
      </View>

      <Text style={styles.label}>Year Level</Text>
      <View style={styles.pickerWrapper}>
        <Picker selectedValue={yearLevel} onValueChange={setYearLevel} style={styles.pickerText}>
          <Picker.Item label="Select your year level" value="" />
          <Picker.Item label="1st Year" value="1" />
          <Picker.Item label="2nd Year" value="2" />
          <Picker.Item label="3rd Year" value="3" />
          <Picker.Item label="4th Year" value="4" />
        </Picker>
      </View>

      <Text style={styles.label}>Section</Text>
      <View style={styles.pickerWrapper}>
        <Picker selectedValue={section} onValueChange={setSection} style={styles.pickerText}>
          <Picker.Item label="Select your section" value="" />
          <Picker.Item label="A" value="A" />
          <Picker.Item label="B" value="B" />
          <Picker.Item label="C" value="C" />
        </Picker>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>🛡 Your information is safe</Text>
        <Text style={styles.infoText}>
          We only use your information to personalize your experience and will never share it.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.continueButton, !canContinue && { opacity: 0.5 }]}
        disabled={!canContinue}
        onPress={handleContinue}
      >
        <Text style={styles.continueText}>Continue →</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
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
  stepLabel: { color: '#6B7280', fontSize: 12 },
  label: { color: '#fff', fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#1E293B', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#fff' },
  pickerWrapper: { backgroundColor: '#1E293B', borderRadius: 10, overflow: 'hidden' },
  pickerText: { color: '#fff' },
  infoBox: { backgroundColor: '#1E293B', borderRadius: 10, padding: 14, marginTop: 24, marginBottom: 20 },
  infoTitle: { color: '#fff', fontWeight: '600', fontSize: 13, marginBottom: 4 },
  infoText: { color: '#9CA3AF', fontSize: 12 },
  continueButton: { backgroundColor: '#FFC107', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  continueText: { fontWeight: '700', fontSize: 16 },
  logoutButton: { marginTop: 16, alignItems: 'center' },
  logoutText: { color: '#9CA3AF', fontSize: 13 },
});