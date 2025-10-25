export const runtime = 'nodejs'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
    const c = (await cookies()).get('adm_ok')?.value
    const auth = c === '1'
    return NextResponse.json({ auth })
}