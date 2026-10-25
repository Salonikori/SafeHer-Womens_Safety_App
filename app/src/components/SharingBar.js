import React from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useSos } from '../state/Sos';
import { useApp } from '../state/AppContext';
import { makeT } from '../i18n';
import { useNow, fmtLeft } from '../util';
import { C } from '../theme';

// Always-visible indicator while location is being shared, with a one-tap stop.
export default function SharingBar() {
  const { sos, stop } = useSos();
  const { lang } = useApp();
  const t = makeT(lang);
  const now = useNow(15000);
  if (!sos) return null;
  const isSos = sos.kind === 'sos';
  const left = fmtLeft(Date.parse(sos.expires_at) - now);
  const halt = () => isSos
    ? Alert.alert('Stop the SOS?', 'Your contacts will no longer see your location.', [{ text: t('cancel'), style: 'cancel' }, { text: t('stop'), style: 'destructive', onPress: stop }])
    : stop();
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: isSos ? C.bad : C.ok, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: '#fff', fontWeight: '700', flex: 1 }}>{isSos ? '🚨 SOS active' : '📍 ' + t('sharingOn')} · {left} {t('left')}</Text>
      <Pressable onPress={halt} style={{ backgroundColor: 'rgba(255,255,255,.25)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 }} accessibilityRole="button">
        <Text style={{ color: '#fff', fontWeight: '800' }}>{t('stop')}</Text>
      </Pressable>
    </View>
  );
}
