import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import crypto from 'node:crypto'

const templatePath = join(process.cwd(), 'data', 'template.json')
const historyPath = join(process.cwd(), 'data', 'history.json')

type Template = { title: string; body: string; signer1: string; signer2: string }
type Entry = Template & { id: string; ts: number }

function same(a: Template, b: Template) {
    return a.title === b.title && a.body === b.body && a.signer1 === b.signer1 && a.signer2 === b.signer2
}

export async function GET() {
    try {
        const raw = await readFile(templatePath, 'utf-8')
        const tplFile = JSON.parse(raw) as Partial<Template>
        const tpl: Template = {
            title: tplFile.title ?? 'Termo de Mudança Condomínio Attuale',
            body: tplFile.body ?? '',
            signer1: tplFile.signer1 ?? '',
            signer2: tplFile.signer2 ?? ''
        }
        let hist: Entry[] = []
        try { hist = JSON.parse(await readFile(historyPath, 'utf-8')) } catch { }
        const current = hist.find(h => same(h, tpl))
        return NextResponse.json({ ...tpl, currentId: current?.id ?? null })
    } catch {
        return NextResponse.json({
            title: 'Termo de Mudança Condomínio Attuale',
            body: '',
            signer1: '',
            signer2: '',
            currentId: null
        }, { status: 200 })
    }
}

export async function PUT(req: NextRequest) {
    const payload = await req.json()
    const title = String(payload.title ?? 'Termo de Mudança Condomínio Attuale')
    const body = String(payload.body ?? '')
    const signer1 = String(payload.signer1 ?? '')
    const signer2 = String(payload.signer2 ?? '')
    const template: Template = { title, body, signer1, signer2 }

    await writeFile(templatePath, JSON.stringify(template, null, 2), 'utf-8')

    let history: Entry[] = []
    try { history = JSON.parse(await readFile(historyPath, 'utf-8')) } catch { }
    const entry: Entry = { id: crypto.randomUUID(), ts: Date.now(), ...template }
    history.unshift(entry)
    await writeFile(historyPath, JSON.stringify(history.slice(0, 200), null, 2), 'utf-8')

    return NextResponse.json({ ok: true, entry })
}