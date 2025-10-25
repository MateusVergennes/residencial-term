'use client'

import React, { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'

type DownloadEntry = {
    id: string
    ts: number
    title: string
    body: string
    signer1: string
    signer2: string
}

const AdminPage = () => {
    const [auth, setAuth] = useState<boolean | null>(null)
    const [token, setToken] = useState('')
    const [error, setError] = useState<string | null>(null)

    const [downloads, setDownloads] = useState<DownloadEntry[]>([])
    const [selected, setSelected] = useState<DownloadEntry | null>(null)
    const [downloading, setDownloading] = useState(false)

    const checkAuth = async () => {
        setAuth(null)
        try {
            const r = await fetch('/api/admin/me', { cache: 'no-store' })
            const j = await r.json()
            setAuth(Boolean(j?.auth))
        } catch {
            setAuth(false)
        }
    }

    useEffect(() => {
        checkAuth()
    }, [])

    useEffect(() => {
        if (auth !== true) return
            ; (async () => {
                const r = await fetch('/api/downloads', { cache: 'no-store' })
                setDownloads(await r.json())
            })()
    }, [auth])

    const enter = async () => {
        setError(null)
        try {
            const r = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: token })
            })
            if (!r.ok) {
                setError('Código inválido')
                setAuth(false)
                return
            }
            setToken('')
            await checkAuth()
        } catch {
            setError('Falha ao entrar')
            setAuth(false)
        }
    }

    const logout = async () => {
        await fetch('/api/admin/logout', { method: 'POST' })
        setAuth(false)
        setSelected(null)
        setDownloads([])
    }

    const previewDoc = useMemo(() => {
        if (!selected) return null
        return (
            <div className="preview-doc">
                <div className="doc-title">{selected.title}</div>
                <div className="doc-body" style={{ whiteSpace: 'pre-wrap' }}>{selected.body}</div>
                <div className="doc-signatures">
                    <div className="sig">
                        <div className="sig-line"></div>
                        <div className="sig-content" style={{ whiteSpace: 'pre-wrap' }}>{selected.signer1}</div>
                        <div className="sig-label">Assinatura</div>
                    </div>
                    <div className="sig">
                        <div className="sig-line"></div>
                        <div className="sig-content" style={{ whiteSpace: 'pre-wrap' }}>{selected.signer2}</div>
                        <div className="sig-label">Assinatura</div>
                    </div>
                </div>
            </div>
        )
    }, [selected])

    const justifyParagraph = (doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
        const paragraphs = text.split(/\n{2,}/)
        let cursorY = y
        paragraphs.forEach((p, pi) => {
            const words = p.replace(/\n/g, ' ').split(/\s+/).filter(Boolean)
            if (words.length === 0) { cursorY += lineHeight; return }
            const lines: string[][] = []
            let current: string[] = []
            const spaceW = doc.getTextWidth(' ')
            words.forEach(w => {
                const test = [...current, w].join(' ')
                const wTest = doc.getTextWidth(test)
                if (wTest <= maxWidth || current.length === 0) current.push(w)
                else { lines.push(current); current = [w] }
            })
            if (current.length) lines.push(current)
            lines.forEach((lineWords, idx) => {
                const isLast = idx === lines.length - 1
                const raw = lineWords.join(' ')
                if (isLast || lineWords.length === 1) doc.text(raw, x, cursorY)
                else {
                    const textW = doc.getTextWidth(raw)
                    const gaps = lineWords.length - 1
                    const extra = maxWidth - textW
                    const extraPerGap = extra / gaps
                    let cursorX = x
                    lineWords.forEach((w, i) => {
                        doc.text(w, cursorX, cursorY)
                        if (i < gaps) {
                            const step = doc.getTextWidth(w) + spaceW + extraPerGap
                            cursorX += step
                        }
                    })
                }
                cursorY += lineHeight
            })
            if (pi < paragraphs.length - 1) cursorY += lineHeight * 0.5
        })
        return cursorY
    }

    const downloadFromHistory = async (entry: DownloadEntry) => {
        setDownloading(true)
        try {
            const doc = new jsPDF('p', 'mm', 'a4')
            const pageW = doc.internal.pageSize.getWidth()
            const pageH = doc.internal.pageSize.getHeight()
            const margin = 20
            const contentW = pageW - margin * 2
            let y = margin

            doc.setFont('times', 'bold')
            doc.setFontSize(14)
            doc.text(entry.title, pageW / 2, y, { align: 'center' })
            y += 10

            doc.setFont('times', 'normal')
            doc.setFontSize(12)
            const lineHeight = 6
            y = justifyParagraph(doc, entry.body, margin, y, contentW, lineHeight)

            const sigAreaTop = Math.max(y + 16, pageH - 60)
            const colW = contentW / 2

            const drawSignature = (leftX: number, signerText: string) => {
                const centerX = leftX + colW / 2
                const lineY = sigAreaTop
                doc.line(leftX + 8, lineY, leftX + colW - 8, lineY)
                doc.setFont('times', 'normal')
                doc.setFontSize(11)
                const signerLines = doc.splitTextToSize(signerText, colW - 16)
                let textY = lineY + 6
                signerLines.forEach((s: string | string[]) => { doc.text(s, centerX, textY, { align: 'center' }); textY += 5 })
                doc.setFontSize(10)
                doc.setTextColor(100)
                doc.text('Assinatura', centerX, textY + 2, { align: 'center' })
                doc.setTextColor(0)
            }

            drawSignature(margin, entry.signer1)
            drawSignature(margin + colW, entry.signer2)

            const filename = (entry.title || 'termo').toLowerCase().replace(/\s+/g, '_') + '.pdf'
            doc.save(filename)
        } finally {
            setDownloading(false)
        }
    }

    if (auth !== true) {
        return (
            <div className="container-max">
                <div className="card p-3" style={{ maxWidth: 520, margin: '48px auto' }}>
                    <h5 className="mb-3">Admin</h5>
                    <div className="d-flex gap-2">
                        <input
                            className="form-control"
                            placeholder="Código"
                            value={token}
                            onChange={e => setToken(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') enter() }}
                            disabled={auth === null}
                        />
                        <button className="btn btn-primary" onClick={enter} disabled={auth === null}>Entrar</button>
                    </div>
                    {error && <div className="text-danger mt-2">{error}</div>}
                </div>
            </div>
        )
    }

    return (
        <div className="container-max">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="m-0">Admin • Histórico de downloads</h5>
                <button className="btn btn-outline-secondary btn-sm" onClick={logout}>Sair</button>
            </div>

            <div className="row g-3">
                <div className="col-12 col-lg-7">
                    <div className="card p-3">
                        <div className="table-responsive">
                            <table className="table table-sm align-middle">
                                <thead>
                                    <tr>
                                        <th style={{ width: 180 }}>Data</th>
                                        <th>Título</th>
                                        <th style={{ width: 220 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {downloads.length === 0 && (
                                        <tr><td colSpan={3} className="text-muted">Sem registros</td></tr>
                                    )}
                                    {downloads.map(d => (
                                        <tr key={d.id}>
                                            <td>{new Date(d.ts).toLocaleString('pt-BR')}</td>
                                            <td>{d.title}</td>
                                            <td className="text-end">
                                                <button className="btn btn-outline-secondary btn-sm me-2" onClick={() => setSelected(d)}>Ver</button>
                                                <button className="btn btn-primary btn-sm" onClick={() => downloadFromHistory(d)} disabled={downloading}>
                                                    {downloading ? 'Gerando...' : 'Baixar PDF'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-lg-5">
                    <div className="card p-3">
                        <h6 className="mb-3">Pré-visualização</h6>
                        <div className="preview-box" style={{ minHeight: 200 }}>
                            {selected ? previewDoc : <div className="text-muted">Selecione um registro para visualizar</div>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AdminPage