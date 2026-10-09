-- =========================================================
-- PORTAL DA ARTE
-- Script de criação do banco de dados (MySQL 8+)
-- Baseado no Product Backlog "Portal da Arte" (78 histórias)
-- Organizado por domínios, alinhado à arquitetura
-- React Native + FastAPI + SQLAlchemy/Alembic + MySQL
--
-- IMPORTANTE: seguindo a recomendação do documento de
-- arquitetura, a lógica de negócio (ex: bloquear admin de
-- virar artista, atualizar contadores, revogar sessões ao
-- trocar senha) fica no service.py do FastAPI, não em
-- triggers do banco. Aqui só entram constraints estruturais
-- (FKs, UNIQUE, CHECK) que o próprio banco deve garantir.
-- =========================================================

CREATE DATABASE IF NOT EXISTS portal_da_arte
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE portal_da_arte;

-- =========================================================
-- DOMÍNIO: IDENTIDADE — HU01, HU02, HU03
-- =========================================================

CREATE TABLE usuarios (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_publico          CHAR(36)        NOT NULL UNIQUE,   -- UUID exposto na API
    email               VARCHAR(255)    NOT NULL,
    email_normalizado   VARCHAR(255)    NOT NULL UNIQUE,   -- lowercase/trim, evita contas duplicadas
    senha_hash          VARCHAR(255)    NOT NULL,          -- Argon2id
    status              ENUM('pendente_verificacao', 'ativo', 'bloqueado', 'suspenso', 'excluido')
                            NOT NULL DEFAULT 'pendente_verificacao',
    email_verificado_em DATETIME,
    criado_em           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                         ON UPDATE CURRENT_TIMESTAMP,
    ultimo_login_em     DATETIME
) ENGINE=InnoDB;

-- Papéis administrativos/operacionais, simplificado a dois níveis
-- (usuario comum e admin, que cuida de tudo: suporte, moderação,
-- indicadores e configuração de segurança). Dá pra abrir em mais
-- papéis (suporte, gestor) depois, se a equipe crescer e precisar
-- de permissões separadas — a tabela já está pronta pra isso.
-- NÃO inclui "artista": artista é uma condição derivada da
-- existência de uma linha em perfis_artista (ver domínio ARTISTA),
-- não um papel fixo, conforme a observação funcional do backlog.
CREATE TABLE papeis (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    nome                VARCHAR(50)     NOT NULL UNIQUE,   -- usuario, admin
    descricao           VARCHAR(255)
) ENGINE=InnoDB;

