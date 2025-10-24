# Gerador de Termo – Next.js (TypeScript)

Aplicação para editar um modelo de termo e gerar PDF. Tudo versionado em JSON no servidor. Interface com duas abas: **Campos** e **Termo**. Em **Campos** você preenche os valores e baixa o PDF. Em **Termo** você edita o modelo, vê e gerencia o histórico.

## Requisitos
- Node.js 18 ou 20
- npm

## Instalação
```bash
npm i
```

## Desenvolvimento
```bash
npm run dev
```

## Build e produção
```bash
npm run build
npm run start
```

## API
### GET /api/template
Retorna o modelo atual.
```json
{ "title": "...", "body": "...", "signer1": "...", "signer2": "...", "currentId": "..." }
```

### PUT /api/template
Salva um novo modelo e cria uma versão no histórico.
Request:
```json
{ "title": "...", "body": "...", "signer1": "...", "signer2": "..." }
```
Response:
```json
{ "ok": true, "entry": { "id": "...", "ts": 1712345678, "title": "...", "body": "...", "signer1": "...", "signer2": "..." } }
```

### GET /api/history
Lista do histórico do mais novo para o mais antigo.
```json
[ { "id": "...", "ts": 1712345678, "title": "...", "body": "...", "signer1": "...", "signer2": "..." } ]
```

### POST /api/history/revert
Define uma versão do histórico como modelo em uso e cria uma nova entrada no topo.
Request:
```json
{ "id": "..." }
```
Response:
```json
{ "ok": true, "entry": { "id": "...", "ts": 1712345678, "title": "...", "body": "...", "signer1": "...", "signer2": "..." } }
```

### POST /api/history/delete
Remove uma versão do histórico. Não remove a versão em uso.
Request:
```json
{ "id": "..." }
```

## Uso
1. Acesse a aba **Campos** e preencha os campos detectados no texto.
2. Baixe o PDF usando o botão Download PDF.
3. Para mudar o modelo, vá em **Termo**, edite título, corpo e assinaturas e salve.
4. Veja o histórico, visualize versões antigas, reverta ou exclua.

## Template do termo
Arquivo `data/template.json`:
```json
{
  "title": "Termo de Mudança Condomínio Attuale",
  "body": "Texto com variáveis como {{unidade}} e pipes {{cargo|Zelador}}",
  "signer1": "{{assin1_nome}}\\nCPF {{assin1_cpf}}\\n{{assin1_cargo|Locatário}}\\nAssinatura",
  "signer2": "{{assin2_nome}}\\nCPF {{assin2_cpf}}\\n{{assin2_cargo|Zelador}}\\nAssinatura"
}
```

### Variáveis
- Formato `{{chave}}` ou `{{chave|valor_padrao}}`.
- Datas no formato `YYYY-MM-DD` são renderizadas por extenso. Ex.: `2025-10-23` vira `23 de outubro de 2025`.
- Campos com nome que contém `cpf` são mascarados como `000.000.000-00`.

## PDF
Gerado no cliente usando html2canvas e jsPDF no formato A4 retrato.

## Notas
- O histórico guarda até 200 versões.
- A UI mostra qual versão está em uso e qual você está visualizando.
- As assinaturas ficam no rodapé do documento.
