# Portal da Arte — Responsividade Web, Android e iOS

**Base:** `PA-PortaldaArte(2).zip` enviado pela equipe.  
**Escopo:** ajustes visuais de layout e acessibilidade em telas estreitas.  
**Alterações:** 17 arquivos modificados e 1 arquivo novo; nenhum endpoint, rota de negócio, tabela MySQL ou dependência nova.

## Breakpoints

- **Mobile:** largura inferior a 768px. Layout em coluna, navegação no menu do Header, filtros de Explorar em modal.
- **Tablet:** de 768px até 1023px. Navegação compacta, grid que acompanha espaço disponível.
- **Desktop:** 1024px ou mais. Dashboard com Sidebar e Header, grades e conteúdo centralizado.
- **Celular estreito:** abaixo de 420px. Controles do cabeçalho em linhas separadas e cards compactos.

Centralização em `src/constants/responsive.ts` com `MOBILE_BREAKPOINT`, `DESKTOP_BREAKPOINT`, `SMALL_PHONE_BREAKPOINT` e `getResponsiveLayout`.

## Arquivos alterados

- `PA-PortalDaArte/src/app/pages/cadastro/cadastro.tsx`
- `PA-PortalDaArte/src/app/pages/carrinho/carrinho.tsx`
- `PA-PortalDaArte/src/app/pages/configuracoes/configuracoes.tsx`
- `PA-PortalDaArte/src/app/pages/contratacoes/Contratar.tsx`
- `PA-PortalDaArte/src/app/pages/contratacoes/contratacoes.tsx`
- `PA-PortalDaArte/src/app/pages/contratacoes/detalhes.tsx`
- `PA-PortalDaArte/src/app/pages/explorar/explorar.tsx`
- `PA-PortalDaArte/src/app/pages/favoritos/favoritos.tsx`
- `PA-PortalDaArte/src/app/pages/login/login.tsx`
- `PA-PortalDaArte/src/app/pages/mensagens/mensagens.tsx`
- `PA-PortalDaArte/src/app/pages/pagamento/pagar.tsx`
- `PA-PortalDaArte/src/app/pages/perfil/perfil.tsx`
- `PA-PortalDaArte/src/app/pages/perfil_publico/perfil_publico.tsx`
- `PA-PortalDaArte/src/components/AuthModal.tsx`
- `PA-PortalDaArte/src/components/Header.tsx`
- `PA-PortalDaArte/src/components/PagamentoPixSandbox.tsx`
- `PA-PortalDaArte/src/components/Sidebar.jsx`
- `PA-PortalDaArte/src/constants/responsive.ts` (novo)

## Resumo da implementação

- **Header e Sidebar:** cabeçalho compacto, ícones acessíveis em linha própria nos telefones estreitos, menu de navegação com rolagem nas telas baixas, Sidebar apenas nas telas de dashboard com espaço suficiente.
- **Explorar:** estimativa de largura útil considerando a Sidebar e o painel de filtros, com grade responsiva de 1 a 3 colunas, filtros em modal no mobile e controles de filtros que podem quebrar de linha.
- **Favoritos e Contratações:** containers e cards adaptados para telas pequenas, paginação por rolagem sem corte na altura da viewport, ajustes de títulos e controles.
- **Detalhes e contratação:** cabeçalhos, ações e campos quebram para vertical quando faltar espaço, com ScrollView.
- **Mensagens:** chat e modal de propostas com alturas úteis e rolagem, mídia adaptada e barra acessível, preservando o polling e a API originais.
- **Login e cadastro:** formulários com teclado e rolagem para telas pequenas; modos de recuperação e redefinição de senha incluídos.
- **Perfil e perfil público:** edição de perfil, serviços e portfólio adaptados às larguras disponíveis; mídia e modais utilizam larguras menores.
- **Carrinho e pagamentos:** cards do carrinho reorganizados em telas estreitas; pagamento sem Sidebar mobile e QR Code adaptado à largura.
- **Configurações e modal de autenticação:** tabs e diálogos com rolagem/adaptação.

## Validação técnica

1. `node node_modules/typescript/bin/tsc --noEmit --pretty false`: **passou**.
2. ESLint dos arquivos alterados com `--quiet`: **passou**.
3. Tentativa de `expo export --platform web`: **não foi concluída** dentro do limite de execução. Isto não é evidência de falha de código, nem comprova funcionamento em navegador.
4. **Pendente**: testes visuais no Chrome/Firefox em diferentes larguras, Android, iOS e fluxos ponta a ponta com seu servidor e MySQL reais.

## Instalação

Opção A: extraia o ZIP completo em uma pasta de desenvolvimento (não sobreponha sem backup). Opção B: extraia o ZIP de alterações sobre sua cópia atual do mesmo `PA-PortaldaArte(2).zip`.

```bash
cd PA-PortalDaArte
npm ci
npx expo start --web
```

Android/iOS: `npx expo start` e abra no ambiente de teste compatível com o projeto.

**Importante:** preserve seu `.env` local e as credenciais externas. Nenhum arquivo `.env`, pasta `.git`, `node_modules`, ambiente virtual ou dado secreto foi incluído intencionalmente. Não aplique o dump SQL em produção; ele inclui comandos de alteração de tabelas.

## Checklist de teste manual — navegadores e celulares

1. Verifique as larguras 320, 360, 390, 430, 768, 1024 e 1440px, no tema claro **e** escuro.
2. Confira que o Header mantém pesquisa, conta, notificações, carrinho, configurações e menu acessíveis; abra a Sidebar no desktop e gaveta no mobile.
3. Em Explorar, alterne filtros, ordenação, busca e favoritar; feche e abra filtros; confirme cards sem cortes e rolagem vertical.
4. Abra Favoritos e Contratações; filtre por status; verifique detalhes, navegação e toque nos cards.
5. Faça login e recuperação de senha; confira a aparição do teclado e que todos os botões podem ser alcançados rolando.
6. Cadastre-se e edite perfil, portfólio e serviços; abra modais e seletores com teclado na tela.
7. Abra perfil público, reproduza mídia, inicie contratação e confirme que as mensagens e propostas seguem sincronizando com o backend.
8. Adicione e remova serviços do carrinho; inicie pagamento e confira formulários e QR Code.
9. Em Android e iOS, confirme áreas seguras, gestos de rolagem, teclado, modais, vídeos e acessibilidade.
10. Antes do merge, execute os testes reais de contratação, aceite, atualização de status e pagamentos, pois a compilação não valida o backend.

## Escopo preservado

Não foram alterados `ThemeContext`, hooks de autenticação, contratos de API, endpoints FastAPI, tabelas MySQL ou regras do carrinho, de mensagens, de contratação e de pagamento. Os arquivos JSX/TSX foram ajustados visualmente, mantendo funções, ações e navegação.
