import React, { useState } from 'react';
import { ScrollView, View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn, Field, Err, Segments, H, P } from '../components/ui';
import { useApp } from '../state/AppContext';
import { makeT, LANGS } from '../i18n';
import { C } from '../theme';

export default function AuthScreen() {
  const { auth, lang, setLang } = useApp();
  const t = makeT(lang);
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Enter a valid email address.');
    if (pw.length < 8) return setErr('Password must be at least 8 characters.');
    setBusy(true);
    const e = await auth(mode, email.trim(), pw);
    setBusy(false);
    if (e) setErr(e);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.soft }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 22, paddingTop: 40 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', marginBottom: 26 }}>
            <View style={{ width: 84, height: 84, borderRadius: 26, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 44 }}>🛡️</Text>
            </View>
            <Text style={{ fontSize: 32, fontWeight: '800', color: C.ink, marginTop: 14 }}>SafeHer</Text>
            <Text style={{ fontSize: 16, color: C.muted, marginTop: 4, textAlign: 'center' }}>{t('welcome')}</Text>
          </View>
          <Segments items={LANGS} value={lang} onChange={setLang} />
          <Segments items={[['login', t('signIn')], ['register', t('register')]]} value={mode} onChange={(m) => { setMode(m); setErr(''); }} />
          <Field label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
          <Field label={t('password')} value={pw} onChangeText={setPw} secureTextEntry autoComplete={mode === 'login' ? 'current-password' : 'new-password'} textContentType={mode === 'login' ? 'password' : 'newPassword'} placeholder={mode === 'register' ? t('pw8') : ''} onSubmitEditing={submit} />
          <Err>{err}</Err>
          <Btn title={mode === 'login' ? t('signIn') : t('register')} onPress={submit} busy={busy} />
          <P style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>Your photos and pasted messages stay on your phone. Contacts and reports are stored encrypted.</P>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
