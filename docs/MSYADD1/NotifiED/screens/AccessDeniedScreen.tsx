import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function AccessDeniedScreen({ navigation, route }: any) {
  const email = route?.params?.email ?? 'This account';

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🚫</Text>
      <Text style={styles.title}>Access Restricted</Text>
      <Text style={styles.subtitle}>
        {email} is not a registered APC student account. Notified is only available to
        APC students signing in with their official school email.
      </Text>
      <TouchableOpacity style={styles.button} onPress={() => navigation.replace('Login')}>
        <Text style={styles.buttonText}>Try a different account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 },
  button: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20 },
  buttonText: { fontSize: 15, fontWeight: '600' },
});