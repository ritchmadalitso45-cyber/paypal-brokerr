import { auth } from '../firebase'
import { createApi } from './api'
export const api = createApi({ baseUrl: import.meta.env.VITE_API_BASE_URL || '', getToken: refresh => auth.currentUser?.getIdToken(refresh) })
