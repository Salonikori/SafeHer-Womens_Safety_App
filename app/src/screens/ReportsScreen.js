import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, Alert, Platform, Pressable } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Btn, Card, H, P, Row, Chip, Field, Err } from '../components/ui';
import { useApp } from '../state/AppContext';
import { makeT } from '../i18n';
import { api, errText, currentToken } from '../api';
import { API } from '../config';
import { fmtDate } from '../util';
import { C } from '../theme';

const MAX_BYTES = 2 * 1024 * 1024;

export default function ReportsScreen() {
  const { lang, guard } = useApp();
  const t = makeT(lang);
  const [cats, setCats] = useState([]);
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await api('/reports');
    if (r.ok) { setCats(r.j.categories); setList(r.j.reports); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const pickPhotos = async (limit) => guard(async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: limit > 1, selectionLimit: limit, quality: 0.6, base64: true });
    if (r.canceled) return [];
    return r.assets.filter((a) => a.base64 && a.base64.length * 0.75 <= MAX_BYTES).slice(0, limit);
  });
  const upload = (id, a) => api(`/reports/${id}/evidence`, 'POST', { mime: 'image/jpeg', name: (a.fileName || 'photo') .replace(/\.[^.]+$/, '') + '.jpg', data: a.base64 }, { timeout: 30000 });

  const addPhoto = async (rep) => {
    const left = 3 - rep.files.length;
    const assets = await pickPhotos(left);
    for (const a of assets) { const r = await upload(rep.id, a); if (!r.ok) { Alert.alert('Could not attach', errText(r)); break; } }
    load();
  };
  const del = (rep) => Alert.alert('Delete this report?', 'This also deletes its photos and cannot be undone.', [
    { text: t('cancel'), style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await api('/reports/' + rep.id, 'DELETE'); load(); } }]);
  const delFile = async (rep, f) => { await api(`/reports/${rep.id}/evidence/${f.id}`, 'DELETE'); load(); };

  const exportCsv = async () => {
    try {
      const res = await fetch(API + '/reports/export.csv', { headers: { Authorization: 'Bearer ' + currentToken() } });
      if (!res.ok) throw 0;
      const path = FileSystem.cacheDirectory + 'safeher-reports.csv';
      await FileSystem.writeAsStringAsync(path, await res.text());
      await guard(() => Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export reports' }));
    } catch { Alert.alert('Could not export', 'Check your connection and try again.'); }
  };

  const shown = filter ? list.filter((x) => x.type === filter) : list;

  if (form) return <NewReport cats={cats} t={t} pickPhotos={pickPhotos} upload={upload} onDone={() => { setForm(false); load(); }} />;

  return (
    <View>
      <H>{t('reportsTitle')}</H>
      <P>{t('reportsHint')}</P>
      <Row style={{ marginBottom: 12 }}>
        <Btn title={'＋ ' + t('newReport')} onPress={() => setForm(true)} style={{ flex: 1 }} />
        {list.length > 0 && <Btn variant="ghost" title="Export CSV" onPress={exportCsv} />}
      </Row>
      {list.length > 0 && (
        <Row style={{ marginBottom: 12 }}>
          <Chip label="All" on={!filter} onPress={() => setFilter('')} />
          {[...new Set(list.map((x) => x.type))].map((c) => <Chip key={c} label={c} on={filter === c} onPress={() => setFilter(c)} />)}
        </Row>
      )}
      {!loading && shown.length === 0 && <Card><P style={{ marginBottom: 0 }}>No reports yet. Writing things down soon after they happen helps you remember details later.</P></Card>}
      {shown.map((rep) => (
        <Card key={rep.id}>
          <Text style={{ color: C.primary, fontWeight: '800' }}>{rep.type}</Text>
          <Text style={{ color: C.muted, marginBottom: 6 }}>{fmtDate(rep.incident_at)}{rep.place ? ' · ' + rep.place : ''}</Text>
          <Text style={{ color: C.ink, fontSize: 15, lineHeight: 22 }}>{rep.description}</Text>
          {rep.evidence ? <Text style={{ color: C.muted, marginTop: 6 }}>Evidence notes: {rep.evidence}</Text> : null}
          {rep.files.length > 0 && (
            <Row style={{ marginTop: 10 }}>
              {rep.files.map((f) => (
                <Pressable key={f.id} onLongPress={() => Alert.alert('Remove photo?', '', [{ text: t('cancel'), style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => delFile(rep, f) }])}>
                  <Image source={{ uri: `${API}/reports/${rep.id}/evidence/${f.id}`, headers: { Authorization: 'Bearer ' + currentToken() } }} style={{ width: 84, height: 84, borderRadius: 12, backgroundColor: C.soft }} />
                </Pressable>
              ))}
            </Row>
          )}
          {rep.files.length > 0 && <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>Press and hold a photo to remove it.</Text>}
          <Row style={{ marginTop: 12 }}>
            {rep.files.length < 3 && <Btn small variant="ghost" title="Add photo" onPress={() => addPhoto(rep)} />}
            <Btn small variant="ghost" title="Delete" onPress={() => del(rep)} />
          </Row>
        </Card>
      ))}
    </View>
  );
}