CREATE TABLE usuario_papeis (
    usuario_id          BIGINT NOT NULL,
    papel_id            INT NOT NULL,
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, papel_id),
    CONSTRAINT fk_usuario_papeis_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_usuario_papeis_papel FOREIGN KEY (papel_id) REFERENCES papeis(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Uma linha por dispositivo logado — permite logout seletivo (HU02)
CREATE TABLE sessoes (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario_id          BIGINT NOT NULL,
    hash_refresh_token  VARCHAR(255) NOT NULL,
    id_dispositivo      VARCHAR(150),
    nome_dispositivo    VARCHAR(150),
    plataforma          VARCHAR(50),
    endereco_ip         VARCHAR(45),
    user_agent          VARCHAR(255),
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultimo_uso_em       DATETIME,
    expira_em           DATETIME NOT NULL,
    revogado_em         DATETIME,
    CONSTRAINT fk_sessoes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- HU01 (verificação de e-mail) e HU03 (redefinição de senha) fundidos:
-- mesma forma, mesmo ciclo de vida (gera, expira, usa uma vez), só muda o "tipo".
CREATE TABLE tokens_usuario (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario_id          BIGINT NOT NULL,
    tipo                ENUM('verificacao_email', 'redefinicao_senha') NOT NULL,
    hash_token          VARCHAR(255) NOT NULL,
    expira_em           DATETIME NOT NULL,
    usado_em            DATETIME,
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_token_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- HU74 (admin acessa trilha de auditoria)
CREATE TABLE eventos_auditoria (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario_id          BIGINT,             -- pode ser NULL (ex: tentativa de login falha sem match de email)
    tipo_evento         VARCHAR(100) NOT NULL,   -- USUARIO_CADASTRADO, LOGIN_SUCESSO, SENHA_REDEFINIDA...
    tipo_entidade       VARCHAR(100),
    id_entidade         VARCHAR(100),
    endereco_ip         VARCHAR(45),
    user_agent          VARCHAR(255),
    metadados           JSON,
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =========================================================
-- DOMÍNIO: PERFIL — HU04, HU05, HU26
-- Dados pessoais/exibição, separados da identidade de login.
-- CPF/CNPJ mora aqui: pertence à pessoa por trás da conta,
-- não a um papel específico (artista ou contratante).
-- =========================================================

CREATE TABLE perfis (
    usuario_id          BIGINT PRIMARY KEY,
    nome_completo       VARCHAR(150) NOT NULL,
    foto_perfil_url     VARCHAR(255),
    telefone            VARCHAR(20),
    cidade              VARCHAR(100),
    estado              CHAR(2),
    tipo_documento      ENUM('cpf', 'cnpj') NOT NULL,
    cpf                 CHAR(11),
    cnpj                CHAR(14),
    atualizado_em       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                                         ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_perfil_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT uq_perfis_cpf  UNIQUE (cpf),
    CONSTRAINT uq_perfis_cnpj UNIQUE (cnpj),
    CONSTRAINT chk_perfil_documento CHECK (
        (tipo_documento = 'cpf'  AND cpf  IS NOT NULL AND cnpj IS NULL) OR
        (tipo_documento = 'cnpj' AND cnpj IS NOT NULL AND cpf  IS NULL)
    )
) ENGINE=InnoDB;

-- HU26 (parte de privacidade/preferências de conta)
CREATE TABLE configuracoes_acessibilidade (
    usuario_id          BIGINT PRIMARY KEY,
    tema                ENUM('claro', 'escuro', 'alto_contraste') NOT NULL DEFAULT 'claro',
    tamanho_fonte       ENUM('pequeno', 'medio', 'grande') NOT NULL DEFAULT 'medio',
    leitor_de_tela      BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_acessibilidade_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================================================
-- DOMÍNIO: ARTISTA — HU06, HU08, HU09, HU27–HU51, HU68
-- =========================================================

-- Categorias e subcategorias de arte (autorreferente) — HU09, HU68
CREATE TABLE categorias (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    categoria_pai_id    INT,
    nome                VARCHAR(100) NOT NULL,
    descricao           VARCHAR(255),
    ativo               BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_categoria_pai FOREIGN KEY (categoria_pai_id)
        REFERENCES categorias(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Existir aqui = "ser artista". Não há flag is_artista em usuarios/perfis.
CREATE TABLE perfis_artista (
    usuario_id                   BIGINT PRIMARY KEY,
    nome_artistico               VARCHAR(150) NOT NULL,
    biografia                    TEXT,
    anos_experiencia             SMALLINT UNSIGNED,
    modalidade_atendimento       ENUM('presencial', 'remoto', 'ambos') NOT NULL DEFAULT 'ambos',
    cidade_atendimento           VARCHAR(100),
    estado_atendimento           CHAR(2),
    status_verificacao           ENUM('nao_iniciada', 'pendente', 'aprovada', 'rejeitada')
                                    NOT NULL DEFAULT 'nao_iniciada',           -- HU48
    aceitando_novas_solicitacoes BOOLEAN NOT NULL DEFAULT TRUE,               -- HU50 (pausar sem apagar histórico)
    nota_media                   DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    total_contratacoes           INT UNSIGNED NOT NULL DEFAULT 0,             -- mantido pelo service, não por trigger
    criado_em                    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_perfil_artista_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE artista_categorias (
    artista_id          BIGINT NOT NULL,
    categoria_id        INT NOT NULL,
    PRIMARY KEY (artista_id, categoria_id),
    CONSTRAINT fk_artista_cat_artista FOREIGN KEY (artista_id)
        REFERENCES perfis_artista(usuario_id) ON DELETE CASCADE,
    CONSTRAINT fk_artista_cat_categoria FOREIGN KEY (categoria_id)
        REFERENCES categorias(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Catálogo de serviços do artista — HU12, HU33, HU34
CREATE TABLE servicos (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    artista_id          BIGINT NOT NULL,
    categoria_id        INT,
    titulo              VARCHAR(150) NOT NULL,
    descricao           TEXT,
    preco_min           DECIMAL(10,2),
    preco_max           DECIMAL(10,2),
    prazo_estimado_dias SMALLINT UNSIGNED,
    modalidade          ENUM('presencial', 'remoto', 'ambos') NOT NULL DEFAULT 'ambos',
    ativo               BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_servico_artista FOREIGN KEY (artista_id)
        REFERENCES perfis_artista(usuario_id) ON DELETE CASCADE,
    CONSTRAINT fk_servico_categoria FOREIGN KEY (categoria_id)
        REFERENCES categorias(id) ON DELETE SET NULL,
    CONSTRAINT chk_servico_preco CHECK (preco_max IS NULL OR preco_min IS NULL OR preco_max >= preco_min)
) ENGINE=InnoDB;

-- Agrupamento do portfólio: projetos, álbuns, coleções — HU31
CREATE TABLE portfolios (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    artista_id          BIGINT NOT NULL,
    titulo              VARCHAR(150) NOT NULL,
    descricao           TEXT,
    tipo                ENUM('projeto', 'album', 'colecao') NOT NULL DEFAULT 'projeto',
    ordem               SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    publicado           BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_portfolio_artista FOREIGN KEY (artista_id)
        REFERENCES perfis_artista(usuario_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Itens de mídia do portfólio — HU11, HU30
CREATE TABLE itens_portfolio (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    portfolio_id        BIGINT NOT NULL,
    tipo_midia          ENUM('imagem', 'video', 'audio', 'texto') NOT NULL,
    midia_url           VARCHAR(255) NOT NULL,
    titulo              VARCHAR(150),
    descricao           TEXT,
    ordem               SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_item_portfolio_portfolio FOREIGN KEY (portfolio_id)
        REFERENCES portfolios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Agenda de disponibilidade do artista — HU08, HU34
CREATE TABLE disponibilidade_artista (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    artista_id          BIGINT NOT NULL,
    data                DATE NOT NULL,
    hora_inicio         TIME NOT NULL,
    hora_fim            TIME NOT NULL,
    status              ENUM('disponivel', 'reservado') NOT NULL DEFAULT 'disponivel',
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_disponibilidade_artista FOREIGN KEY (artista_id)
        REFERENCES perfis_artista(usuario_id) ON DELETE CASCADE,
    CONSTRAINT uq_disponibilidade_horario UNIQUE (artista_id, data, hora_inicio)
) ENGINE=InnoDB;

-- Documentos enviados para a verificação de identidade — HU48
-- (o resultado consolidado fica em perfis_artista.status_verificacao;
-- aqui fica o histórico de cada documento enviado e sua análise)
CREATE TABLE documentos_verificacao (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    artista_id          BIGINT NOT NULL,
    tipo_documento       ENUM('rg', 'cnh', 'cpf', 'cnpj', 'comprovante_endereco', 'outro') NOT NULL,
    arquivo_url         VARCHAR(255) NOT NULL,
    status              ENUM('pendente', 'aprovado', 'rejeitado') NOT NULL DEFAULT 'pendente',
    motivo_rejeicao     VARCHAR(255),
    analisado_por       BIGINT,
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    analisado_em        DATETIME,
    CONSTRAINT fk_documento_artista FOREIGN KEY (artista_id)
        REFERENCES perfis_artista(usuario_id) ON DELETE CASCADE,
    CONSTRAINT fk_documento_analista FOREIGN KEY (analisado_por)
        REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Log bruto de visualizações — a fonte real que alimenta
-- metricas_artista_diarias. Um job diário agrega essa tabela
-- e grava o resumo do dia anterior na tabela de métricas;
-- esta aqui não precisa ser consultada diretamente pela API.
CREATE TABLE visualizacoes_perfil_artista (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    artista_id          BIGINT NOT NULL,
    visitante_id        BIGINT,
    tipo                ENUM('perfil', 'portfolio_item', 'servico') NOT NULL,
    referencia_id       BIGINT,             -- id do item/serviço visitado, quando tipo != 'perfil'
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_visualizacao_artista FOREIGN KEY (artista_id)
        REFERENCES perfis_artista(usuario_id) ON DELETE CASCADE,
    CONSTRAINT fk_visualizacao_visitante FOREIGN KEY (visitante_id)
        REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Métricas agregadas por dia para os insights do artista — HU45
CREATE TABLE metricas_artista_diarias (
    artista_id               BIGINT NOT NULL,
    data                     DATE NOT NULL,
    visualizacoes_perfil     INT UNSIGNED NOT NULL DEFAULT 0,
    visualizacoes_trabalhos  INT UNSIGNED NOT NULL DEFAULT 0,
    contatos_recebidos       INT UNSIGNED NOT NULL DEFAULT 0,
    propostas_recebidas      INT UNSIGNED NOT NULL DEFAULT 0,
    contratacoes_fechadas    INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (artista_id, data),
    CONSTRAINT fk_metricas_artista FOREIGN KEY (artista_id)
        REFERENCES perfis_artista(usuario_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================================================
-- DOMÍNIO: MARKETPLACE — HU13–HU22, HU36–HU40, HU52–HU61
-- =========================================================

CREATE TABLE conversas (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    contratante_id      BIGINT NOT NULL,
    artista_id          BIGINT NOT NULL,
    servico_id          BIGINT,
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_conversa_contratante FOREIGN KEY (contratante_id)
        REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_conversa_artista FOREIGN KEY (artista_id)
        REFERENCES perfis_artista(usuario_id) ON DELETE CASCADE,
    CONSTRAINT fk_conversa_servico FOREIGN KEY (servico_id)
        REFERENCES servicos(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE mensagens (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversa_id         BIGINT NOT NULL,
    remetente_id        BIGINT NOT NULL,
    conteudo            TEXT NOT NULL,
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lida                BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_mensagem_conversa FOREIGN KEY (conversa_id)
        REFERENCES conversas(id) ON DELETE CASCADE,
    CONSTRAINT fk_mensagem_remetente FOREIGN KEY (remetente_id)
        REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Negociação — HU15, HU36–HU38, HU53–HU55
CREATE TABLE propostas (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversa_id         BIGINT NOT NULL,
    contratante_id      BIGINT NOT NULL,
    artista_id          BIGINT NOT NULL,
    servico_id          BIGINT,
    descricao_escopo    TEXT NOT NULL,
    local_ou_modalidade VARCHAR(255),
    prazo_estimado      DATE,
    valor_proposto      DECIMAL(10,2) NOT NULL,
    status              ENUM('em_negociacao', 'aceita', 'recusada', 'expirada')
                            NOT NULL DEFAULT 'em_negociacao',
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                                         ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_proposta_conversa FOREIGN KEY (conversa_id)
        REFERENCES conversas(id) ON DELETE CASCADE,
    CONSTRAINT fk_proposta_contratante FOREIGN KEY (contratante_id)
        REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_proposta_artista FOREIGN KEY (artista_id)
        REFERENCES perfis_artista(usuario_id) ON DELETE CASCADE,
    CONSTRAINT fk_proposta_servico FOREIGN KEY (servico_id)
        REFERENCES servicos(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Modelos de contrato versionados pelo admin — HU39, HU71
CREATE TABLE modelos_contrato (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    nome                VARCHAR(150) NOT NULL,
    tipo_pagamento      ENUM('antecipado', 'por_etapas', 'pos_entrega') NOT NULL,
    clausulas           TEXT NOT NULL,
    versao              INT UNSIGNED NOT NULL DEFAULT 1,
    ativo               BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- O contrato formal, distinto da proposta (negociação) — HU39, HU40, HU57
CREATE TABLE contratos (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    proposta_id         BIGINT NOT NULL UNIQUE,
    modelo_id           INT NOT NULL,
    contratante_id      BIGINT NOT NULL,
    artista_id          BIGINT NOT NULL,
    valor_total         DECIMAL(10,2) NOT NULL,
    status              ENUM('aguardando_aceite', 'ativo', 'concluido', 'cancelado', 'em_disputa')
                            NOT NULL DEFAULT 'aguardando_aceite',
    aceito_contratante_em DATETIME,
    aceito_artista_em   DATETIME,
    data_inicio         DATETIME,
    data_conclusao      DATETIME,
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_contrato_proposta FOREIGN KEY (proposta_id)
        REFERENCES propostas(id) ON DELETE CASCADE,
    CONSTRAINT fk_contrato_modelo FOREIGN KEY (modelo_id)
        REFERENCES modelos_contrato(id),
    CONSTRAINT fk_contrato_contratante FOREIGN KEY (contratante_id)
        REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_contrato_artista FOREIGN KEY (artista_id)
        REFERENCES perfis_artista(usuario_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Histórico de mudanças de status do contrato — HU18, HU40, HU57
-- (rastreabilidade de quem mudou o quê e quando, sem sobrescrever
-- o status atual, que continua em contratos.status)
CREATE TABLE historico_contrato (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    contrato_id         BIGINT NOT NULL,
    status_anterior     ENUM('aguardando_aceite', 'ativo', 'concluido', 'cancelado', 'em_disputa'),
    status_novo         ENUM('aguardando_aceite', 'ativo', 'concluido', 'cancelado', 'em_disputa') NOT NULL,
    alterado_por        BIGINT,
    observacao          VARCHAR(255),
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_historico_contrato FOREIGN KEY (contrato_id)
        REFERENCES contratos(id) ON DELETE CASCADE,
    CONSTRAINT fk_historico_alterado_por FOREIGN KEY (alterado_por)
        REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Parcelas do contrato quando o pagamento é "por etapas" — HU39, HU56
CREATE TABLE etapas_contrato (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    contrato_id         BIGINT NOT NULL,
    descricao           VARCHAR(255) NOT NULL,
    valor               DECIMAL(10,2) NOT NULL,
    ordem               SMALLINT UNSIGNED NOT NULL,
    status              ENUM('pendente', 'pago', 'entregue') NOT NULL DEFAULT 'pendente',
    CONSTRAINT fk_etapa_contrato FOREIGN KEY (contrato_id)
        REFERENCES contratos(id) ON DELETE CASCADE,
    CONSTRAINT uq_etapa_ordem UNIQUE (contrato_id, ordem)
) ENGINE=InnoDB;

-- =========================================================
-- DOMÍNIO: FINANCEIRO — HU19–HU21, HU41–HU44, HU58–HU59, HU63
-- =========================================================

CREATE TABLE pagamentos (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    contrato_id         BIGINT NOT NULL,
    etapa_id            BIGINT,
    valor               DECIMAL(10,2) NOT NULL,
    metodo_pagamento    ENUM('pix', 'cartao_credito', 'boleto') NOT NULL,
    status              ENUM('pendente', 'processando', 'pago', 'recusado', 'estornado')
                            NOT NULL DEFAULT 'pendente',
    codigo_referencia   VARCHAR(255),     -- linha digitável do boleto, payload do QR Code, etc.
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    pago_em             DATETIME,
    CONSTRAINT fk_pagamento_contrato FOREIGN KEY (contrato_id)
        REFERENCES contratos(id) ON DELETE CASCADE,
    CONSTRAINT fk_pagamento_etapa FOREIGN KEY (etapa_id)
        REFERENCES etapas_contrato(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Log bruto de eventos do gateway de pagamento — HU72 (admin monitora integração)
CREATE TABLE eventos_pagamento (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    pagamento_id        BIGINT NOT NULL,
    evento              VARCHAR(100) NOT NULL,
    payload             JSON,
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_evento_pagamento_pagamento FOREIGN KEY (pagamento_id)
        REFERENCES pagamentos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Nota fiscal eletrônica — HU43, HU44, HU63, HU73
CREATE TABLE notas_fiscais (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    contrato_id         BIGINT NOT NULL,
    pagamento_id        BIGINT,
    numero_nota         VARCHAR(100),
    status              ENUM('pendente', 'emitida', 'cancelada', 'erro') NOT NULL DEFAULT 'pendente',
    arquivo_url         VARCHAR(255),
    emitida_em          DATETIME,
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_nota_fiscal_contrato FOREIGN KEY (contrato_id)
        REFERENCES contratos(id) ON DELETE CASCADE,
    CONSTRAINT fk_nota_fiscal_pagamento FOREIGN KEY (pagamento_id)
        REFERENCES pagamentos(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =========================================================
-- AVALIAÇÕES — HU23, HU24, HU46, HU47, HU62
-- =========================================================

CREATE TABLE avaliacoes (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    contrato_id         BIGINT NOT NULL,
    avaliador_id        BIGINT NOT NULL,
    avaliado_id         BIGINT NOT NULL,
    nota                TINYINT UNSIGNED NOT NULL,
    comentario          TEXT,
    resposta_publica    TEXT,               -- HU47: artista responde publicamente
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_avaliacao_contrato FOREIGN KEY (contrato_id)
        REFERENCES contratos(id) ON DELETE CASCADE,
    CONSTRAINT fk_avaliacao_avaliador FOREIGN KEY (avaliador_id)
        REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_avaliacao_avaliado FOREIGN KEY (avaliado_id)
        REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT chk_avaliacao_nota CHECK (nota BETWEEN 1 AND 5),
    CONSTRAINT uq_avaliacao_par UNIQUE (contrato_id, avaliador_id)
) ENGINE=InnoDB;

-- =========================================================
-- DOMÍNIO: CONFIANÇA E SEGURANÇA — HU25, HU49, HU51, HU64, HU67, HU70
-- =========================================================

-- denuncias, disputas e chamados_suporte fundidos: as três são a
-- mesma forma (quem abriu, motivo, status, admin responsável,
-- resolução), só muda o "tipo" e, no caso da disputa, o contrato
-- envolvido — HU25, HU49, HU51, HU64, HU70
CREATE TABLE ocorrencias (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    tipo                ENUM('denuncia', 'disputa', 'suporte') NOT NULL,
    aberto_por_id       BIGINT NOT NULL,
    contrato_id         BIGINT,             -- obrigatório para disputa; opcional nos demais
    tipo_alvo           ENUM('usuario', 'item_portfolio', 'mensagem', 'contrato'),  -- só para denuncia
    alvo_id             BIGINT,             -- só para denuncia
    assunto             VARCHAR(150),       -- motivo (denuncia/disputa) ou assunto (suporte)
    descricao           TEXT NOT NULL,
    resposta            TEXT,               -- resolução da disputa ou resposta do suporte
    status              ENUM('aberta', 'em_analise', 'resolvida', 'indeferida', 'arquivada')
                            NOT NULL DEFAULT 'aberta',
    admin_responsavel_id BIGINT,
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolvido_em        DATETIME,
    CONSTRAINT fk_ocorrencia_aberto_por FOREIGN KEY (aberto_por_id)
        REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_ocorrencia_contrato FOREIGN KEY (contrato_id)
        REFERENCES contratos(id) ON DELETE CASCADE,
    CONSTRAINT fk_ocorrencia_admin FOREIGN KEY (admin_responsavel_id)
        REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- HU78 — solicitações de exclusão/correção de dados (LGPD)
CREATE TABLE solicitacoes_dados (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario_id          BIGINT NOT NULL,
    tipo                ENUM('exclusao', 'correcao', 'portabilidade') NOT NULL,
    descricao           TEXT,
    status              ENUM('pendente', 'em_andamento', 'concluida', 'negada') NOT NULL DEFAULT 'pendente',
    admin_responsavel_id BIGINT,
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolvido_em        DATETIME,
    CONSTRAINT fk_solicitacao_dados_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_solicitacao_dados_admin FOREIGN KEY (admin_responsavel_id)
        REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =========================================================
-- DOMÍNIO: NOTIFICAÇÃO — HU16, HU26, HU77
-- =========================================================

CREATE TABLE notificacoes (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario_id          BIGINT NOT NULL,
    tipo                VARCHAR(100) NOT NULL,     -- nova_mensagem, proposta_recebida, pagamento_confirmado...
    titulo              VARCHAR(150) NOT NULL,
    conteudo            TEXT,
    lida                BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notificacao_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE preferencias_notificacao (
    usuario_id          BIGINT PRIMARY KEY,
    email_ativado       BOOLEAN NOT NULL DEFAULT TRUE,
    push_ativado        BOOLEAN NOT NULL DEFAULT TRUE,
    tipos_desativados   JSON,               -- lista de tipos que o usuário silenciou
    CONSTRAINT fk_preferencia_notif_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================================================
-- DOMÍNIO: ADMIN / SEGURANÇA — HU66, HU75, HU76
-- =========================================================

-- Configuração chave-valor para limites, bloqueios e regras
-- antifraude (HU76) — mantém o schema estável mesmo quando
-- novas regras forem adicionadas, sem migration a cada uma.
CREATE TABLE regras_seguranca (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    chave               VARCHAR(100) NOT NULL UNIQUE,
    valor               VARCHAR(255) NOT NULL,
    descricao           VARCHAR(255),
    atualizado_por      BIGINT,
    atualizado_em       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                                         ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_regra_seguranca_admin FOREIGN KEY (atualizado_por)
        REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Indicadores gerais (HU75) normalmente são calculados sob
-- demanda com queries agregadas sobre as tabelas acima; não
-- precisam de tabela própria além de, opcionalmente, um
-- snapshot diário para histórico de crescimento:
CREATE TABLE metricas_plataforma_diarias (
    data                    DATE PRIMARY KEY,
    total_usuarios          INT UNSIGNED NOT NULL DEFAULT 0,
    total_artistas          INT UNSIGNED NOT NULL DEFAULT 0,
    total_contratacoes      INT UNSIGNED NOT NULL DEFAULT 0,
    total_pagamentos        INT UNSIGNED NOT NULL DEFAULT 0,
    total_cancelamentos     INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- =========================================================
-- ÍNDICES DE APOIO (busca, filtros e telas mais consultadas)
-- =========================================================
CREATE INDEX idx_perfil_artista_verificacao   ON perfis_artista(status_verificacao);
CREATE INDEX idx_perfil_artista_nota          ON perfis_artista(nota_media);
CREATE INDEX idx_perfil_artista_contratacoes  ON perfis_artista(total_contratacoes);
CREATE INDEX idx_servicos_categoria           ON servicos(categoria_id);
CREATE INDEX idx_servicos_ativo               ON servicos(ativo);
CREATE INDEX idx_propostas_status             ON propostas(status);
CREATE INDEX idx_contratos_status             ON contratos(status);
CREATE INDEX idx_pagamentos_status            ON pagamentos(status);
CREATE INDEX idx_ocorrencias_status           ON ocorrencias(status);
CREATE INDEX idx_ocorrencias_tipo             ON ocorrencias(tipo);
CREATE INDEX idx_notificacoes_usuario_lida    ON notificacoes(usuario_id, lida);
CREATE INDEX idx_perfis_cidade_estado         ON perfis(cidade, estado);
CREATE INDEX idx_disponibilidade_data         ON disponibilidade_artista(artista_id, data);
CREATE INDEX idx_documentos_verificacao_status ON documentos_verificacao(status);
CREATE INDEX idx_historico_contrato_contrato  ON historico_contrato(contrato_id);
CREATE INDEX idx_visualizacoes_artista_data   ON visualizacoes_perfil_artista(artista_id, criado_em);

-- =========================================================
-- SEED MÍNIMO
-- =========================================================
INSERT INTO papeis (nome, descricao) VALUES
    ('usuario', 'Usuário comum, sem privilégios administrativos'),
    ('admin',   'Administração completa da plataforma: suporte, moderação, indicadores e segurança');

-- HU76 — regras iniciais de segurança/antifraude (valores de partida,
-- ajustáveis pelo admin sem precisar de deploy)
INSERT INTO regras_seguranca (chave, valor, descricao) VALUES
    ('max_tentativas_login_por_hora',     '5',    'Bloqueia login temporariamente após N tentativas falhas em 1h'),
    ('max_denuncias_por_usuario_dia',     '3',    'Limite de denúncias que um mesmo usuário pode abrir por dia'),
    ('valor_max_proposta_sem_verificacao','5000', 'Valor máximo de proposta aceito de artista ainda não verificado (HU48)'),
    ('prazo_expiracao_proposta_dias',     '7',    'Dias até uma proposta em negociação expirar automaticamente'),
    ('prazo_expiracao_token_horas',       '24',   'Validade padrão de tokens de verificação/redefinição de senha');