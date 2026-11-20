-- Portal da Arte - Carrinho + Checkout Asaas
-- Aplicar no MySQL existente antes de usar o checkout.

CREATE TABLE IF NOT EXISTS pedidos_carrinho (
  id BIGINT NOT NULL AUTO_INCREMENT,
  contratante_id BIGINT NOT NULL,
  checkout_externo_id VARCHAR(100) DEFAULT NULL,
  status ENUM('criando','aguardando_pagamento','pago','cancelado','expirado','erro') NOT NULL DEFAULT 'criando',
  valor_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  pago_em DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pedido_checkout (checkout_externo_id),
  KEY idx_pedido_contratante (contratante_id),
  KEY idx_pedido_status (status),
  CONSTRAINT fk_pedido_contratante FOREIGN KEY (contratante_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pedido_carrinho_itens (
  id BIGINT NOT NULL AUTO_INCREMENT,
  pedido_id BIGINT NOT NULL,
  servico_id BIGINT NOT NULL,
  artista_id BIGINT NOT NULL,
  titulo VARCHAR(150) NOT NULL,
  descricao TEXT DEFAULT NULL,
  modalidade VARCHAR(30) DEFAULT NULL,
  valor_unitario DECIMAL(12,2) NOT NULL,
  proposta_id BIGINT DEFAULT NULL,
  contrato_id BIGINT DEFAULT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pedido_servico (pedido_id, servico_id),
  KEY idx_item_pedido (pedido_id),
  KEY idx_item_servico (servico_id),
  KEY idx_item_artista (artista_id),
  CONSTRAINT fk_item_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos_carrinho(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_servico FOREIGN KEY (servico_id) REFERENCES servicos(id),
  CONSTRAINT fk_item_artista FOREIGN KEY (artista_id) REFERENCES perfis_artista(usuario_id),
  CONSTRAINT fk_item_proposta FOREIGN KEY (proposta_id) REFERENCES propostas(id) ON DELETE SET NULL,
  CONSTRAINT fk_item_contrato FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS eventos_asaas_checkout (
  evento_id VARCHAR(100) NOT NULL,
  tipo VARCHAR(80) NOT NULL,
  checkout_id VARCHAR(100) DEFAULT NULL,
  payload_json LONGTEXT NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (evento_id),
  KEY idx_evento_checkout (checkout_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
