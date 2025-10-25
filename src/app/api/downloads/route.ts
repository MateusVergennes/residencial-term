import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import crypto from 'node:crypto'

const downloadsPath = join(process.cwd(), 'data', 'downloads.json')

type ResolvedDoc = { title: string; body: string; signer1: string; signer2: string }
type DownloadEntry = ResolvedDoc & { id: string; ts: number }

export async function GET() {
    try {
        const raw = await readFile(downloadsPath, 'utf-8')
        const data = JSON.parse(raw) as DownloadEntry[]
        return NextResponse.json(data)
    } catch {
        return NextResponse.json([])
    }
}

export async function POST(req: NextRequest) {
    const payload = (await req.json()) as ResolvedDoc
    let list: DownloadEntry[] = []
    try { list = JSON.parse(await readFile(downloadsPath, 'utf-8')) } catch { }
    const entry: DownloadEntry = { id: crypto.randomUUID(), ts: Date.now(), ...payload }
    list.unshift(entry)
    await writeFile(downloadsPath, JSON.stringify(list.slice(0, 1000), null, 2), 'utf-8')
    return NextResponse.json({ ok: true, entry })
}