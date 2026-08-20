// useState: which screen is showing. useMemo: stringify the template once.
// useEffect: one log after first paint (Rick tag via startup()).
import React, { useEffect, useMemo, useState } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
// Pads for notch / home indicator. Native scanner view sits under this provider.
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Label contract: lot/expiry anchors, regex, EAN-13, duplicate window.
import profile from './src/templates/pharma-label-v1.json';
import { startup } from './src/native/LabelScanner';
import { FixturesScreen } from './src/screens/FixturesScreen';
import { ScannerScreen } from './src/screens/ScannerScreen';
import type { TemplateProfile } from './src/types';

// used in index.js: AppRegistry.registerComponent('LabelScanner', () => App);
function App() {
  // Runs once after mount. Does not re-run when switching scanner ↔ fixtures.
  useEffect(() => {
    startup('App.tsx App() App.mount');
  }, []);

  // Tiny in-app router. No React Navigation — two screens is enough for a review app.
  const [screen, setScreen] = useState<'scanner' | 'fixtures'>('scanner');
  const template = profile as TemplateProfile;
  // Kotlin wants a JSON string prop; JS also keeps the parsed object for field labels.
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
