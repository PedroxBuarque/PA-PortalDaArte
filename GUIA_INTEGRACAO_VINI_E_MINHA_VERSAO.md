# Portal da Arte — fusão das versões da equipe

Data: 20/11/2026. Base: arquivo `Versão De vini` (RAR). Alterações incorporadas: `Minha versão.zip` (fluxo validado anteriormente de mensagens, propostas e tela de contratações).

## O que foi preservado

- A arquitetura React Native + Expo Router + FastAPI + MySQL.
- O `ThemeContext` (claro, escuro e alto contraste), `Sidebar`, `Header`, componentes de acessibilidade e VLibras.
- O design responsivo do Vinicius, inclusive a identidade visual e as versões para telas menores.
- As telas e regras do carrinho, checkout, integração ASAAS e demais rotas financeiras presentes na versão do Vinicius (não foram substituídas ou reescritas).
- O formulário completo de contratação em `Contratar.tsx`, acessível pelo perfil público, que **continua criando proposta no banco e abrindo a tela de detalhes**, sem exigir mensagem anterior.
- A lógica do Vinicius que, quando o artista aceita uma proposta, atualiza seu status e cria o contrato relacionado; o backend continua sendo o responsável pela transação.
- A visualização/envio de mídia e exclusão de mensagens no chat do Vinicius.

## Arquivos modificados

| Caminho a partir da raiz | Alteração |
|---|---|
| `python-api/main.py` | Campo de autorização `pode_solicitar` nas conversas; `GET /api/conversas/{conversa_id}/propostas` com verificação de participantes; aliases `GET /api/contratacoes` e `GET /api/contratacoes/{proposta_id}` para compatibilidade com o frontend anterior; avaliação real do artista consultada da tabela `avaliacoes`; repetição idêntica de proposta em até 30 segundos reutiliza o mesmo ID. |
| `PA-PortalDaArte/src/app/pages/mensagens/mensagens.tsx` | Modal de solicitar contratação no chat; listagem vinculada à conversa, status e links para detalhes; respostas permitidas apenas ao artista; polling de propostas e mensagens a cada 3 segundos; atualização otimista para texto **e mídia**, conciliando IDs reais para evitar duplicações visuais. Mantidas as ações anteriores de mídia. |
| `PA-PortalDaArte/src/app/pages/contratacoes/contratacoes.tsx` | Cards com título, valor BRL, nome do artista, avaliação real quando existente, local/modalidade, data real disponível e status; filtros; atualização ao focar a tela e a cada 4 segundos. Mantido o layout, tema e responsividade do Vinicius. |
| `PA-PortalDaArte/src/app/pages/contratacoes/detalhes.tsx` | Botão de retorno à conversa certa, consulta de status atualizada e fluxo de aceite do Vinicius preservado. |
| `PA-PortalDaArte/src/components/contratacoes/CardContratacao.tsx` | Apresentação de título, valor e avaliação, sem perder o visual temático responsivo. |
| `PA-PortalDaArte/src/services/contratacoes.ts` | Extensão dos tipos de API e padronização de status (`Concluído`, `Confirmado`, etc.), mantendo os endpoints originais. |

A criação/consulta da contratação permanece centrada nas tabelas existentes `propostas`, `conversas`, `contratos`, `mensagens` e `avaliacoes`: **não foi criado um segundo sistema de contratação**.

A antiga `contratacoesApi.ts` da versão pessoal não foi incorporada, porque duplicaria o cliente da API do Vinicius: o módulo oficial dessa fusão é `src/services/contratacoes.ts`. Os antigos endpoints `GET /api/contratacoes` foram preservados como aliases no backend para facilitar compatibilidade.

## Fluxos de operação

**A partir do chat:** Contratante abre Mensagens → seleciona conversa com artista → botão "Solicitar contratação" → preenche descrição, valor e local/modalidade → envia → FastAPI salva em `propostas` e escreve mensagem de registro na conversa → artista vê o card e pode aceitar/recusar → status e contrato são atualizados no MySQL → ambos visualizam os dados também em Contratações. O link "Ver em Contratações" abre os detalhes, e "Abrir conversa" retorna ao chat.

**A partir do perfil:** Perfil público do artista → botão Contratar → `Contratar.tsx` do Vinicius → API obtém/reutiliza a conversa e registra a proposta, sem exigir texto enviado manualmente → redireciona a detalhes → a listagem em Contratações mostra a mesma proposta.

**Mensagens:** Textos/mídias enviados aparecem imediatamente na interface com indicador "Enviando..." e são substituídos pela resposta real da API. Mensagens recebidas e mudanças de status são sincronizadas por polling; o backend/MySQL continua sendo a fonte oficial.

## Rotas importantes

