import React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/state/AppContext';
import { SosProvider } from './src/state/Sos'; // also registers the background-location task
import CalculatorScreen from './src/screens/CalculatorScreen';
import AuthScreen from './src/screens/AuthScreen';
import MainScreen from './src/screens/MainScreen';

function Root() {
  const { ready, locked, user } = useApp();
  if (!ready) return <View style={{ flex: 1, backgroundColor: '#000' }} />; // plain screen while loading, reveals nothing
  if (locked) return <CalculatorScreen />;
  if (!user) return <AuthScreen />;
  return <MainScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <SosProvider>
          <Root />
        </SosProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
