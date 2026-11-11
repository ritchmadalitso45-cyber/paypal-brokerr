import { useState, useEffect } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

/* ── useAuth ──────────────────────────────────────────────────────
   Wraps Firebase Auth + Firestore role storage.

   user shape: { uid, email, name, role: 'admin' | 'viewer' } | null
   loading: true while Firebase resolves the persisted session on mount
   ─────────────────────────────────────────────────────────────── */
export function useAuth() {
  const [user, setUser]       = useState(undefined) // undefined = still resolving
  const [loading, setLoading] = useState(true)

  /* Listen to Firebase auth state changes.
     Firebase automatically restores the session from IndexedDB on page load. */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const snap = await getDoc(doc(db, 'users', fbUser.uid))
          const role = snap.exists() ? snap.data().role : 'viewer'
          setUser({
            uid:   fbUser.uid,
            email: fbUser.email,
            name:  fbUser.displayName ?? snap.data()?.name ?? fbUser.email,
            role,
          })
        } catch {
          // Firestore unavailable — fall back to viewer with display name only
          setUser({
            uid:   fbUser.uid,
            email: fbUser.email,
            name:  fbUser.displayName ?? fbUser.email,
            role:  'viewer',
          })
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  /* Sign in with email + password */
  const signIn = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: friendlyError(err.code) }
    }
  }

  /* Create account, set display name, write role to Firestore */
  const signUp = async ({ firstName, lastName, email, password, role }) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)

      // Set the Firebase Auth display name
      await updateProfile(cred.user, {
        displayName: `${firstName.trim()} ${lastName.trim()}`,
      })

      // Persist role (and name) in Firestore — auth alone has no role field
      await setDoc(doc(db, 'users', cred.user.uid), {
        name:      `${firstName.trim()} ${lastName.trim()}`,
        email:     email.trim(),
        role,                              // 'admin' | 'viewer'
        createdAt: new Date().toISOString(),
      })

      return { ok: true }
    } catch (err) {
      return { ok: false, error: friendlyError(err.code) }
    }
  }

  /* Sign out — clears Firebase session and sets user to null via listener */
  const signOut = () => fbSignOut(auth)

  return { user, loading, signIn, signUp, signOut }
}

/* ── Human-readable Firebase error messages ──────────────────────── */
function friendlyError(code) {
  const map = {
    'auth/invalid-credential':     'Invalid email or password.',
    'auth/user-not-found':         'No account found with that email.',
    'auth/wrong-password':         'Incorrect password.',
    'auth/email-already-in-use':   'An account with that email already exists.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/too-many-requests':      'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/operation-not-allowed':  'Email/password sign-in is not enabled in Firebase.',
  }
  return map[code] ?? 'Something went wrong. Please try again.'
}
