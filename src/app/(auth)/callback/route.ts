import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  if (error) {
    const loginUrl = new URL('/login', requestUrl.origin)
    loginUrl.searchParams.set('error', errorDescription || error)
    return NextResponse.redirect(loginUrl)
  }

  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      const loginUrl = new URL('/login', requestUrl.origin)
      loginUrl.searchParams.set('error', 'Verification link expired or already used. Please sign in or request a new link.')
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.redirect(new URL('/notes', requestUrl.origin))
  }

  return NextResponse.redirect(new URL('/login', requestUrl.origin))
}
