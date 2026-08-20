/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { startup } from './src/native/LabelScanner';

startup('index.js AppRegistry.registerComponent');
AppRegistry.registerComponent(appName, () => App);
