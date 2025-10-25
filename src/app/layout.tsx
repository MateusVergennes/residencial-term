import 'bootstrap/dist/css/bootstrap.min.css'
import './globals.css'
import React from 'react'

export const metadata = {
  title: 'Termo Attuale',
  description: 'Gerador de Termo'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}