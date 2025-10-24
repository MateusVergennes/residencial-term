import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const historyPath = join(process.cwd(), 'data', 'history.json')

export async function POST(req: NextRequest) {
    const { id } = await req.json()
    let history: any[] = []
    try { history = JSON.parse(await readFile(historyPath, 'utf-8')) } catch { }
    const before = history.length
    history = history.filter(h => h.id !== id)
    if (history.length === before) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    await writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8')
    return NextResponse.json({ ok: true })
}