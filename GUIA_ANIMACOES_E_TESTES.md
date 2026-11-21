# Portal da Arte — animações e microinterações

**Base utilizada:** `PA-PortaldaArte(1).zip` enviada nesta conversa. A versão original foi preservada; somente seis arquivos foram editados e um componente foi criado.

## Abordagem técnica

- Utilizado **`Animated` nativo do React Native** com `Easing.out(Easing.cubic)`; não há novas dependências e `react-native-reanimated` existente não foi removido.
- Transições curtas, de **95–240 ms**, com `opacity`, `translateX`, `translateY` e `scale`. Sem loops, sem recalcular `width`/`height` quadro a quadro.
- Driver nativo para iOS/Android, driver JS no Web (evita warnings do RN Web). `isInteraction: false` nas transições de listas para não atrasar `FlatList`.
- Respeita **redução de movimento**: `prefers-reduced-motion` (Web) e `AccessibilityInfo.isReduceMotionEnabled` (Mobile). Um único listener global, não um por card.
- Stagger limitado a **10 primeiros cards** por listagem; delay limitado a 238 ms; cartões adicionais não recebem animação de entrada para evitar trabalho em listas grandes.
- `ThemeContext`, `useTheme`, cores, lógica de contratação, favoritos, carrinho, mensagens, autenticação, rotas e `python-api` **inalterados**.

## Arquivos e alterações

| Caminho a partir de `PA-PortalDaArte` | Resultado |
|---|---|
| `src/components/animations/Motion.tsx` | **Novo**. `FadeSlide`, `PressMotion`, `MotionPresence`, `StatePulse`, `ModalMotionTouchable`; detector de movimento reduzido. |
| `src/app/pages/explorar/explorar.tsx` | Stagger dos artistas; botões de perfil, carrinho e coração com feedback; pulso do favorito; menu de ordenação com entrada/saída; filtros expansíveis com fade; modal de filtros e localização com transições. |
| `src/app/pages/favoritos/favoritos.tsx` | Entrada dos cards e feedback nos botões Contratar e remover favorito. |
| `src/app/pages/contratacoes/contratacoes.tsx` | Entrada dos cards (sem reiniciar a cada polling de 4 segundos), feedback e pulso dos chips de status e botão Atualizar. |
| `src/components/contratacoes/CardContratacao.tsx` | Escala 0,987 no toque do card, sem alterar navegação. |
| `src/components/Sidebar.jsx` | Feedback ao clicar e pulso no ícone da seção ativa; visual e rotas preservados. |
| `src/components/Header.tsx` | Feedback dos controles do topo; fade + deslocamento sutil nos conteúdos dos menus e gaveta; elementos continuam com as posições originais. |

## Instalação

**Opção 1: ZIP completo** — extrair a pasta `PA-PortalDaArte`, configurar seus `.env` locais e, dentro dela, executar `npm ci` (ou `npm install` se seu lockfile estiver inconsistente), depois `npx expo start --web` / `npx expo start`. O ZIP não inclui `node_modules`, `.git`, ambientes virtuais nem credenciais.

**Opção 2: ZIP de alterações** — copiar os sete arquivos para as mesmas pastas do seu projeto (criando `src/components/animations/`), preservando todo o resto. Faça backup ou commit antes.

**Opção 3: patch Git** — a partir de `PA-PortalDaArte`, executar `git apply --check ../Portal_da_Arte_Animacoes.patch` e `git apply ../Portal_da_Arte_Animacoes.patch` (ajuste o caminho do `.patch` conforme onde o salvou).

## Verificações automatizadas feitas

- `tsc --noEmit` no projeto completo: **passou, 0 erros**.
- Transformação `babel-preset-expo` em cada um dos sete arquivos: **passou**.
- ESLint nos arquivos: **0 erros**; avisos preexistentes de `explorar.tsx` sobre tipo array, variável e dependência de um hook.
- Comparação com o ZIP de origem: **todos os outros arquivos são byte a byte iguais aos originais**.
- Exportação `expo export --platform web`: iniciada, mas **não terminou dentro do limite de execução**; não conta como teste aprovado.
- Não foram executados testes visuais interativos em navegador/celular ou com API/MySQL; estes itens precisam de validação no seu ambiente.

## Checklist de aceite manual

1. **Explorar** — carregar artistas; confirmar entrada breve e rolagem fluida. Alterar categoria/ordenação, clicar em Ver serviços e adicionar ao carrinho. Confirmar que menu de ordenar abre **sobre** o catálogo e os cliques funcionam.
2. **Favoritos** — favoritar um artista e ir para Favoritos; confirmar entrada suave dos cards. Acionar Contratar e remover favorito, sem toque duplo/navegação involuntária.
3. **Contratações** — listar propostas reais; alternar Pendente / Confirmado / Concluído / Todas, abrir detalhes; confirmar que polling de 4s **não provoca piscadas dos cards**. Atualizar manualmente.
4. **Filtros (desktop largo)** — mostrar/ocultar painel, expandir/recolher seções e arrastar slider; verificar que o grid mantém largura correta e não corta artistas.
5. **Filtros (tela estreita)** — abrir/fechar modal e seleção de localização; garantir rolagem, campos, foco e botões clicáveis.
6. **Header e Sidebar** — navegar pelas seções, abrir menus de notificações, configurações, perfil e gaveta mobile; garantir que menus não sejam cortados e fechem ao tocar fora.
7. **Temas** — alternar Light/Dark/alto contraste; verificar que nenhuma cor foi fixada nas animações.
8. **Acessibilidade** — ativar Preferir movimento reduzido no sistema; verificar ausência de animações decorativas.
9. **Regressão** — com duas contas, testar envio e aceite da proposta, mensagens, listagem de Contratações, carrinho e pagamento (não modificados neste pacote).

## Observações

Animações não alteram métodos HTTP, tabelas MySQL nem dados de domínio. Foi mantido o `animationType="fade"` nativo nos modais, com microtransições internas nos conteúdos. Se o `npx expo export` demorar muito, execute no ambiente local; o limite de tempo do ambiente de construção impediu completar o teste nesta entrega.
