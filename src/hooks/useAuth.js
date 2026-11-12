import { useEffect, useState } from 'react'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onIdTokenChanged, updateProfile, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth'
import { auth, firebaseApp } from '../firebase'
import { api } from '../lib/client'

export function useAuth() {
  const [state, setState] = useState({ user: null, loading: true, error: '' })
  useEffect(() => {
    let version = 0
    const unsubscribe = onIdTokenChanged(auth, async user => {
      const current = ++version
      if (!user) { setState({ user: null, loading: false, error: '' }); return }
      try {
        const session = await api('/session')
        if (current === version) setState({ user: { ...session, name: user.displayName || user.email }, loading: false, error: '' })
      } catch (error) {
        if (current === version) setState({ user: { uid: user.uid, name: user.displayName || user.email, role: null }, loading: false, error: error.message })
      }
    })
    return () => { version++; unsubscribe() }
  }, [])
  return {
    ...state,
    signIn: (email, password) => signInWithEmailAndPassword(auth, email.trim(), password),
    signUp: async ({ firstName, lastName, email, password }) => {
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password)
      const name = `${firstName.trim()} ${lastName.trim()}`
      await updateProfile(user, { displayName: name }); await sendEmailVerification(user)
      // Metadata never authorizes financial access. No self-selected admin roles.
      try {
        const { getFirestore, doc, setDoc } = await import('firebase/firestore')
        await setDoc(doc(getFirestore(firebaseApp), 'users', user.uid), { name, email: user.email, role: 'viewer', createdAt: new Date().toISOString() })
      } catch { /* Existing console rules may differ; claims control access. */ }
    },
    signOut: () => signOut(auth),
    verifyEmail: () => sendEmailVerification(auth.currentUser),
    refresh: async () => { await auth.currentUser.reload(); await auth.currentUser.getIdToken(true) },
    resetPassword: email => sendPasswordResetEmail(auth, email.trim()),
  }
}
