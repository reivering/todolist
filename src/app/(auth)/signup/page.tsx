'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { FileText, CheckSquare, Mail } from 'lucide-react'

export default function SignupPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/callback`,
      },
    })
    if (error) {
      toast.error(error.message)
      setLoading(false)
    } else {
      setEmailSent(true)
    }
  }

  async function handleResend() {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/callback` },
    })
    if (error) toast.error(error.message)
    else toast.success('Verification email resent!')
    setLoading(false)
  }

  if (emailSent) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6 sm:p-8 text-center">
            <div className="w-14 h-14 bg-violet-600/20 rounded-full flex items-center justify-center mx-auto mb-5">
              <Mail size={28} className="text-violet-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-100 mb-2">Check your email</h2>
            <p className="text-slate-400 text-sm mb-1">
              We sent a verification link to
            </p>
            <p className="text-slate-200 font-medium text-sm mb-6">{email}</p>
            <p className="text-slate-500 text-xs mb-6">
              Click the link in the email to verify your account and get started.
            </p>
            <button
              onClick={handleResend}
              disabled={loading}
              className="text-sm text-violet-400 hover:text-violet-300 disabled:opacity-50"
            >
              {loading ? 'Sending…' : "Didn't get it? Resend"}
            </button>
            <div className="mt-6 pt-4 border-t border-slate-800">
              <Link href="/login" className="text-sm text-slate-400 hover:text-slate-300">
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="flex items-center gap-1.5 bg-violet-600 text-white px-3 py-2 rounded-lg">
              <FileText size={18} />
              <CheckSquare size={18} />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-2">Welcome to toodoloo</h1>
          <p className="text-slate-400 text-sm sm:text-base">Create an account to start capturing notes and managing todos</p>
        </div>

        <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                placeholder="Your name"
                className="w-full px-4 py-3 rounded-lg border border-slate-700 bg-slate-800 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-lg border border-slate-700 bg-slate-800 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Min. 6 characters"
                className="w-full px-4 py-3 rounded-lg border border-slate-700 bg-slate-800 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder:text-slate-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed mt-4 active:scale-95 transition-transform"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
          <p className="text-center text-sm text-slate-400 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-violet-400 font-medium hover:text-violet-300">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
