import {configuration} from './firebase-config.js';
export function authMessage(error) {
  const code=error?.code||'';
  if(['auth/popup-closed-by-user','auth/cancelled-popup-request'].includes(code))return 'Sign-in cancelled. You can continue as a guest.';
  const messages={
    'auth/account-exists-with-different-credential':'This email uses another sign-in provider. Sign in using the method you originally used.',
    'auth/email-already-in-use':'An account already uses this email. Sign in or reset your password.',
    'auth/invalid-credential':'Email or password was not accepted. Try again or reset your password.',
    'auth/weak-password':'Choose a password with at least 8 characters.',
    'auth/invalid-email':'Enter a valid email address.',
    'auth/popup-blocked':'Your browser blocked Google sign-in. Allow popups for Questlog and try again.',
    'auth/unauthorized-domain':'This domain needs to be added to Firebase Authentication authorized domains.',
    'auth/operation-not-allowed':'Enable this sign-in provider in the Firebase console.',
    'auth/network-request-failed':'Unable to connect. Your local characters are still available.',
    'auth/too-many-requests':'Too many attempts. Wait a moment and try again.'
  };
  return messages[code]||error?.message||'Account service unavailable. Guest play is still available.';
}
export async function createFirebaseClient({onUser=()=>{}}={}) {
  const config=configuration();
  if(!config?.apiKey||!config?.projectId||!config?.appId)return null;
  const sdk=await import('./firebase-sdk/firebase.js');
  const app=sdk.initializeApp(config),auth=sdk.getAuth(app),db=sdk.getFirestore(app);
  const emulators=globalThis.QUESTLOG_FIREBASE_EMULATORS;
  // Emulator overrides cannot redirect production traffic from a remote host.
  if(emulators&&['localhost','127.0.0.1','[::1]'].includes(location.hostname)){
    sdk.connectAuthEmulator(auth,`http://${emulators.host||'127.0.0.1'}:${emulators.auth||9099}`,{disableWarnings:true});
    sdk.connectFirestoreEmulator(db,emulators.host||'127.0.0.1',emulators.firestore||8080);
  }
  await sdk.setPersistence(auth,sdk.browserLocalPersistence);
  return {sdk,auth,db,watch:callback=>sdk.onAuthStateChanged(auth,callback),
    async signup(email,password){const result=await sdk.createUserWithEmailAndPassword(auth,email,password);await sdk.sendEmailVerification(result.user);return result;},
    signin:(email,password)=>sdk.signInWithEmailAndPassword(auth,email,password),
    google:()=>sdk.signInWithPopup(auth,new sdk.GoogleAuthProvider()),
    reset:email=>sdk.sendPasswordResetEmail(auth,email),
    verify:()=>sdk.sendEmailVerification(auth.currentUser),
    signout:()=>sdk.signOut(auth)
  };
}
