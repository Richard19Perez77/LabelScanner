/**
 * @format
 *
 * JS entry for the Android app. Metro loads this file; nothing from App.tsx
 * runs until AppRegistry has a component named in app.json ("LabelScanner").
 * That name must match MainActivity.getMainComponentName().
 */

// Tells React Native which root component to mount in MainActivity.
import { AppRegistry } from 'react-native';

// SafeAreaProvider + ScannerScreen / FixturesScreen switch.
import App from './App';

// app.json "name" is "LabelScanner" — the native side looks up that string.
import { name as appName } from './app.json';

// Writes a one-shot line to logcat tag Rick (and Metro) so startup order is visible.
import { startup } from './src/native/LabelScanner';

startup('index.js AppRegistry.registerComponent');

// Factory () => App: RN constructs <App /> when the activity is ready.
AppRegistry.registerComponent(appName, () => App);
