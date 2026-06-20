import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification,
  updatePassword, updateEmail, reauthenticateWithCredential, EmailAuthProvider,
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import {
  getFirestore, collection, doc, addDoc, getDoc, getDocs, setDoc, deleteDoc,
  query, where, orderBy, limit, Timestamp, serverTimestamp, runTransaction,
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDsJaCSscmDLyNhdCCaEPDVnV6cNDMgoOM',
  authDomain: 'practice-scripts-hannogeo.firebaseapp.com',
  projectId: 'practice-scripts-hannogeo',
  storageBucket: 'practice-scripts-hannogeo.firebasestorage.app',
  messagingSenderId: '217379778473',
  appId: '1:217379778473:web:e9bc774ec6a3c272c39eb8',
  measurementId: 'G-BJGNY8YJ30',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ─── Auth helpers ───

async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

async function signUpWithEmail(email, password) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(result.user);
  return result.user;
}

async function logInWithEmail(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

async function signOutUser() {
  await signOut(auth);
}

// ─── Profile helpers ───

async function createProfile(uid, data) {
  await setDoc(doc(db, 'users', uid), {
    ...data,
    createdAt: serverTimestamp(),
    lastUsernameChange: null,
    isAdmin: false,
  });
}

async function getProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

async function claimUsername(username, uid) {
  await setDoc(doc(db, 'usernames', username.toLowerCase()), { uid });
}

async function checkUsernameAvailable(username) {
  try {
    const snap = await getDoc(doc(db, 'usernames', username.toLowerCase()));
    return !snap.exists();
  } catch (e) {
    return true;
  }
}

async function updateUsername(uid, newUsername) {
  const profile = await getProfile(uid);
  await setDoc(doc(db, 'usernames', newUsername.toLowerCase()), { uid });
  if (profile?.username) {
    await deleteDoc(doc(db, 'usernames', profile.username.toLowerCase()));
  }
  await setDoc(doc(db, 'users', uid), { username: newUsername, lastUsernameChange: serverTimestamp() }, { merge: true });
}

async function changeEmail(uid, newEmail) {
  const user = auth.currentUser;
  if (user) {
    await updateEmail(user, newEmail);
    await setDoc(doc(db, 'users', uid), { email: newEmail }, { merge: true });
    await sendEmailVerification(user);
  }
}

async function changePassword(user, newPassword) {
  await updatePassword(user, newPassword);
}

// ─── Report helpers ───

async function addReport(data) {
  await addDoc(collection(db, 'reports'), {
    ...data,
    createdAt: serverTimestamp(),
    status: 'pending',
  });
}

async function getReports(status = null) {
  let q = query(collection(db, 'reports'));
  if (status) q = query(q, where('status', '==', status));
  const snap = await getDocs(q);
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => {
    const ta = a.createdAt?.toDate?.()?.getTime() || 0;
    const tb = b.createdAt?.toDate?.()?.getTime() || 0;
    return tb - ta;
  });
  return list;
}

async function resolveReport(reportId) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  await setDoc(doc(db, 'reports', reportId), {
    status: 'resolved',
    resolvedAt: serverTimestamp(),
    resolvedBy: user.uid,
  }, { merge: true });
}

async function deleteReport(reportId) {
  await deleteDoc(doc(db, 'reports', reportId));
}

// ─── Exports ───

export {
  auth, db, googleProvider,
  signInWithGoogle, signUpWithEmail, logInWithEmail, signOutUser,
  onAuthStateChanged, sendEmailVerification,
  updatePassword, updateEmail, reauthenticateWithCredential, EmailAuthProvider,
  createProfile, getProfile, claimUsername, checkUsernameAvailable,
  updateUsername, changeEmail, changePassword,
  addReport, getReports, resolveReport, deleteReport,
  collection, doc, addDoc, getDoc, getDocs, setDoc, deleteDoc,
  query, where, orderBy, limit, Timestamp, serverTimestamp,
};
