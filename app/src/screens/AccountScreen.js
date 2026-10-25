import React, { useState } from 'react';
import { View, Text, Alert, Linking } from 'react-native';
import { Btn, Card, H, P, Row, Field, Err, Check, Segments } from '../components/ui';
import { useApp } from '../state/AppContext';
import { makeT, LANGS } from '../i18n';
import { api, errText } from '../api';
import { C } from '../theme';

export default function AccountScreen() {
  const { user, setUser, lang, setLang, disguise, saveDisguise, lock, signOut, deleteAccount, guard } = useApp();
  const t = makeT(lang);
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [pMsg, setPMsg] = useState('');
  const [on, setOn] = useState(!!disguise.on);
  const [code, setCode] = useState('');
  const [auto, setAuto] = useState(disguise.auto !== false);
  const [dMsg, setDMsg] = useState('');
  const [dErr, setDErr] = useState('');

  const saveProfile = async () => {
    setPMsg('');
    const r = await api('/profile', 'PUT', { name, phone });
    if (r.ok) { setUser({ ...user, ...r.j.user }); setPMsg(t('saved')); } else setPMsg(errText(r));
  };
  const savePrivacy = async () => {
    setDMsg(''); setDErr('');
    const e = await saveDisguise({ on, code: code.trim(), auto });
    if (e) return setDErr(e);
    setCode(''); setDMsg(on ? 'Saved. From now on the app opens as a calculator. Type your code and press = to open SafeHer.' : 'Saved. Calculator disguise is off.');
  };
  const del = () => Alert.alert('Delete your account?', 'Your contacts, reports, photos and all data will be erased. This cannot be undone.', [
    { text: t('cancel'), style: 'cancel' },
    { text: 'Delete everything', style: 'destructive', onPress: async () => { const e = await deleteAccount(); if (e) Alert.alert('Could not delete', e); } }]);

  return (
    <View>
      <H>{t('me')}</H>
      <P>{user.email}</P>

      <Card>
        <H style={{ fontSize: 18 }}>🧮  {t('disguise')}</H>
        <P>{t('disguiseHint')}</P>
        <Check on={on} onChange={setOn} label={t('disguise')} />
        <Field label={t('secretCode')} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry maxLength={8}
          placeholder={disguise.hash ? 'Enter a new code to change it' : 'For example 2580'} />
        <Check on={auto} onChange={setAuto} label={t('autoHide')} />
        <Err>{dErr}</Err>
        {dMsg ? <Text style={{ color: C.ok, fontWeight: '700', marginBottom: 10 }}>{dMsg}</Text> : null}
        <Row>
          <Btn small title={t('save')} onPress={savePrivacy} />
          {disguise.on && disguise.hash ? <Btn small variant="ghost" title="Hide app now" onPress={lock} /> : null}
        </Row>
        <P style={{ marginTop: 10, fontSize: 13 }}>Pick a code you will not forget. If you forget it, you must clear the app’s data or reinstall it. Tip: for the app to also appear as “Calculator” on your home screen, it must be built with APP_DISGUISE=1 (see README).</P>
      </Card>

      <Card>
        <H style={{ fontSize: 18 }}>{t('profile')}</H>
        <Field label={t('yourName')} value={name} onChangeText={setName} autoComplete="name" />
        <Field label={t('yourPhone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+919876543210" />
        {pMsg ? <Text style={{ color: pMsg === t('saved') ? C.ok : C.bad, fontWeight: '700', marginBottom: 8 }}>{pMsg}</Text> : null}
        <Btn small title={t('save')} onPress={saveProfile} />
      </Card>

      <Card>
        <H style={{ fontSize: 18 }}>{t('language')}</H>
        <Segments items={LANGS} value={lang} onChange={setLang} />
      </Card>

      <Card>
        <H style={{ fontSize: 18 }}>Helplines (India)</H>
        <Row>
          <Btn small variant="call" title="Emergency 112" onPress={() => guard(() => Linking.openURL('tel:112'))} />
          <Btn small variant="ghost" title="Women 181" onPress={() => guard(() => Linking.openURL('tel:181'))} />
          <Btn small variant="ghost" title="Cyber crime 1930" onPress={() => guard(() => Linking.openURL('tel:1930'))} />
        </Row>
      </Card>

      <Btn variant="ghost" title={t('signOut')} onPress={signOut} style={{ marginBottom: 10 }} />
      <Btn variant="danger" title={t('deleteAcc')} onPress={del} />
    </View>
  );
}
