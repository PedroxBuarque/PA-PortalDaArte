-- Execute no SQL Editor do projeto SUPABASE (PostgreSQL), nao no MySQL.
-- O login continua na API Python. Somente ela utiliza a chave secreta.
-- O nome do bucket deve coincidir com SUPABASE_PORTFOLIO_BUCKET no .env.
-- Este script pode ser executado novamente e nao exclui arquivos existentes.

BEGIN;

INSERT INTO storage.buckets
    (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'portfolios',
    'portfolios',
    false,
    52428800,
    ARRAY[
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RESTRICTIVE impede que outra policy permissiva libere este bucket.
-- Nao concede nem retira acesso a objetos de outros buckets.
-- A service_role da chave secreta da API ignora RLS por design do Supabase.
-- A API, por isso, valida o JWT do Portal da Arte e a propriedade de cada item.
DROP POLICY IF EXISTS "portal_portfolios_apenas_backend" ON storage.objects;
CREATE POLICY "portal_portfolios_apenas_backend"
ON storage.objects
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (bucket_id <> 'portfolios')
WITH CHECK (bucket_id <> 'portfolios');

COMMIT;

-- As pastas <usuario_id>/ aparecem no Storage no primeiro envio daquele usuario.
-- Nao crie policies permissivas baseadas em auth.uid() para este fluxo:
-- os usuarios atuais autenticam no MySQL/API, e nao no Supabase Auth.
