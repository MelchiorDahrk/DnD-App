// Public web application identifiers, not administrative credentials.
// Set window.QUESTLOG_FIREBASE_CONFIG = null before app.js to use guest mode only.
export const firebaseConfig = {
  apiKey: 'AIzaSyAWCACnoL8taFaCMPeJlCWmypa18ZQ5F88',
  authDomain: 'questlog-3d16b.firebaseapp.com',
  projectId: 'questlog-3d16b',
  storageBucket: 'questlog-3d16b.firebasestorage.app',
  messagingSenderId: '668814983796',
  appId: '1:668814983796:web:776ecb16410ecf011f8721'
};
export function configuration(scope=globalThis) {
  return Object.hasOwn(scope,'QUESTLOG_FIREBASE_CONFIG') ? scope.QUESTLOG_FIREBASE_CONFIG : firebaseConfig;
}
