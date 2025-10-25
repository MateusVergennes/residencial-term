export const runtime = 'nodejs'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const historyPath = join(process.cwd(), 'data', 'history.json')

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await ctx.params
        const decoded = decodeURIComponent(id)
        const raw = await readFile(historyPath, 'utf-8')
        const list = JSON.parse(raw) as any[]
        const entry = list.find(x => String(x.id) === decoded)
        if (!entry) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
        return NextResponse.json(entry)
    } catch {
        return NextResponse.json({ ok: false, error: 'read_error' }, { status: 404 })
    }
}