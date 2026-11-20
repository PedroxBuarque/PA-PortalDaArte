# Portal da Arte — Integração Mensagens → Contratações

## Diagnóstico fundamentado nos arquivos recebidos

- `mensagens.tsx` cria uma proposta com `POST /api/propostas` e o aceite usa `PATCH /api/propostas/{id}/status`.
- A antiga `contratacoes.tsx` mostrava `CONTRATACOES_LIST`, uma lista estática de quatro exemplos, sem consultar o banco. `detalhes.tsx` também consultava essa lista.
- No backend fornecido não existia `GET /api/contratacoes`; por isso foi incluído. O erro HTTP 405 exato observado no ambiente do usuário não pôde ser reproduzido sem executar seu servidor. Um erro 405 indica que o método HTTP não é aceito na URL consultada; confirmar se o processo FastAPI atualizado está em execução e qual request aparece em Network.
- Propostas pertencem a cliente e artista, vinculadas a conversas. Aceitar uma proposta NÃO cria automaticamente um registro na tabela `contratos` (a tabela exige `modelo_id` e aceite formal); a tela identifica propostas aceitas como `Confirmado` e avisa quando ainda não há contrato formal.

## Copiar arquivos (a partir da raiz do projeto, respeitando caminhos)

1. `python-api/main.py` → substituir o arquivo correspondente da API que está sendo executada.
2. `PA-PortalDaArte/src/app/pages/contratacoes/contratacoes.tsx` → substituir.
3. `PA-PortalDaArte/src/app/pages/contratacoes/detalhes.tsx` → substituir.
4. `PA-PortalDaArte/src/components/contratacoes/CardContratacao.tsx` → substituir.
5. `PA-PortalDaArte/src/components/contratacoes/contratacoesApi.ts` → criar.
6. `PA-PortalDaArte/src/app/pages/mensagens/mensagens.tsx` → substituir, com link em cada proposta para a tela de detalhes.

**Importante:** o backend vem da última correção de chat fornecida nesta conversa; não substitua cegamente mudanças feitas posteriormente por colegas. Faça backup/commit antes de aplicar, compare com a branch atual e faça merge quando necessário. Após copiar o backend, reinicie o processo Uvicorn/FastAPI que a aplicação usa. Confirme `EXPO_PUBLIC_API_URL` e a URL de destino.

## Endpoints

- `POST /api/propostas`: continua gravando uma proposta de conversa, sem criar contrato assinado.
- `PATCH /api/propostas/{id}/status`: artista aceita ou recusa.
- **Novo** `GET /api/contratacoes`: lista propostas reais de artista ou cliente autenticado, com o estado do contrato formal se houver.
- **Novo** `GET /api/contratacoes/{id}`: retorna detalhes de uma proposta, com controle de acesso por participante.

Todos os GET exigem `Authorization: Bearer <token>`. Os resultados não incluem propostas de outros usuários. A listagem busca propostas pelo ID primário e não cria registros adicionais, impedindo duplicação na tela.

## Campos exibidos e limites do esquema atual

Os campos realmente existentes em `propostas` são: descrição do serviço, `prazo_estimado` (somente data), `local_ou_modalidade` (texto livre), valor, status, participante e conversa. Não existem campos confiáveis nessa tabela para hora do evento, cidade/UF estruturada ou avaliação do artista. O card preserva o estilo, mostra a descrição como título, o local em texto livre, a data informada (ou a data de solicitação quando não há prazo) e o valor. **Não são fabricados horários, cidades, notas ou avaliações.** Esses campos exigem modelagem/integração própria futura, não contemplada neste patch.

## Testes a executar com MySQL e 2 contas

1. Reiniciar a API e abrir `http://127.0.0.1:8000/docs` (ou a URL real). Confirmar `GET /api/contratacoes` e `GET /api/contratacoes/{proposta_id}`.
2. Com conta cliente: criar proposta pelo modal no chat. Verificar na tabela `propostas` a linha e seu `conversa_id`, `contratante_id`, `artista_id`.
3. Em Contratações do cliente: novo card Pendente, valor real e dados preenchidos. Abrir detalhes e voltar para conversa.
4. Com conta artista: a mesma proposta deve aparecer em Contratações. Na conversa clicar Aceitar.
5. Na conta cliente aberta: aguardar até ~4s + latência de rede e confirmar badge `Confirmado`, na lista e detalhes. A conversa mantém a proposta aceita.
6. Verificar os filtros Pendente, Confirmado e Concluído. Concluído só será exibido quando existir contrato com `status=concluido`; o aceite de proposta, isoladamente, não conclui contrato.
7. Atualizar a página: os dados devem persistir. Verificar que a contagem em `/api/contratacoes` corresponde às propostas no banco, sem duplicação de cards.
8. Autenticar um terceiro usuário não participante e consultar um ID de proposta alheio: deve obter 404.
9. Para diagnosticar 405 persistente: aba Network > request com erro > verificar Request URL/Method. Confirmar que a API atualizada foi iniciada, e que o frontend não aponta para outro servidor ou porta.

## Verificações automatizadas efetuadas

- `python -m py_compile python-api/main.py` passou.
- Verificação TypeScript executada com os arquivos sobrepostos temporariamente na árvore original. Os arquivos de Contratações não introduzem erros tipados adicionais além de erro preexistente no projeto em `Sidebar` (prop `activeRoute` de componente `.jsx` sem declaração de tipos). O projeto já tinha outros erros globais de TS; a compilação global não foi considerada aprovada.
- Não há MySQL operacional ou duas sessões reais de usuário no ambiente de edição; não se afirma conclusão de testes ponta a ponta.
