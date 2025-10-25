export const runtime = 'nodejs'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'

const CODE = '87875533'

export async function POST(req: NextRequest) {
    const { code } = await req.json().catch(() => ({ code: '' }))
    if (code !== CODE) return NextResponse.json({ ok: false }, { status: 401 })
    const res = NextResponse.json({ ok: true })
    res.cookies.set('adm_ok', '1', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 8
    })
    return res
}