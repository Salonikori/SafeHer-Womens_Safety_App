import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import SharingBar from '../components/SharingBar';
import SosScreen from './SosScreen';
import RoutesScreen from './RoutesScreen';
import CheckScreen from './CheckScreen';
import ReportsScreen from './ReportsScreen';
import PrivacyScreen from './PrivacyScreen';
import AccountScreen from './AccountScreen';
import { useApp } from '../state/AppContext';
import { makeT } from '../i18n';
import { C } from '../theme';

const TABS = [['sos', '🆘', 'tabSos'], ['routes', '🧭', 'tabRoutes'], ['check', '🔎', 'tabCheck'], ['reports', '📝', 'tabReports'], ['privacy', '🔒', 'tabPrivacy'], ['me', '👤', 'tabMe']];

export default function MainScreen() {
  const { lang, disguise, lock } = useApp();
  const t = makeT(lang);
  const [tab, setTab] = useState('sos');
  const scr = { sos: <SosScreen goTab={setTab} />, routes: <RoutesScreen goTab={setTab} />, check: <CheckScreen />, reports: <ReportsScreen />, privacy: <PrivacyScreen />, me: <AccountScreen /> };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.soft }} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 }}>
        <Pressable onLongPress={lock} delayLongPress={1500} accessibilityLabel="SafeHer"><Text style={{ fontSize: 22, fontWeight: '800', color: C.primary }}>🛡️ SafeHer</Text></Pressable>
        {disguise.on && disguise.hash ? (
          <Pressable onPress={lock} accessibilityRole="button" accessibilityLabel="Hide app" style={{ backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ fontWeight: '800', color: C.primaryDark }}>🧮 {t('hide')}</Text>
          </Pressable>
        ) : null}
      </View>
      <SharingBar />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Every tab stays mounted so half-typed forms and results survive switching tabs. */}
        {TABS.map(([k]) => (
          <ScrollView key={k} style={{ flex: 1, display: tab === k ? 'flex' : 'none' }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
            {scr[k]}
          </ScrollView>
        ))}
      </KeyboardAvoidingView>
      <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.line }}>
        {TABS.map(([k, icon, label]) => (
          <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ fontSize: 22, opacity: tab === k ? 1 : 0.55 }}>{icon}</Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: tab === k ? C.primary : C.muted }}>{t(label)}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}
