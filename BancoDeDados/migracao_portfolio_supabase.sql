-- Execute no MySQL do Portal da Arte, NÃO no SQL Editor do Supabase.
-- Para uma base que já possui usuários, use esta migração em vez de reimportar BD.sql.
-- Se DB_NAME no .env tiver outro nome, ajuste a instrução USE abaixo.
-- Esta migração não apaga tabelas, usuários nem trabalhos existentes.
-- Pode ser executada novamente: enum e colunas já presentes são preservados.

USE `portal_da_arte`;

-- Acrescenta pdf no fim do enum sem mudar os índices dos tipos já existentes.
SET @portfolio_tipo_atual = (
    SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'itens_portfolio'
      AND COLUMN_NAME = 'tipo_midia'
);
SET @portfolio_ddl = IF(
    LOCATE('''pdf''', @portfolio_tipo_atual) > 0,
    'SELECT ''tipo_midia já aceita PDF'' AS migracao_portfolio',
    CONCAT(
        'ALTER TABLE `itens_portfolio` MODIFY COLUMN `tipo_midia` ',
        LEFT(@portfolio_tipo_atual, CHAR_LENGTH(@portfolio_tipo_atual) - 1),
        ',''pdf'') COLLATE utf8mb4_unicode_ci NOT NULL'
    )
);
PREPARE portfolio_stmt FROM @portfolio_ddl;
EXECUTE portfolio_stmt;
DEALLOCATE PREPARE portfolio_stmt;

SET @portfolio_ddl = IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'itens_portfolio' AND COLUMN_NAME = 'arquivo_nome'),
    'SELECT ''arquivo_nome já existe'' AS migracao_portfolio',
    'ALTER TABLE `itens_portfolio` ADD COLUMN `arquivo_nome` VARCHAR(255) COLLATE utf8mb4_unicode_ci NULL AFTER `midia_url`'
);
PREPARE portfolio_stmt FROM @portfolio_ddl;
EXECUTE portfolio_stmt;
DEALLOCATE PREPARE portfolio_stmt;

SET @portfolio_ddl = IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'itens_portfolio' AND COLUMN_NAME = 'arquivo_mime'),
    'SELECT ''arquivo_mime já existe'' AS migracao_portfolio',
    'ALTER TABLE `itens_portfolio` ADD COLUMN `arquivo_mime` VARCHAR(100) COLLATE utf8mb4_unicode_ci NULL AFTER `arquivo_nome`'
);
PREPARE portfolio_stmt FROM @portfolio_ddl;
EXECUTE portfolio_stmt;
DEALLOCATE PREPARE portfolio_stmt;

SET @portfolio_ddl = IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'itens_portfolio' AND COLUMN_NAME = 'arquivo_tamanho'),
    'SELECT ''arquivo_tamanho já existe'' AS migracao_portfolio',
    'ALTER TABLE `itens_portfolio` ADD COLUMN `arquivo_tamanho` BIGINT UNSIGNED NULL AFTER `arquivo_mime`'
);
PREPARE portfolio_stmt FROM @portfolio_ddl;
EXECUTE portfolio_stmt;
DEALLOCATE PREPARE portfolio_stmt;

SET @portfolio_ddl = IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'itens_portfolio' AND COLUMN_NAME = 'secao'),
    'SELECT ''secao já existe'' AS migracao_portfolio',
    'ALTER TABLE `itens_portfolio` ADD COLUMN `secao` ENUM(''portfolio'',''video'') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''portfolio'' AFTER `arquivo_tamanho`'
);
PREPARE portfolio_stmt FROM @portfolio_ddl;
EXECUTE portfolio_stmt;
DEALLOCATE PREPARE portfolio_stmt;

SET @portfolio_ddl = IF(
    EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'itens_portfolio' AND COLUMN_NAME = 'capa_url'),
    'SELECT ''capa_url já existe'' AS migracao_portfolio',
    'ALTER TABLE `itens_portfolio` ADD COLUMN `capa_url` VARCHAR(255) COLLATE utf8mb4_unicode_ci NULL AFTER `secao`'
);
PREPARE portfolio_stmt FROM @portfolio_ddl;
EXECUTE portfolio_stmt;
DEALLOCATE PREPARE portfolio_stmt;

SELECT 'Migração do portfólio concluída. Agora configure o bucket privado no Supabase.' AS resultado;
