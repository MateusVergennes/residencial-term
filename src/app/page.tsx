'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import jsPDF from 'jspdf'
import { Modal, Accordion, Button } from 'react-bootstrap'

type Template = { title: string; body: string; signer1: string; signer2: string; currentId?: string | null }
type Entry = Template & { id: string; ts: number }
type VersionLite = { id: string; ts: number; title: string }

const Page = () => {
  const [activeTab, setActiveTab] = useState<'campos' | 'termo'>('campos')

  const [currentTpl, setCurrentTpl] = useState<Template | null>(null)
  const [editorTpl, setEditorTpl] = useState<Template | null>(null)

  const [versions, setVersions] = useState<VersionLite[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null)

  const [loadingTpl, setLoadingTpl] = useState(false)
  const [savingTpl, setSavingTpl] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const [varsState, setVarsState] = useState<Record<string, string>>({})
  const previewRefCampos = useRef<HTMLDivElement>(null)

  const [showModal, setShowModal] = useState(false)
  const [versionsOpen, setVersionsOpen] = useState(true)

  const loadCurrentTemplate = async () => {
    setLoadingTpl(true)
    try {
      const r = await fetch('/api/template', { cache: 'no-store' })
      const data = await r.json()
      setCurrentTpl(data)
      if (!previewVersionId) setEditorTpl(data)
    } finally {
      setLoadingTpl(false)
    }
  }

  const loadVersions = async () => {
    const v = await fetch('/api/versions', { cache: 'no-store' })
    const vjson = await v.json()
    setVersions(vjson.versions || [])
    setCurrentId(vjson.currentId ?? null)
  }

  useEffect(() => {
    ; (async () => {
      await loadCurrentTemplate()
      await loadVersions()
    })()
  }, [])

  useEffect(() => {
    if (activeTab === 'termo') {
      ; (async () => {
        await loadVersions()
        if (!previewVersionId) await loadCurrentTemplate()
      })()
    }
  }, [activeTab, previewVersionId])

  const parseAllPlaceholders = (t?: Template) => {
    if (!t) return { order: [] as string[], defaults: {} as Record<string, string> }
    const texts = [t.title, t.body, t.signer1, t.signer2].join(' ')
    const rx = /\{\{([^}]+)\}\}/g
    const firstIndex = new Map<string, number>()
    const defaults: Record<string, string> = {}
    let m
    while ((m = rx.exec(texts))) {
      const raw = m[1]
      const [nameRaw, fallbackRaw] = raw.split('|')
      const key = nameRaw.trim()
      if (!firstIndex.has(key)) firstIndex.set(key, m.index)
      if (fallbackRaw !== undefined && defaults[key] === undefined) defaults[key] = fallbackRaw.trim()
    }
    const order = Array.from(firstIndex.entries()).sort((a, b) => a[1] - b[1]).map(([k]) => k)
    return { order, defaults }
  }

  const { order: allVars, defaults: defaultsMap } = useMemo(() => parseAllPlaceholders(currentTpl ?? undefined), [currentTpl])

  useEffect(() => {
    if (!allVars.length) return
    setVarsState(p => {
      const next = { ...p }
      allVars.forEach(v => { if (next[v] === undefined || next[v] === '') next[v] = defaultsMap[v] ?? '' })
      return next
    })
  }, [allVars, defaultsMap])

  const formatCPF = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 11)
    const p1 = digits.slice(0, 3)
    const p2 = digits.slice(3, 6)
    const p3 = digits.slice(6, 9)
    const p4 = digits.slice(9, 11)
    if (digits.length <= 3) return p1
    if (digits.length <= 6) return `${p1}.${p2}`
    if (digits.length <= 9) return `${p1}.${p2}.${p3}`
    return `${p1}.${p2}.${p3}-${p4}`
  }

  const visibleValue = (name: string, fallback?: string) => {
    const val = varsState[name] ?? ''
    if (val) return name.toLowerCase().includes('cpf') ? formatCPF(val) : val
    if (fallback) return fallback
    return ''
  }

  const renderTemplateInline = (text: string) => {
    const parts: React.ReactNode[] = []
    const rx = /\{\{([^}]+)\}\}/g
    let lastIndex = 0
    let m
    while ((m = rx.exec(text))) {
      const before = text.slice(lastIndex, m.index)
      if (before) parts.push(before)
      const raw = m[1]
      const [name, fallback] = raw.split('|')
      const key = name.trim()
      const val = visibleValue(key, fallback)
      parts.push(val ? val : <span key={m.index} className="placeholder-var">{`{${key}}`}</span>)
      lastIndex = rx.lastIndex
    }
    const after = text.slice(lastIndex)
    if (after) parts.push(after)
    return parts
  }

  const renderTextForPdf = (text: string) =>
    text.replace(/\{\{([^}]+)\}\}/g, (_, inside) => {
      const [name, fallback] = String(inside).split('|')
      const key = name.trim()
      const val = visibleValue(key, fallback)
      return val || `{${key}}`
    })

  const cleanSignerText = (s: string) => s.split('\n').filter(l => l.trim().toLowerCase() !== 'assinatura').join('\n')

  const justifyParagraph = (doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineH: number) => {
    const paragraphs = text.split(/\n{2,}/)
    let cy = y
    paragraphs.forEach((p, pi) => {
      const words = p.replace(/\n/g, ' ').split(/\s+/).filter(Boolean)
      if (words.length === 0) { cy += lineH; return }
      const lines: string[][] = []
      let cur: string[] = []
      const spW = doc.getTextWidth(' ')
      words.forEach(w => {
        const test = [...cur, w].join(' ')
        const wTest = doc.getTextWidth(test)
        if (wTest <= maxWidth || cur.length === 0) cur.push(w)
        else { lines.push(cur); cur = [w] }
      })
      if (cur.length) lines.push(cur)
      lines.forEach((lw, idx) => {
        const last = idx === lines.length - 1
        const raw = lw.join(' ')
        if (last || lw.length === 1) doc.text(raw, x, cy)
        else {
          const textW = doc.getTextWidth(raw)
          const gaps = lw.length - 1
          const extra = maxWidth - textW
          const extraGap = extra / gaps
          let cx = x
          lw.forEach((w, i) => {
            doc.text(w, cx, cy)
            if (i < gaps) { cx += doc.getTextWidth(w) + spW + extraGap }
          })
        }
        cy += lineH
      })
      if (pi < paragraphs.length - 1) cy += lineH * 0.5
    })
    return cy
  }

  const downloadPDF = async () => {
    if (!currentTpl) return
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
      const titleStr = renderTextForPdf(currentTpl.title)
      doc.text(titleStr, pageW / 2, y, { align: 'center' })
      y += 10

      doc.setFont('times', 'normal')
      doc.setFontSize(12)
      const bodyStr = renderTextForPdf(currentTpl.body)
      const lineHeight = 6
      y = justifyParagraph(doc, bodyStr, margin, y, contentW, lineHeight)

      const sigTop = Math.max(y + 16, pageH - 60)
      const colW = contentW / 2

      const drawSig = (leftX: number, s: string) => {
        const cx = leftX + colW / 2
        const lineY = sigTop
        doc.line(leftX + 8, lineY, leftX + colW - 8, lineY)
        doc.setFont('times', 'normal')
        doc.setFontSize(11)
        const cleaned = cleanSignerText(s)
        const lines = doc.splitTextToSize(renderTextForPdf(cleaned), colW - 16)
        let ty = lineY + 6
        lines.forEach((t: string | string[]) => { doc.text(t, cx, ty, { align: 'center' }); ty += 5 })
        doc.setFontSize(10)
        doc.setTextColor(100)
        doc.text('Assinatura', cx, ty + 2, { align: 'center' })
        doc.setTextColor(0)
      }

      drawSig(margin, currentTpl.signer1)
      drawSig(margin + colW, currentTpl.signer2)

      const resolved = {
        title: titleStr,
        body: bodyStr,
        signer1: renderTextForPdf(cleanSignerText(currentTpl.signer1)),
        signer2: renderTextForPdf(cleanSignerText(currentTpl.signer2))
      }
      await fetch('/api/downloads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(resolved) })

      const filename = (currentTpl.title || 'termo').toLowerCase().replace(/\s+/g, '_') + '.pdf'
      doc.save(filename)
    } finally { setDownloading(false) }
  }

  const saveTemplate = async () => {
    if (!editorTpl) return
    setSavingTpl(true)
    try {
      await fetch('/api/template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editorTpl.title,
          body: editorTpl.body,
          signer1: editorTpl.signer1,
          signer2: editorTpl.signer2
        })
      })
      await loadVersions()
      await loadCurrentTemplate()
      setPreviewVersionId(null)
      setEditorTpl(null)
    } finally { setSavingTpl(false) }
  }

  const selectVersion = async (id: string) => {
    const r = await fetch(`/api/versions/${encodeURIComponent(id)}`, { cache: 'no-store' })
    if (!r.ok) return
    const e = await r.json() as Entry
    setEditorTpl({ title: e.title, body: e.body, signer1: e.signer1, signer2: e.signer2 })
    setPreviewVersionId(id)
    if (activeTab !== 'termo') setActiveTab('termo')
  }

  const restoreVersion = async (id: string) => {
    await fetch('/api/history/revert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await loadVersions()
    await loadCurrentTemplate()
    const r = await fetch(`/api/versions/${encodeURIComponent(id)}`, { cache: 'no-store' })
    if (r.ok) {
      const e = await r.json() as Entry
      setEditorTpl({ title: e.title, body: e.body, signer1: e.signer1, signer2: e.signer2 })
    } else {
      setEditorTpl(currentTpl)
    }
    setPreviewVersionId(null)
    if (activeTab !== 'termo') setActiveTab('termo')
  }

  const deleteVersion = async (id: string) => {
    await fetch('/api/history/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await loadVersions()
    if (previewVersionId === id) {
      await loadCurrentTemplate()
      setPreviewVersionId(null)
      setEditorTpl(currentTpl)
    }
  }

  const previewDocCampos = useMemo(() => {
    if (!currentTpl) return null
    return (
      <div className="preview-doc" ref={previewRefCampos}>
        <div className="doc-title">{renderTemplateInline(currentTpl.title)}</div>
        <div className="doc-body">{renderTemplateInline(currentTpl.body)}</div>
        <div className="doc-signatures">
          <div className="sig">
            <div className="sig-line"></div>
            <div className="sig-content">{renderTemplateInline(cleanSignerText(currentTpl.signer1))}</div>
            <div className="sig-label">Assinatura</div>
          </div>
          <div className="sig">
            <div className="sig-line"></div>
            <div className="sig-content">{renderTemplateInline(cleanSignerText(currentTpl.signer2))}</div>
            <div className="sig-label">Assinatura</div>
          </div>
        </div>
      </div>
    )
  }, [currentTpl, varsState])

  const previewDocEditor = useMemo(() => {
    if (!editorTpl) return null
    const rx = /\{\{([^}]+)\}\}/g
    const renderInline = (t: string) =>
      t.replace(rx, (_, inside) => {
        const [name, fallback] = String(inside).split('|')
        const key = name.trim()
        return varsState[key] || fallback || `{${key}}`
      })
    return (
      <div className="preview-doc">
        <div className="doc-title">{renderInline(editorTpl.title)}</div>
        <div className="doc-body" style={{ whiteSpace: 'pre-wrap' }}>{renderInline(editorTpl.body)}</div>
        <div className="doc-signatures">
          <div className="sig">
            <div className="sig-line"></div>
            <div className="sig-content" style={{ whiteSpace: 'pre-wrap' }}>{renderInline(cleanSignerText(editorTpl.signer1))}</div>
            <div className="sig-label">Assinatura</div>
          </div>
          <div className="sig">
            <div className="sig-line"></div>
            <div className="sig-content" style={{ whiteSpace: 'pre-wrap' }}>{renderInline(cleanSignerText(editorTpl.signer2))}</div>
            <div className="sig-label">Assinatura</div>
          </div>
        </div>
      </div>
    )
  }, [editorTpl, varsState])

  return (
    <div className="container-max">
      <div className="card shadow-sm p-3 mb-3">
        <div className="d-flex justify-content-between align-items-center">
          <ul className="nav nav-tabs">
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'campos' ? 'active' : ''}`} onClick={() => setActiveTab('campos')}>
                Campos
              </button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'termo' ? 'active' : ''}`} onClick={() => setActiveTab('termo')}>
                Termo
              </button>
            </li>
          </ul>
          <div className="header-actions">
            {activeTab === 'campos' && (
              <>
                <Button variant="outline-secondary" size="sm" className="mobile-only" title="Pré-visualização" onClick={() => setShowModal(true)}>
                  🔍
                </Button>
                <Button variant="primary" size="sm" className="desktop-only" onClick={downloadPDF} disabled={downloading || !currentTpl}>
                  {downloading ? 'Gerando...' : 'Baixar PDF'}
                </Button>
              </>
            )}
            {activeTab === 'termo' && (
              <>
                <Button variant="outline-secondary" size="sm" className="mobile-only" title="Pré-visualização" onClick={() => setShowModal(true)}>
                  🔍
                </Button>
                <Button variant="success" size="sm" className="desktop-only" onClick={saveTemplate} disabled={savingTpl || !editorTpl}>
                  {savingTpl ? 'Salvando...' : 'Salvar versão'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'campos' && (
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <div className="card p-3">
              <h5 className="mb-3">Preenchimento</h5>
              {loadingTpl && <div className="text-muted">Carregando...</div>}
              {!loadingTpl && currentTpl && (
                <div className="row g-3">
                  {allVars.map(v => (
                    <div key={v} className="col-12">
                      <label className="form-label text-muted">{v}</label>
                      <input
                        className="form-control"
                        value={varsState[v] ?? ''}
                        onChange={e => setVarsState(p => ({ ...p, [v]: e.target.value }))}
                        inputMode={v.toLowerCase().includes('cpf') ? 'numeric' : 'text'}
                        placeholder={v}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="col-12 col-md-6 desktop-only">
            <div className="card p-3 sticky-top-md">
              <h5 className="mb-3">Pré-visualização</h5>
              <div className="preview-box">{previewDocCampos}</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'termo' && (
        <div className="row g-3">
          <div className="col-12 col-lg-8">
            <div className="card p-3">
              <h5 className="mb-3">Edição do termo</h5>
              {editorTpl && (
                <form className="row g-3">
                  <div className="col-12">
                    <label className="form-label">Título</label>
                    <input className="form-control" value={editorTpl.title} onChange={e => setEditorTpl({ ...editorTpl, title: e.target.value })} />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Corpo</label>
                    <textarea className="form-control" rows={8} value={editorTpl.body} onChange={e => setEditorTpl({ ...editorTpl, body: e.target.value })} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Assinante 1</label>
                    <textarea className="form-control" rows={4} value={editorTpl.signer1} onChange={e => setEditorTpl({ ...editorTpl, signer1: e.target.value })} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Assinante 2</label>
                    <textarea className="form-control" rows={4} value={editorTpl.signer2} onChange={e => setEditorTpl({ ...editorTpl, signer2: e.target.value })} />
                  </div>
                </form>
              )}
            </div>

            <div className="card p-3 mt-3 desktop-only">
              <h5 className="mb-3">Pré-visualização</h5>
              <div className="preview-box">{previewDocEditor}</div>
            </div>
          </div>

          <div className="col-12 col-lg-4">
            <Accordion activeKey={versionsOpen ? '0' : undefined} onSelect={() => setVersionsOpen(v => !v)}>
              <Accordion.Item eventKey="0">
                <Accordion.Header>Versões</Accordion.Header>
                <Accordion.Body>
                  {versions.length === 0 && <div className="text-muted">Sem versões ainda</div>}
                  {versions.map(v => {
                    const isCurrent = currentId === v.id
                    const isPreview = previewVersionId === v.id
                    return (
                      <div
                        key={v.id}
                        role="button"
                        onClick={() => selectVersion(v.id)}
                        className={`border rounded p-2 mb-2 ${isCurrent ? 'history-selected' : ''} ${isPreview ? 'border border-primary' : ''}`}
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <strong className="me-2">{v.title}</strong>
                          <div className="d-flex align-items-center gap-2">
                            {isCurrent && <span className="badge badge-selected">selecionada</span>}
                            <small className="text-muted">{new Date(v.ts).toLocaleString('pt-BR')}</small>
                          </div>
                        </div>
                        <div className="mt-2 d-flex gap-2">
                          {!isCurrent && (
                            <>
                              <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); restoreVersion(v.id) }}
                              >
                                Restaurar
                              </Button>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); deleteVersion(v.id) }}
                              >
                                Excluir
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </Accordion.Body>
              </Accordion.Item>
            </Accordion>
          </div>
        </div>
      )}

      <Modal show={showModal} onHide={() => setShowModal(false)} fullscreen="sm-down" size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Pré-visualização</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="preview-box">{activeTab === 'campos' ? previewDocCampos : previewDocEditor}</div>
        </Modal.Body>
        <Modal.Footer>
          {activeTab === 'termo' && (
            <Button variant="success" onClick={saveTemplate} disabled={savingTpl || !editorTpl}>
              {savingTpl ? 'Salvando...' : 'Salvar versão'}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setShowModal(false)}>Fechar</Button>
          {activeTab === 'campos' && (
            <Button variant="primary" onClick={downloadPDF} disabled={downloading || !currentTpl}>
              {downloading ? 'Gerando...' : 'Baixar PDF'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default Page