function NewReport({ cats, t, pickPhotos, upload, onDone }) {
  const [type, setType] = useState('');
  const [place, setPlace] = useState('');
  const [desc, setDesc] = useState('');
  const [ev, setEv] = useState('');
  const [when, setWhen] = useState(new Date());
  const [photos, setPhotos] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const pickWhen = () => {
    DateTimePickerAndroid.open({ value: when, mode: 'date', maximumDate: new Date(), onChange: (e, d) => {
      if (e.type !== 'set' || !d) return;
      DateTimePickerAndroid.open({ value: d, mode: 'time', onChange: (e2, d2) => { if (e2.type === 'set' && d2) setWhen(d2 > new Date() ? new Date() : d2); } });
    } });
  };

  const save = async () => {
    setErr('');
    if (!desc.trim()) return setErr('Please describe what happened.');
    setBusy(true);
    const r = await api('/reports', 'POST', { type: type || 'Other', place, description: desc, evidence: ev, incident_at: when.toISOString() });
    if (!r.ok) { setBusy(false); return setErr(errText(r)); }
    for (const a of photos) await upload(r.j.id, a);
    setBusy(false); onDone();
  };

  return (
    <View>
      <H>{t('newReport')}</H>
      <Text style={{ fontWeight: '700', color: C.ink, marginBottom: 8 }}>{t('category')}</Text>
      <Row style={{ marginBottom: 14 }}>{cats.map((c) => <Chip key={c} label={c} on={type === c} onPress={() => setType(c)} />)}</Row>
      <Text style={{ fontWeight: '700', color: C.ink, marginBottom: 6 }}>{t('when')}</Text>
      {Platform.OS === 'android'
        ? <Btn variant="ghost" title={when.toLocaleString()} onPress={pickWhen} style={{ marginBottom: 12, alignSelf: 'flex-start' }} />
        : <View style={{ alignSelf: 'flex-start', marginBottom: 12 }}><DateTimePicker value={when} mode="datetime" maximumDate={new Date()} onChange={(e, d) => d && setWhen(d)} /></View>}
      <Field label={t('place')} value={place} onChangeText={setPlace} />
      <Field label={t('whatHappened')} value={desc} onChangeText={setDesc} multiline style={{ minHeight: 120, textAlignVertical: 'top' }} />
      <Field label="Evidence notes (optional)" value={ev} onChangeText={setEv} placeholder="Messages, witnesses, vehicle number…" />
      <Row style={{ marginBottom: 12 }}>
        <Btn variant="ghost" small title={`Attach photos (${photos.length}/3)`} onPress={async () => setPhotos(await pickPhotos(3))} />
        {photos.map((a, i) => <Image key={i} source={{ uri: a.uri }} style={{ width: 44, height: 44, borderRadius: 8 }} />)}
      </Row>
      <Err>{err}</Err>
      <Row>
        <Btn title={t('save')} onPress={save} busy={busy} style={{ flex: 1 }} />
        <Btn variant="ghost" title={t('cancel')} onPress={onDone} />
      </Row>
    </View>
  );
}
