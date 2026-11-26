-- Portal da Arte - avisos de moderação consultiva (nao bloqueiam o envio).
-- Aplicar no MySQL do projeto. Serve de base para o futuro painel administrativo.
USE `portal_da_arte`;

CREATE TABLE IF NOT EXISTS `moderacao_avisos` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `usuario_id` BIGINT NOT NULL,
  `contexto` VARCHAR(30) NOT NULL,
  `referencia_id` BIGINT DEFAULT NULL,
  `texto_resumo` VARCHAR(500) NOT NULL,
  `categorias_json` JSON NOT NULL,
  `aviso` VARCHAR(500) NOT NULL,
  `resolvido_em` DATETIME DEFAULT NULL,
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_moderacao_usuario` (`usuario_id`, `criado_em`),
  KEY `idx_moderacao_resolvido` (`resolvido_em`),
  CONSTRAINT `fk_moderacao_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