| Método | Rota | Objetivo |
|---|---|---|
| `GET` | `/api/conversas` | Conversas do usuário + indicador de permissão para solicitar |
| `POST` | `/api/conversas` | Obter ou criar conversa (já existia) |
| `GET` | `/api/conversas/{id}/mensagens` | Histórico atualizado |
| `POST` | `/api/conversas/{id}/mensagens` | Enviar texto |
| `POST` | `/api/conversas/{id}/mensagens/arquivo` | Enviar mídia (Vinicius) |
| `GET` | `/api/conversas/{id}/propostas` | Propostas daquela conversa; somente participantes |
| `POST` | `/api/propostas` | Criar proposta; somente contratante |
| `POST` | `/api/propostas/{id}/responder` | Aceitar ou recusar proposta; somente artista; ao aceitar cria contrato (Vinicius) |
| `GET` | `/api/propostas` | Listagem principal; usada pelo frontend do Vinicius |
| `GET` | `/api/propostas/{id}` | Detalhes principal |
| `GET` | `/api/contratacoes` | Alias de compatibilidade com a versão anterior (resolve incompatibilidade GET/rota) |
| `GET` | `/api/contratacoes/{id}` | Alias de detalhes da versão anterior |

**Cuidado:** o frontend integrado usa `POST /api/propostas/{id}/responder`, conforme a versão do Vinicius. Não misture um `mensagens.tsx` antigo que chama `PATCH /api/propostas/{id}/status` com o novo backend; use **ambos os arquivos desta entrega**.

## Instalação

1. Faça backup da versão atual e do banco MySQL; teste a fusão em uma branch ou cópia, não substitua arquivos em produção diretamente.
2. Se já usa o projeto do Vinicius, copie os **seis arquivos** do ZIP de atualização para os caminhos mostrados acima. Se for instalar do zero, extraia o ZIP completo e use seus diretórios `PA-PortalDaArte`, `python-api` e `BancoDeDados`.
3. **Não substitua seus `.env` existentes**. Eles não foram incluídos neste pacote por conterem credenciais. Mantenha os valores válidos no servidor e no Expo. O arquivo `.env.example` contém apenas nomes/placeholders.
4. Instale as dependências do frontend: `cd PA-PortalDaArte && npm ci` (Node compatível com Expo 54).
5. Defina `EXPO_PUBLIC_API_URL` no `.env` do frontend com o endereço da API **acessível ao dispositivo**. `127.0.0.1` só funciona quando cliente e API estão na mesma máquina.
6. Na raiz, instale as dependências Python: `python -m pip install -r requirements.txt`. Confira `python-api/.env` para MySQL, Supabase e credenciais financeiras já utilizadas.
7. Inicie a API: `cd python-api && uvicorn main:app --reload --port 8000`.
8. Inicie o Expo: `cd PA-PortalDaArte && npx expo start -c`.
9. Confira `/docs` no FastAPI e os endpoints da tabela acima. O frontend e o backend **devem ser atualizados juntos**.

### Banco de dados

**Não é necessária uma nova migração SQL apenas para essa integração** se o banco já contém o esquema do projeto do Vinicius. O backend consulta as tabelas existentes, incluindo `avaliacoes`. Conserve o banco real e seus dados. O arquivo `BancoDeDados/BD.sql` é um dump de referência que contém `DROP TABLE`; **nunca o execute sobre seu banco já em uso**. As migrações de pagamentos/carrinho da versão do Vinicius continuam no diretório `BancoDeDados`, mas não devem ser reaplicadas sem conferir o estado da instalação.

### Limites de informação dos cards

- Título: serviço da proposta, ou descrição do escopo como alternativa.
- Data: `prazo_estimado`, quando fornecido; caso contrário, data de solicitação.
- Localização: texto registrado em `local_ou_modalidade` (pode conter cidade/UF, se informado).
- Avaliação: média/quantidade **efetiva** na tabela `avaliacoes`; caso não existam, aparece "Sem avaliações registradas".
- Horário exato de evento e cidade/UF em campos separados **não existem no esquema atual de `propostas`**. Não foram inventados nem acrescentados por esta fusão; requeririam campos e uma migração específica, caso a equipe os aprove depois.
- Não confundir `Confirmado` (aceite) com serviço `Concluído` (status do contrato).

### Credenciais

O pacote não inclui `.env`, `CREDENCIAIS-E-ENV-INTEGRADOS.txt`, chaves Asaas/Supabase ou instalações `node_modules`/`.venv`. O arquivo ZIP de atualização inclui apenas código alterado e este guia. Para uma instalação real, preserve as credenciais da sua máquina em arquivos privados, não versionados no Git.

## Verificações realizadas nesta entrega

- Sintaxe de `python-api/main.py`: passou (`py_compile`).
- Contratos HTTP (`TestClient` FastAPI, adaptador MySQL **simulado**): passou para criação, retry idempotente, GET da listagem e detalhes, GET de propostas da conversa, aceite/criação de contrato, mudança de status e autorização (contratante/artista/terceiros).
- TypeScript: os arquivos alterados passaram no `tsc --noEmit`; a instalação de dependências disponível no ambiente de verificação não continha `react-native-vlibras`, causando um erro **preexistente também na versão do Vinicius**. Uma declaração temporária de testes permitiu validar o restante, e não foi incorporada ao projeto distribuído. O `package-lock.json` do Vinicius inclui a dependência correta.
- Não foi possível executar teste ponta a ponta com seu MySQL, conta de artista/contratante, Supabase ou Asaas nesta sessão. Os testes reais dependem da configuração local.

Consulte `CHECKLIST_TESTES_MANUAIS.md` antes de mesclar na `main`.
