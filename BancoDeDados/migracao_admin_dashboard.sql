-- Portal da Arte - suporte ao dashboard administrativo.
-- Nao apaga nem expoe dados pessoais. Registra apenas acoes administrativas
-- e visitas anonimas (sem IP em claro, conforme LGPD).
USE `portal_da_arte`;

CREATE TABLE IF NOT EXISTS `admin_acoes` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `admin_id` BIGINT NOT NULL,
  `acao` VARCHAR(80) NOT NULL,
  `entidade` VARCHAR(60) DEFAULT NULL,
  `entidade_id` BIGINT DEFAULT NULL,
  `detalhes` JSON DEFAULT NULL,
  `endereco_ip_hash` CHAR(64) DEFAULT NULL,
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_acoes_admin` (`admin_id`, `criado_em`),
  KEY `idx_admin_acoes_entidade` (`entidade`, `entidade_id`),
  CONSTRAINT `fk_admin_acoes_admin` FOREIGN KEY (`admin_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `visitas_site` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `sessao_hash` CHAR(64) NOT NULL,
  `rota` VARCHAR(160) NOT NULL,
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_visitas_data` (`criado_em`),
  KEY `idx_visitas_sessao` (`sessao_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `visitantes` (
  `sessao_hash` CHAR(64) NOT NULL PRIMARY KEY,
  `primeira_visita` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_visita` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `total_visualizacoes` INT UNSIGNED NOT NULL DEFAULT 1,
  `uf` CHAR(2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
