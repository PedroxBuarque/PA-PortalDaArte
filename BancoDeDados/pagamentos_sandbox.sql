-- Execute no esquema MySQL existente do Portal da Arte.
CREATE TABLE IF NOT EXISTS `pagamentos` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `contrato_id` bigint(20) NOT NULL,
  `etapa_id` bigint(20) DEFAULT NULL,
  `valor` decimal(10,2) NOT NULL,
  `metodo_pagamento` enum('pix','cartao_credito','boleto') NOT NULL,
  `status` enum('pendente','processando','pago','recusado','estornado') NOT NULL DEFAULT 'pendente',
  `codigo_referencia` varchar(255) DEFAULT NULL,
  `criado_em` datetime NOT NULL DEFAULT current_timestamp(),
  `pago_em` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_pagamento_contrato` (`contrato_id`),
  KEY `fk_pagamento_etapa` (`etapa_id`),
  KEY `idx_pagamentos_status` (`status`),
  CONSTRAINT `fk_pagamento_contrato` FOREIGN KEY (`contrato_id`) REFERENCES `contratos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pagamento_etapa` FOREIGN KEY (`etapa_id`) REFERENCES `etapas_contrato` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS asaas_clientes (
  usuario_id BIGINT NOT NULL PRIMARY KEY,
  asaas_customer_id VARCHAR(100) NOT NULL UNIQUE,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_asaas_cliente_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS asaas_carteiras_artistas (
  artista_id BIGINT NOT NULL PRIMARY KEY,
  wallet_id VARCHAR(100) NOT NULL UNIQUE,
  verificada_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_asaas_carteira_artista FOREIGN KEY (artista_id) REFERENCES perfis_artista(usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS asaas_cobrancas (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  contrato_id BIGINT NOT NULL,
  contratante_id BIGINT NOT NULL,
  artista_id BIGINT NOT NULL,
  pagamento_id BIGINT NULL UNIQUE,
  chave_idempotencia VARCHAR(120) NOT NULL UNIQUE,
  asaas_payment_id VARCHAR(100) NULL UNIQUE,
  valor_servico DECIMAL(10,2) NOT NULL,
  taxa_prevista DECIMAL(10,2) NOT NULL,
  comissao DECIMAL(10,2) NOT NULL,
  valor_total DECIMAL(10,2) NOT NULL,
  valor_artista DECIMAL(10,2) NOT NULL,
  status_externo VARCHAR(50) NOT NULL DEFAULT 'CRIANDO',
  status_split VARCHAR(50) NOT NULL DEFAULT 'AGUARDANDO',
  motivo_falha VARCHAR(150) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_asaas_cobranca_contrato FOREIGN KEY (contrato_id) REFERENCES contratos(id),
  CONSTRAINT fk_asaas_cobranca_contratante FOREIGN KEY (contratante_id) REFERENCES usuarios(id),
  CONSTRAINT fk_asaas_cobranca_artista FOREIGN KEY (artista_id) REFERENCES perfis_artista(usuario_id),
  CONSTRAINT fk_asaas_cobranca_pagamento FOREIGN KEY (pagamento_id) REFERENCES pagamentos(id),
  INDEX idx_asaas_cobranca_contrato (contrato_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS asaas_eventos (
  evento_id VARCHAR(140) NOT NULL PRIMARY KEY,
  tipo VARCHAR(100) NOT NULL,
  asaas_payment_id VARCHAR(100) NULL,
  payload_json JSON NOT NULL,
  recebido_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processado_em DATETIME NULL,
  INDEX idx_asaas_evento_payment (asaas_payment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS asaas_clientes_pendentes (
 usuario_id BIGINT PRIMARY KEY, criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS asaas_notas_fiscais (
 id BIGINT PRIMARY KEY AUTO_INCREMENT, cobranca_id BIGINT NOT NULL UNIQUE,
 referencia VARCHAR(120) NOT NULL UNIQUE, asaas_invoice_id VARCHAR(100) NULL UNIQUE,
 status VARCHAR(50) NOT NULL, valor DECIMAL(10,2) NOT NULL, payload_json JSON NOT NULL,
 pdf_url TEXT NULL, xml_url TEXT NULL,
 criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 atualizado_em DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY (cobranca_id) REFERENCES asaas_cobrancas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
