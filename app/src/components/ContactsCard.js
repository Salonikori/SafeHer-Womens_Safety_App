import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Btn, Card, H, P, Field, Err } from './ui';
import { api, errText } from '../api';
import { useApp } from '../state/AppContext';
import { makeT } from '../i18n';
import { C } from '../theme';

export default function ContactsCard() {
  const { contacts, refreshContacts, lang } = useApp();
  const t = makeT(lang);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setErr('');
    const ph = phone.replace(/[\s-]/g, '');
    if (!name.trim()) return setErr('Enter a name.');
    if (!/^\+?\d{8,15}$/.test(ph)) return setErr('Enter a valid phone number with country code, for example +919876543210.');
    setBusy(true);
    const r = await api('/contacts', 'POST', { name: name.trim(), phone: ph });
    setBusy(false);
    if (!r.ok) return setErr(errText(r));
    setName(''); setPhone(''); refreshContacts();
  };
  const del = (c) => Alert.alert(t('remove') + ' ' + c.name + '?', '', [
    { text: t('cancel'), style: 'cancel' },
    { text: t('remove'), style: 'destructive', onPress: async () => { await api('/contacts/' + c.id, 'DELETE'); refreshContacts(); } }
  ]);

  return (
    <Card>
      <H style={{ fontSize: 18 }}>{t('contacts')}</H>
      <P>{t('contactsHint')}</P>
      {contacts.length === 0 ? <P style={{ fontStyle: 'italic' }}>{t('noContacts')}</P> : contacts.map((c) => (
        <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: C.ink, fontSize: 16 }}>{c.name}</Text>
            <Text style={{ color: C.muted }}>{c.phone}</Text>
          </View>
          <Btn small variant="ghost" title={t('remove')} onPress={() => del(c)} />
        </View>
      ))}
      {contacts.length < 5 && (
        <View style={{ marginTop: 12 }}>
          <Field label={t('name')} value={name} onChangeText={setName} autoComplete="name" />
          <Field label={t('phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+919876543210" />
          <Err>{err}</Err>
          <Btn title={t('add')} onPress={add} busy={busy} variant="soft" />
        </View>
      )}
    </Card>
  );
}
