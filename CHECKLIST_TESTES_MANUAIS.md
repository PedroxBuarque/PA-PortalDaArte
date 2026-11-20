# Checklist de testes — fusão Chat / Contratações (20/11/2026)

Use um ambiente de desenvolvimento e faça backup dos dados. Execute com duas contas reais: contratante e artista. Não use o banco de produção para testes de pagamento.

- [ ] Entrar como contratante, abrir o perfil de um artista e **Contratar** pelo formulário completo. Conferir criação de UMA proposta e redirecionamento para Detalhes.
- [ ] Abrir **Contratações** e localizar o card correspondente, com nome do artista, serviço, valor, data disponível, local registrado e status **Pendente**.
- [ ] Abrir **Mensagens**, selecionar a conversa com o mesmo artista e verificar o card da solicitação. Usar **Ver em Contratações** e **Abrir conversa**.
- [ ] Abrir nova solicitação pelo botão **Solicitar contratação** no chat. Conferir salvamento na mesma conversa e visualização em Contratações.
- [ ] Com conta de artista, acessar a conversa: confirmar que **não** aparece o botão para contratá-lo, mas aparece a opção de **Aceitar/Recusar** solicitação pendente.
- [ ] Aceitar como artista. Conferir criação/reutilização do contrato na API e novo status **Confirmado** em ambas as contas, automaticamente, sem atualizar manualmente.
- [ ] Usar o filtro **Confirmado** da listagem e conferir se exibe a contratação aceita. Testar demais filtros.
- [ ] Enviar mensagem de texto nas duas direções. O remetente deve vê-la imediatamente e o destinatário em ~3 segundos mais latência; conferir apenas um registro na interface e no banco.
- [ ] Enviar imagem e vídeo, abrir os anexos e testar exclusão de mensagem própria. Esses recursos do Vinicius devem continuar funcionando.
- [ ] Clicar duas vezes rapidamente para enviar a mesma proposta e testar reenvio após falha de rede: confirmar que retries idênticos dentro de 30 segundos não criam propostas duplicadas.
- [ ] Tentar acessar `/api/conversas/{id}/propostas` e `/api/contratacoes/{id}` com conta de terceiro: acesso deve ser negado.
- [ ] Verificar visual em modo claro, escuro e alto contraste; testar navegador em 100% de zoom e janela estreita.
- [ ] Conferir o carrinho, checkout, integrações de pagamento, perfil, explorar, filtros e login sem regressões (fluxos financeiros devem usar ambiente de teste apropriado).

**Consultas úteis no MySQL** (substitua os IDs pelos obtidos na API, sem expor dados sensíveis):

```sql
SELECT id, conversa_id, contratante_id, artista_id, valor_proposto, status, criado_em
FROM propostas ORDER BY id DESC LIMIT 15;

SELECT id, proposta_id, status, valor_total FROM contratos ORDER BY id DESC LIMIT 15;
```

O dump `BancoDeDados/BD.sql` não deve ser executado por cima do banco ativo. Não compartilhe `.env` nem respostas de API contendo dados pessoais.
