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

## Sincronização entre dispositivos (Firebase — opcional)

Sem configurar nada, o app funciona 100% local (como sempre funcionou). Se você quiser acessar
os mesmos pedidos e budget de mais de um computador/celular, configure o Firebase (gratuito):

### 1. Criar o projeto
1. Acesse https://console.firebase.google.com → **Adicionar projeto** → dê um nome (ex: `controle-compras`) → pode desativar o Google Analytics.
2. No menu lateral, vá em **Authentication → Sign-in method** → habilite **E-mail/senha**.
3. Vá em **Firestore Database → Criar banco de dados** → modo produção → escolha uma região (ex: `southamerica-east1` para São Paulo).

### 2. Configurar as regras de segurança do Firestore
Em **Firestore Database → Regras**, substitua pelo conteúdo abaixo e clique em **Publicar**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Isso garante que só você (autenticado) consegue ler ou escrever os seus próprios dados.

### 3. Pegar a configuração do app
1. Em **Configurações do projeto** (ícone de engrenagem) → **Seus aplicativos** → clique no ícone `</>` (Web) → registre um app (ex: `controle-compras-web`).
2. Copie o objeto `firebaseConfig` que aparece (algo como `{ apiKey: "...", authDomain: "...", projectId: "...", ... }`).

### 4. Conectar no app
1. Abra o app → aba **Nuvem** → cole o `firebaseConfig` na caixa de texto → **Salvar configuração**.
2. Clique em **Criar conta (primeira vez)**, informe um e-mail e senha (só seus, é a sua chave de acesso).
3. Nos outros dispositivos, repita o passo 4 (cole a mesma configuração) e faça **login** com o mesmo e-mail/senha — os dados sincronizam automaticamente.

A sincronização funciona por "quem editou por último vence" (comparando data/hora de cada alteração),
então é seguro usar em mais de um dispositivo ao mesmo tempo.