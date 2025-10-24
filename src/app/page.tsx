'use client'

import { useEffect, useMemo, useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

type Template = { title: string; body: string; signer1: string; signer2: string }
type HistoryItem = { id: string; ts: number; title: string; body: string; signer1: string; signer2: string }

export default function Page() {
  const [tab, setTab] = useState<'campos' | 'termo'>('campos')
  const [tpl, setTpl] = useState<Template>({ title: 'Termo de Mudança Condomínio Attuale', body: '', signer1: '', signer2: '' })
  const [hist, setHist] = useState<HistoryItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [viewingId, setViewingId] = useState<string | 'current'>('current')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const t = await fetch('/api/template', { cache: 'no-store' }).then(r => r.json())
      const h = await fetch('/api/history', { cache: 'no-store' }).then(r => r.json())
      setTpl({ title: t.title, body: t.body, signer1: t.signer1, signer2: t.signer2 })
      setActiveId(t.currentId ?? (h[0]?.id ?? null))
      setViewingId('current')
      setHist(h)
      setLoading(false)
    }
    load()
  }, [])

  const keys = useMemo(() => {
    const s = new Set<string>()
    const add = (str: string) => {
      const re = /\{\{([^}]+)\}\}/g
      let m: RegExpExecArray | null
      while ((m = re.exec(str)) !== null) s.add(m[1].split('|')[0].trim())
    }
    add(tpl.body); add(tpl.signer1); add(tpl.signer2)
    return Array.from(s)
  }, [tpl.body, tpl.signer1, tpl.signer2])

  const pipeDefaults = useMemo(() => {
    const map = new Map<string, string>()
    const scan = (str: string) => {
      const re = /\{\{([^}]+)\}\}/g
      let m: RegExpExecArray | null
      while ((m = re.exec(str)) !== null) {
        const [k, def] = m[1].split('|').map(s => s.trim())
        map.set(k, def || '')
      }
    }
    scan(tpl.body); scan(tpl.signer1); scan(tpl.signer2)
    return map
  }, [tpl.body, tpl.signer1, tpl.signer2])

  const [vals, setVals] = useState<Record<string, string>>({})
  useEffect(() => {
    setVals(prev => {
      const next = { ...prev }
      for (const k of keys) {
        if (!next[k] || next[k] === '') {
          const d = pipeDefaults.get(k) || ''
          if (d) next[k] = d
        }
      }
      return next
    })
  }, [keys.join('|')])

  const setVal = (k: string, v: string) => setVals(prev => ({ ...prev, [k]: v }))

  const maskCPF = (v: string) => {
    const n = (v || '').replace(/\D/g, '').slice(0, 11)
    let out = n
    if (n.length > 3) out = n.replace(/(\d{3})(\d)/, '$1.$2')
    if (n.length > 6) out = out.replace(/(\d{3})(\d)/, '$1.$2')
    if (n.length > 9) out = out.replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    return out
  }
  const dataExtensoISO = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso + 'T00:00:00')
    const dia = d.getUTCDate()
    const mes = d.toLocaleString('pt-BR', { month: 'long', timeZone: 'UTC' })
    const ano = d.getUTCFullYear()
    return `${dia} de ${mes} de ${ano}`
  }
  const ghost = (label: string, min = 6) => `<span class="ghost" style="min-width:${min}ch">${label}</span>`

  const compile = (str: string) =>
    str.replace(/\{\{([^}]+)\}\}/g, (_, inside) => {
      const [key, def] = String(inside).split('|').map((s: string) => s.trim())
      let val = vals[key] || ''
      if (!val && def) val = def
      if (key.includes('cpf')) val = maskCPF(val)
      if (key.includes('data_') || key === 'data_mudanca') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) val = dataExtensoISO(val)
      }
      if (!val) return ghost(key, Math.max(6, Math.floor(key.length / 2)))
      return val
    })

  const handleSave = async () => {
    const res = await fetch('/api/template', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tpl)
    }).then(r => r.json()) as { ok: boolean; entry: HistoryItem }
    const h = await fetch('/api/history', { cache: 'no-store' }).then(r => r.json())
    setHist(h)
    setActiveId(res.entry.id)
    setViewingId('current')
  }

  const handleRevert = async (id: string) => {
    await fetch('/api/history/revert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    }).then(r => r.json())
    const t = await fetch('/api/template', { cache: 'no-store' }).then(r => r.json())
    const h = await fetch('/api/history', { cache: 'no-store' }).then(r => r.json())
    setTpl({ title: t.title, body: t.body, signer1: t.signer1, signer2: t.signer2 })
    setHist(h)
    setActiveId(t.currentId ?? (h[0]?.id ?? null))
    setViewingId('current')
  }

  const handleDelete = async (id: string) => {
    await fetch('/api/history/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    }).then(r => r.json())
    const h = await fetch('/api/history', { cache: 'no-store' }).then(r => r.json())
    setHist(h)
    if (viewingId === id) setViewingId('current')
  }

  const viewHistory = (h: HistoryItem) => {
    setTpl({ title: h.title, body: h.body, signer1: h.signer1, signer2: h.signer2 })
    setViewingId(h.id)
  }

  const viewCurrent = async () => {
    const t = await fetch('/api/template', { cache: 'no-store' }).then(r => r.json())
    setTpl({ title: t.title, body: t.body, signer1: t.signer1, signer2: t.signer2 })
    setViewingId('current')
  }

  const downloadPdf = async () => {
    const paper = document.getElementById('paper') as HTMLElement
    const canvas = await html2canvas(paper, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
    const imgData = canvas.toDataURL('image/jpeg', 0.98)
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
    const pageWidth = 210
    const imgWidth = pageWidth
    const imgHeight = canvas.height * imgWidth / canvas.width
    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight)
    pdf.save('termo.pdf')
  }

  if (loading) return <div className="wrap">carregando...</div>

  return (
    <div className="wrap">
      <div className="top">
        <div className="title-app">Gerador de Termo</div>
        <div className="actions">
          <button onClick={() => setTab('campos')} className={tab === 'campos' ? 'primary' : ''}>Campos</button>
          <button onClick={() => setTab('termo')} className={tab === 'termo' ? 'primary' : ''}>Termo</button>
          {tab === 'campos' && <button onClick={downloadPdf}>Download PDF</button>}
          {tab === 'termo' && <button onClick={handleSave} className="primary">Salvar modelo</button>}
        </div>
      </div>

      {tab === 'campos' && (
        <div className="grid">
          <div className="panel">
            <h2>Preencha os campos</h2>
            <div className="pad" id="fieldsArea">
              {keys.map(k => {
                const label = k.replace(/_/g, ' ')
                const type = (k.includes('data_') || k === 'data_mudanca') ? 'date' : 'text'
                const value = vals[k] ?? ''
                return (
                  <div className="row" key={k}>
                    <div>
                      <label>{label}</label>
                      <input type={type} value={value} onChange={e => setVal(k, e.target.value)} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="panel">
            <h2>Prévia</h2>
            <div className="preview">
              <div id="paper" className="paper a4">
                <h1 className="doc-title">{tpl.title}</h1>
                <div className="doc-text" dangerouslySetInnerHTML={{ __html: compile(tpl.body).replace(/\n/g, '<br>') }} />
                <div style={{ flex: '1 1 auto' }} />
                <div className="signs">
                  {[tpl.signer1, tpl.signer2].map((sig, i) => {
                    const lines = compile(sig).split('\n')
                    return (
                      <div className="sign" key={i}>
                        <div className="line" />
                        <strong dangerouslySetInnerHTML={{ __html: lines[0] || '' }} />
                        <small dangerouslySetInnerHTML={{ __html: lines[1] || '' }} />
                        <small dangerouslySetInnerHTML={{ __html: lines[2] || '' }} />
                        <small dangerouslySetInnerHTML={{ __html: lines[3] || '' }} />
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>Prévia do PDF A4</div>
            </div>
          </div>
        </div>
      )}

      {tab === 'termo' && (
        <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="panel">
            <h2>Editar modelo do termo</h2>
            <div className="pad">
              <div className="row">
                <div>
                  <label>Título</label>
                  <input value={tpl.title} onChange={e => setTpl(p => ({ ...p, title: e.target.value }))} />
                </div>
              </div>
              <div className="row">
                <div>
                  <label>Texto do termo</label>
                  <textarea className="big" value={tpl.body} onChange={e => setTpl(p => ({ ...p, body: e.target.value }))} />
                </div>
              </div>
              <div className="row">
                <div>
                  <label>Assinatura 1</label>
                  <textarea className="big" value={tpl.signer1} onChange={e => setTpl(p => ({ ...p, signer1: e.target.value }))} />
                </div>
              </div>
              <div className="row">
                <div>
                  <label>Assinatura 2</label>
                  <textarea className="big" value={tpl.signer2} onChange={e => setTpl(p => ({ ...p, signer2: e.target.value }))} />
                </div>
              </div>

              <div style={{ marginTop: 16, marginBottom: 8, fontWeight: 600 }}>Histórico</div>
              <div className="history">
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button onClick={viewCurrent}>Ver versão em uso</button>
                  {activeId && <span className="badge">em uso: {activeId.slice(0, 8)}</span>}
                  {viewingId !== 'current' && <span className="badge">visualizando: {String(viewingId).slice(0, 8)}</span>}
                  {viewingId === 'current' && <span className="badge">visualizando: em uso</span>}
                </div>
                {hist.length === 0 && <div className="badge">sem histórico ainda</div>}
                {hist.map(h => (
                  <div className="history-item" key={h.id}>
                    <div>
                      <div style={{ fontWeight: 600 }}>Versão {h.id.slice(0, 8)}</div>
                      <div className="badge">{new Date(h.ts).toLocaleString('pt-BR')} • {h.title}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {activeId === h.id && <span className="badge">em uso</span>}
                      {viewingId === h.id && <span className="badge">visualizando</span>}
                      <button onClick={() => viewHistory(h)}>Visualizar</button>
                      <button className="primary" onClick={() => handleRevert(h.id)}>Reverter</button>
                      <button disabled={activeId === h.id} onClick={() => handleDelete(h.id)}>Excluir</button>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}