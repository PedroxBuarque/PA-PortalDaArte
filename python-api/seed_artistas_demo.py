"""
Cria quatro perfis de demonstração para o Portal da Arte.
Execute na pasta python-api, com o mesmo ambiente e .env usados pela API:
    python seed_artistas_demo.py

A senha dos quatro usuários é PortalArteDemo123!
Use apenas em desenvolvimento/demonstração, nunca em produção.
"""
import uuid
from main import get_db_connection, hash_senha

DEMO_ARTISTS = [
    {
        "email": "demo.cantora@example.com",
        "nome_completo": "Lia Monteiro",
        "cpf": "90000000001",
        "nome_artistico": "Lia Monteiro",
        "bio": "Cantora de MPB e música brasileira, com repertório acústico para eventos.",
        "anos": 5,
        "categoria": "Músicos",
        "servico": "Show voz e violão / MPB",
        "descricao": "Repertório acústico, MPB e música brasileira.",
        "preco_min": 250.00, "preco_max": 500.00,
        "nota": 4.90, "contratacoes": 28,
    },
    {
        "email": "demo.forro@example.com",
        "nome_completo": "Trio Raiz do Agreste",
        "cpf": "90000000002",
        "nome_artistico": "Trio Raiz do Agreste",
        "bio": "Trio de forró pé de serra com sanfona, zabumba e triângulo para festas e eventos.",
        "anos": 8,
        "categoria": "Bandas",
        "servico": "Forró pé de serra ao vivo",
        "descricao": "Sanfona, zabumba e triângulo para festas e eventos.",
        "preco_min": 900.00, "preco_max": 1600.00,
        "nota": 4.80, "contratacoes": 41,
    },
    {
        "email": "demo.fotografia@example.com",
        "nome_completo": "Rafaela Luz",
        "cpf": "90000000003",
        "nome_artistico": "Rafaela Luz Fotografia",
        "bio": "Fotografia de casamentos, shows, retratos e eventos culturais.",
        "anos": 4,
        "categoria": "Fotógrafos",
        "servico": "Fotografia de eventos",
        "descricao": "Cobertura fotográfica de eventos, shows e retratos.",
        "preco_min": 300.00, "preco_max": 750.00,
        "nota": 4.70, "contratacoes": 19,
    },
    {
        "email": "demo.artesvisuais@example.com",
        "nome_completo": "Ateliê Cores do Sertão",
        "cpf": "90000000004",
        "nome_artistico": "Ateliê Cores do Sertão",
        "bio": "Pintura em tela, murais e ilustrações inspiradas na cultura nordestina.",
        "anos": 6,
        "categoria": "Pintores",
        "servico": "Pintura e muralismo",
        "descricao": "Criação de telas e murais personalizados.",
        "preco_min": 350.00, "preco_max": 1200.00,
        "nota": 4.85, "contratacoes": 23,
    },
]

def main():
    conexao = get_db_connection()
    cursor = conexao.cursor(dictionary=True)
    try:
        # Garante as categorias sem criar duplicatas pelo nome.
        for nome, descricao in [
            ("Músicos", "Cantores e instrumentistas"),
            ("Bandas", "Bandas e grupos musicais"),
            ("Fotógrafos", "Fotografia de eventos e retratos"),
            ("Pintores", "Pintura, ilustração e artes visuais"),
        ]:
            cursor.execute(
                "SELECT id FROM categorias WHERE nome = %s LIMIT 1", (nome,)
            )
            if not cursor.fetchone():
                cursor.execute(
                    "INSERT INTO categorias (nome, descricao, ativo) VALUES (%s, %s, TRUE)",
                    (nome, descricao),
                )

        for artist in DEMO_ARTISTS:
            email = artist["email"]
            cursor.execute(
                "SELECT id FROM usuarios WHERE email_normalizado = %s", (email,)
            )
            user = cursor.fetchone()
            if user:
                user_id = user["id"]
                cursor.execute(
                    "UPDATE usuarios SET status = 'ativo', email_verificado_em = COALESCE(email_verificado_em, NOW()) WHERE id = %s",
                    (user_id,),
                )
            else:
                cursor.execute(
                    """INSERT INTO usuarios
                       (id_publico, email, email_normalizado, senha_hash, status, email_verificado_em)
                       VALUES (%s, %s, %s, %s, 'ativo', NOW())""",
                    (str(uuid.uuid4()), email, email, hash_senha("PortalArteDemo123!")),
                )
                user_id = cursor.lastrowid

            cursor.execute(
                """INSERT INTO perfis
                   (usuario_id, nome_completo, cidade, estado, tipo_documento, cpf, cnpj)
                   VALUES (%s, %s, 'Caruaru', 'PE', 'cpf', %s, NULL)
                   ON DUPLICATE KEY UPDATE nome_completo = VALUES(nome_completo),
                     cidade = VALUES(cidade), estado = VALUES(estado)""",
                (user_id, artist["nome_completo"], artist["cpf"]),
            )

            cursor.execute(
                """INSERT INTO perfis_artista
                   (usuario_id, nome_artistico, biografia, anos_experiencia,
                    modalidade_atendimento, cidade_atendimento, estado_atendimento,
                    status_verificacao, aceitando_novas_solicitacoes, nota_media, total_contratacoes)
                   VALUES (%s, %s, %s, %s, 'ambos', 'Caruaru', 'PE', 'aprovada', TRUE, %s, %s)
                   ON DUPLICATE KEY UPDATE nome_artistico = VALUES(nome_artistico),
                     biografia = VALUES(biografia), anos_experiencia = VALUES(anos_experiencia),
                     nota_media = VALUES(nota_media), total_contratacoes = VALUES(total_contratacoes),
                     aceitando_novas_solicitacoes = TRUE""",
                (user_id, artist["nome_artistico"], artist["bio"], artist["anos"],
                 artist["nota"], artist["contratacoes"]),
            )

            cursor.execute("SELECT id FROM categorias WHERE nome = %s LIMIT 1", (artist["categoria"],))
            category_id = cursor.fetchone()["id"]
            cursor.execute(
                "INSERT IGNORE INTO artista_categorias (artista_id, categoria_id) VALUES (%s, %s)",
                (user_id, category_id),
            )

            cursor.execute(
                "SELECT id FROM servicos WHERE artista_id = %s AND titulo = %s LIMIT 1",
                (user_id, artist["servico"]),
            )
            if not cursor.fetchone():
                cursor.execute(
                    """INSERT INTO servicos
                       (artista_id, categoria_id, titulo, descricao, preco_min, preco_max, modalidade, ativo)
                       VALUES (%s, %s, %s, %s, %s, %s, 'ambos', TRUE)""",
                    (user_id, category_id, artist["servico"], artist["descricao"],
                     artist["preco_min"], artist["preco_max"]),
                )

        conexao.commit()
        print("Perfis de demonstração criados/atualizados com sucesso.")
        print("Login de demonstração: demo.cantora@example.com")
        print("Senha: PortalArteDemo123!")
    except Exception:
        conexao.rollback()
        raise
    finally:
        cursor.close()
        conexao.close()

if __name__ == "__main__":
    main()
