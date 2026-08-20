import React, { useEffect, useMemo, useState } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import profile from './src/templates/pharma-label-v1.json';
import { startup } from './src/native/LabelScanner';
import { FixturesScreen } from './src/screens/FixturesScreen';
import { ScannerScreen } from './src/screens/ScannerScreen';
import type { TemplateProfile } from './src/types';

function App() {
  useEffect(() => {
    startup('App.tsx App() App.mount');
  }, []);
  const [screen, setScreen] = useState<'scanner' | 'fixtures'>('scanner');
  const template = profile as TemplateProfile;
  const templateJson = useMemo(() => JSON.stringify(template), [template]);

  return (
    <SafeAreaProvider style={styles.root}>
      <StatusBar barStyle="light-content" />
      {screen === 'scanner' ? (
        <ScannerScreen
          template={template}
          templateJson={templateJson}
          onOpenFixtures={() => setScreen('fixtures')}
        />
      ) : (
        <FixturesScreen
          template={template}
          templateJson={templateJson}
          onBack={() => setScreen('scanner')}
        />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#05070A',
  },
});

export default App;
