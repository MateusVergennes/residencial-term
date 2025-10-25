import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const templatePath = join(process.cwd(), 'data', 'template.json')
const historyPath = join(process.cwd(), 'data', 'history.json')

export async function POST(req: NextRequest) {
    const { id } = await req.json()
    const history = JSON.parse(await readFile(historyPath, 'utf-8'))
    const entry = history.find((h: any) => h.id === id)
    if (!entry) return NextResponse.json({ ok: false }, { status: 404 })

    const template = { title: entry.title, body: entry.body, signer1: entry.signer1, signer2: entry.signer2 }
    await writeFile(templatePath, JSON.stringify(template, null, 2), 'utf-8')

    return NextResponse.json({ ok: true, entry })
}