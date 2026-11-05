"""Diagnostico de leitura: configuracao, bucket privado e migracao MySQL.

Execute: python verificar_supabase.py
Nao faz uploads, nao altera tabelas e nao imprime credenciais.
"""

import os
from pathlib import Path

import mysql.connector
from dotenv import load_dotenv

from portfolio_storage import (
    PortfolioStorageError,
    SupabasePortfolioStorage,
    carregar_config_storage,
)


def main():
    load_dotenv(Path(__file__).with_name(".env"), encoding="utf-8-sig", override=False)
    falhas = 0
    try:
        config = carregar_config_storage()
        storage = SupabasePortfolioStorage(config)
        bucket = storage.verificar_bucket_privado()
        print(f"OK: Supabase acessivel; bucket privado '{config.bucket}'.")
        print(f"OK: limite da API: {config.max_bytes // (1024 * 1024)} MiB por arquivo.")
        limite_bucket = bucket.get("file_size_limit")
        if isinstance(limite_bucket, (int, float)) and limite_bucket < config.max_bytes:
            print("ATENCAO: o limite do bucket e menor que o da API. Ajuste ambos para o mesmo valor.")
    except PortfolioStorageError as exc:
        print(f"FALHA no Supabase: {exc.detail}")
        falhas += 1
    except Exception:
        print("FALHA no Supabase: nao foi possivel concluir o diagnostico. Verifique a configuracao e a rede.")
        falhas += 1

    conexao = None
    cursor = None
    try:
        conexao = mysql.connector.connect(
            host=os.getenv("DB_HOST", "127.0.0.1"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", ""),
            database=os.getenv("DB_NAME", "portal_da_arte"),
            connection_timeout=10,
        )
        cursor = conexao.cursor(dictionary=True)
        cursor.execute(
            "SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'itens_portfolio'"
        )
        colunas = {row["COLUMN_NAME"]: row["COLUMN_TYPE"] for row in cursor.fetchall()}
        campos = {"arquivo_nome", "arquivo_mime", "arquivo_tamanho", "secao", "capa_url"}
        if not campos.issubset(colunas) or "'pdf'" not in colunas.get("tipo_midia", ""):
            print("FALHA no MySQL: aplique BancoDeDados/migracao_portfolio_supabase.sql no banco existente.")
            falhas += 1
        else:
            print("OK: banco MySQL com os campos de arquivo e suporte a PDF.")
    except mysql.connector.Error:
        print("FALHA no MySQL: confira DB_HOST, DB_USER, DB_PASSWORD, DB_NAME e se o servidor esta ativo.")
        falhas += 1
    finally:
        if cursor is not None:
            cursor.close()
        if conexao is not None:
            conexao.close()

    if falhas:
        print("Corrija os itens acima e execute novamente. Nenhum arquivo foi enviado ou excluido.")
        return 1
    print("Configuracao pronta para testar o envio pela tela de Portfolio.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
