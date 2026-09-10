import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { clearSession } from '../utils/auth';

export default function ProfileSetupScreen({ navigation, route }: any) {
  const email = route?.params?.email ?? 'Unknown account';

  const handleLogout = async () => {
    await clearSession();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };
 
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>✅</Text>
      <Text style={styles.title}>Profile Setup</Text>
      <Text style={styles.subtitle}>Signed in as:</Text>
      <Text style={styles.email}>{email}</Text>
      <Text style={styles.note}>
        (This is a placeholder — the actual profile setup form will go here:
        name, student number, year level, section, program.)
      </Text>

      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666' },
  email: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  note: { fontSize: 12, color: '#999', textAlign: 'center', marginBottom: 32 },
  button: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24 },
  buttonText: { fontSize: 15, fontWeight: '600' },
});