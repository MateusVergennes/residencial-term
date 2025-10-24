import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const historyPath = join(process.cwd(), 'data', 'history.json')

export async function GET() {
    try {
        const raw = await readFile(historyPath, 'utf-8')
        const data = JSON.parse(raw)
        return NextResponse.json(data)
    } catch {
        return NextResponse.json([])
    }
}