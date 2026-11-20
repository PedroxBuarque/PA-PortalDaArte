# Integração de propostas com mensagens

Alterações em `python-api/main.py`, `PA-PortalDaArte/src/app/pages/mensagens/mensagens.tsx` e `PA-PortalDaArte/src/app/pages/perfil_publico/perfil_publico.tsx`.

## Fluxo
- No perfil, **Solicitar contratação** abre a tela de mensagens com o formulário aberto, sem enviar mensagem.
- No chat, **Solicitar contratação** abre o mesmo formulário.
- A proposta é persistida em `propostas` e vinculada à conversa, cliente e artista existentes.
- A conversa apresenta cartões de proposta, com status; o artista pode aceitar ou recusar.
- Endpoints adicionais: GET `/api/conversas/{id}/propostas`, GET `/api/minhas-propostas`, PATCH `/api/propostas/{id}/status`.

## Limitações e validação pendente
- Não foram executados testes com servidor MySQL/API ativos ou duas contas reais.
- Não foi localizada a implementação histórica do Vinicius com identificação inequívoca no snapshot fornecido.
- A tela geral de contratações ainda usa `CONTRATACOES_LIST` fictícia e não foi alterada.
- Ainda não há chave idempotente persistente para proteger contra reenvio após falha de rede; o formulário impede duplo clique enquanto envia.
- Aceitar uma proposta atualiza `propostas.status`; não cria automaticamente um contrato assinado nem aciona pagamentos.
- O endpoint existente de criação de conversa evita reutilizar pares existentes, mas não há índice único no banco para concorrência.
- O projeto possui erros TypeScript preexistentes; a verificação global não passou.

## Testes manuais obrigatórios
1. Subir MySQL com esquema `BancoDeDados/BD.sql` e API FastAPI, com duas contas reais (cliente e artista).
2. Cliente: perfil público > Solicitar contratação > preencher e enviar; conferir registro em `propostas` e ausência de nova mensagem.
3. Cliente: chat > Solicitar contratação > enviar; conferir mesmo par de participantes e conversa.
4. Artista: abrir a mesma conversa; conferir cartão e status; aceitar ou recusar e verificar atualização.
5. Cliente: reabrir conversa; verificar persistência do cartão e continuidade de mensagens.
6. Tentar POST de proposta como usuário não participante e PATCH como cliente: devem ser recusados.
7. Verificar simultaneidade e repetição de requisições antes de liberar em produção.
