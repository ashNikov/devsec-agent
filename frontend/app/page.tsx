'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const auth = params.get('auth')

    if (token && auth === 'success') {
      localStorage.setItem('agentsec_token', token)
      router.push('/dashboard')
    } else {
      router.push('/login')
    }
  }, [router])

  return null
}
