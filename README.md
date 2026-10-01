# Aprovação Eletrônica SGQ

Ferramenta interna de aprovação eletrônica de documentos do SGQ — substitui a
assinatura escaneada por um fluxo rastreável: conta individual por aprovador
(Supabase Auth), decisão registrada com hash do arquivo, protocolo de aprovação
em PDF gerado automaticamente, e trilha de auditoria com cadeia de hash (não
pode ser alterada retroativamente sem deixar evidência).

Contexto completo da decisão de arquitetura em `docs/assinatura Eletronica - manual.docx`.

## Arquitetura

- **App**: Next.js, roda no servidor corporativo (Windows), acessado só pela
  rede interna via `http://IP-DO-SERVIDOR:PORTA` (sem HTTPS).
- **Autenticação**: Supabase Auth — cada aprovador tem conta própria.
- **Arquivos** (PDFs originais e protocolos de aprovação): Supabase Storage,
  em buckets privados (`documentos` e `protocolos`), acessados por URL assinada
  de curta duração.
- **Banco relacional** (documentos, revisões, aprovações, trilha de auditoria):
  Postgres do próprio Supabase, via Drizzle ORM.

## Configurando o projeto Supabase (uma vez)

1. Crie o projeto em supabase.com.
2. Em **Storage**, crie dois buckets **privados**: `documentos` e `protocolos`
   (desmarque "Public bucket").
3. Em **Project Settings → API**, copie a **Project URL**, a **anon public key**
   e a **service_role key** (secreta).
4. Em **Project Settings → Database**, copie a **Connection string** (Session
   pooler, porta 6543, ou a conexão direta).
5. Copie `.env.example` para `.env.local` e preencha com os valores acima.

## Rodando localmente

```
npm install
npm run db:migrate
npm run seed -- --nome="Seu Nome" --email="voce@empresa.com"
npm run dev
```

O `seed` cria o primeiro administrador (via Supabase Auth) e mostra a senha
temporária — ela precisa ser trocada no primeiro login. Acesse
http://localhost:3000/login.

## Deploy no servidor corporativo (Windows, rede interna)

1. Copie o projeto para o servidor, com o `.env.local` (ou variáveis de
   ambiente do sistema) apontando para o Supabase de produção.
2. Rode uma vez:
   ```
   npm install
   npm run build
   npm run db:migrate
   npm run seed -- --nome="..." --email="..."
   ```
3. Suba como **serviço do Windows** com o [NSSM](https://nssm.cc/) (não exige
   instalação, é um único `.exe`):
   ```
   nssm install AprovacaoSGQ "C:\Program Files\nodejs\node.exe" "node_modules\next\dist\bin\next start -p 3000"
   nssm set AprovacaoSGQ AppDirectory "C:\caminho\para\o\projeto"
   nssm set AprovacaoSGQ AppEnvironmentExtra DATABASE_URL=... NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=...
   nssm start AprovacaoSGQ
   ```
   Isso mantém o processo rodando e reinicia sozinho se cair ou se o servidor
   reiniciar. Acesse por `http://IP-DO-SERVIDOR:3000`.
4. Depois de qualquer atualização do código: `npm run build`, rode
   `npm run db:migrate` se o schema mudou, e `nssm restart AprovacaoSGQ`.

## O que ainda falta para ficar defensável em auditoria (fora do escopo desta entrega)

- Protocolo simples de validação do sistema (evidência de que foi testado).
- Política de backup/retenção do Supabase (Postgres + Storage).
- Atualizar a IT 4.01-01 / MP4.01 descrevendo este sistema como o mecanismo de
  aprovação eletrônica oficial.

## Riscos conhecidos por usar Supabase (decisão do usuário)

- O acesso interno (HTTP, sem certificado) e o banco/auth/storage ficarem num
  serviço de nuvem de terceiros (mesmo que gratuito) é uma divergência do
  desenho original — que priorizava manter tudo interno para fortalecer a
  defesa perante a VISA/ANVISA na NC 06. Registrado aqui para referência futura.
- No plano free do Supabase, o projeto pode pausar após alguns dias de
  inatividade, derrubando o sistema sem aviso — risco aceito explicitamente.
- O convite "middleware" do Next.js está com aviso de depreciação (Next 16
  recomenda migrar para "proxy"); funciona normalmente, mas vale acompanhar em
  futuras atualizações do framework.
