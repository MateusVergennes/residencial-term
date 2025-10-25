export const runtime = 'nodejs'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const templatePath = join(process.cwd(), 'data', 'template.json')
const historyPath = join(process.cwd(), 'data', 'history.json')

type Template = { title: string; body: string; signer1: string; signer2: string }
type Entry = Template & { id: string; ts: number }

function same(a: Template, b: Template) {
    return a.title === b.title && a.body === b.body && a.signer1 === b.signer1 && a.signer2 === b.signer2
}

export async function GET() {
    let tpl: Template | null = null
    try {
        const raw = await readFile(templatePath, 'utf-8')
        tpl = JSON.parse(raw)
    } catch { }

    let hist: Entry[] = []
    try {
        hist = JSON.parse(await readFile(historyPath, 'utf-8'))
    } catch { }

    const currentId = tpl ? hist.find(h => same(h, tpl))?.id ?? null : null
    const versions = hist.map(h => ({ id: h.id, ts: h.ts, title: h.title }))

    return NextResponse.json({ currentId, versions })
}