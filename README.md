# Controle de Compras

App web (HTML/CSS/JS puro) para substituir a planilha manual de controle de compras.
Todos os dados ficam salvos no `localStorage` do navegador — nada sai da sua máquina.

## Como usar

1. Cadastre os pedidos na aba **Pedidos** (fornecedor, valor, aprovação, faturamento, vencimentos/parcelas, status).
   O campo "Prazo" (antigo "Entrega") não é mais preenchido à mão — o app calcula sozinho se está
   ATRASADO, VENCE EM X DIA(S) ou DENTRO DO PRAZO, comparando os vencimentos com a data de hoje.
2. Defina o budget de cada mês na aba **Budget**.
3. A aba **Dashboard** calcula tudo sozinha: gasto mensal, gasto por semana (baseado nos vencimentos das parcelas), saldo, % utilizado e um painel de **alertas** com pedidos atrasados ou vencendo nos próximos 7 dias — sem preenchimento manual.
4. Na aba **Exportar**, gere um `.xlsx` com 3 abas: Resumo, Semanal e Pedidos.

## Regra de semana

Cada mês é dividido em 4 semanas por dia do vencimento:
- Semana 1: dias 01–07
- Semana 2: dias 08–14
- Semana 3: dias 15–21
- Semana 4: dia 22 até o fim do mês

## Deploy no Netlify (mesmo fluxo do Judge App)

1. Crie um repositório novo no GitHub e suba estes arquivos.
2. No Netlify: **Add new site → Import from GitHub** → selecione o repositório.
3. Build command: (nenhum) — Publish directory: `/` (raiz).
4. Deploy. O app funciona como PWA (instalável, com cache offline via service worker).

## Backup dos dados

Os dados ficam no localStorage do navegador (por domínio). Recomenda-se rodar a exportação
para Excel periodicamente como backup, já que limpar o cache do navegador apaga os dados locais.
