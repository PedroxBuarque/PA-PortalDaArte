"""Cria (ou promove) o usuario administrador local do dashboard.

Uso: python criar_admin.py
Em producao, defina ADMIN_EMAIL e ADMIN_PASSWORD no ambiente e troque a senha.
"""
import os
import uuid

from main import get_db_connection, hash_senha


def main():
    email = os.getenv("ADMIN_EMAIL", "admin@portaldaarte.local").strip().lower()
    senha = os.getenv("ADMIN_PASSWORD", "AdminLocal123!")
    conexao = get_db_connection()
    cursor = conexao.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id FROM usuarios WHERE email_normalizado = LOWER(%s)", (email,))
        usuario = cursor.fetchone()
        if usuario:
            usuario_id = usuario["id"]
            cursor.execute("UPDATE usuarios SET status = 'ativo', senha_hash = %s WHERE id = %s",
                           (hash_senha(senha), usuario_id))
        else:
            cursor.execute(
                """INSERT INTO usuarios (id_publico, email, email_normalizado, senha_hash, status, email_verificado_em)
                   VALUES (%s, %s, LOWER(%s), %s, 'ativo', NOW())""",
                (str(uuid.uuid4()), email, email, hash_senha(senha)),
            )
            usuario_id = cursor.lastrowid
            cursor.execute(
                """INSERT INTO perfis (usuario_id, nome_completo, tipo_documento, cpf)
                   VALUES (%s, 'Administrador', 'cpf', %s)
                   ON DUPLICATE KEY UPDATE nome_completo = VALUES(nome_completo)""",
                (usuario_id, f"000{usuario_id:08d}"),
            )
        cursor.execute("SELECT id FROM papeis WHERE nome = 'admin'")
        papel = cursor.fetchone()
        if papel:
            cursor.execute(
                "INSERT IGNORE INTO usuario_papeis (usuario_id, papel_id) VALUES (%s, %s)",
                (usuario_id, papel["id"]),
            )
        conexao.commit()
        print(f"Administrador pronto: {email}")
    finally:
        cursor.close()
        conexao.close()


if __name__ == "__main__":
    main()
