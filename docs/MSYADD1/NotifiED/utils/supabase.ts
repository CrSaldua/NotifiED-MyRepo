import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nwtvaivbdcedwdzseicv.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53dHZhaXZiZGNlZHdkenNlaWN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMjIwODEsImV4cCI6MjEwNDU5ODA4MX0.vVffserCNQidMrj5_UBHg0r6n6NtLURZMFC1cVUBpe4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);