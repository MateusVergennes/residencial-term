export const runtime = 'nodejs'
export const revalidate = 0

import { NextResponse } from 'next/server'

export async function POST() {
    const res = NextResponse.json({ ok: true })
    res.cookies.set('adm_ok', '', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        expires: new Date(0)
    })
    return res
}