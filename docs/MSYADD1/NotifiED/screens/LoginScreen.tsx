import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { saveSession } from '../utils/auth';

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID = 'c1f5d99a-7fa1-41f7-9a5a-a754dc23410f';
const TENANT = 'common';

const discovery = {
  authorizationEndpoint: `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`,
  tokenEndpoint: `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`,
};

const TEST_STUDENT_PREFIX = 'notified.test.';
function isAuthorizedStudent(email: string): boolean {
  return email.toLowerCase().startsWith(TEST_STUDENT_PREFIX);
}

export default function LoginScreen({ navigation }: any) {
  const redirectUri = AuthSession.makeRedirectUri();
  const IS_TESTING = true;

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes: ['openid', 'profile', 'email', 'User.Read', 'offline_access'],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      extraParams: IS_TESTING ? { prompt: 'select_account' } : {},
    },
    discovery
  );

  useEffect(() => {
    const handleLogin = async () => {
      if (response?.type === 'success' && request) {
        try {
          const tokenResult = await AuthSession.exchangeCodeAsync(
            {
              clientId: CLIENT_ID,
              code: response.params.code,
              redirectUri,
              extraParams: {
                code_verifier: request.codeVerifier ?? '',
              },
            },
            discovery
          );

          const res = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
          });
          const profile = await res.json();
          const email = profile.mail ?? profile.userPrincipalName ?? '';

          if (isAuthorizedStudent(email)) {
            await saveSession({
              accessToken: tokenResult.accessToken,
              refreshToken: tokenResult.refreshToken,
              email,
              expiresAt: Date.now() + (tokenResult.expiresIn ?? 3600) * 1000,
              profileCompleted: false, // placeholder until Supabase check exists
            });
            navigation.navigate('ProfileSetup', { email });
          } else {
            navigation.navigate('AccessDenied', { email });
          }
        } catch (err) {
          console.error(err);
          Alert.alert('Error', 'Could not verify account. Please try again.');
        }
      } else if (response?.type === 'error') {
        Alert.alert('Login failed', response.error?.message ?? 'Unknown error');
      }
    };
    handleLogin();
  }, [response]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Log in or sign up</Text>
      <Text style={styles.subheading}>Welcome back. Pick an option to get started.</Text>
      <TouchableOpacity style={styles.msButton} disabled={!request} onPress={() => promptAsync()}>
        <Text style={styles.msIcon}>⊞</Text>
        <Text style={styles.msButtonText}>Continue with Microsoft</Text>
      </TouchableOpacity>
      <Text style={styles.terms}>By continuing, you agree to our Terms and Privacy Policy.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  heading: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subheading: { fontSize: 14, color: '#666', marginBottom: 32 },
  msButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 14, marginBottom: 12 },
  msIcon: { fontSize: 18, marginRight: 10 },
  msButtonText: { fontSize: 15, fontWeight: '600' },
  terms: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 24 },
});