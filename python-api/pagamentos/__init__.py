"""Integração com a API existente do Portal.
Em uma API que ainda não registra as rotas financeiras, use após criar app:
    from pagamentos import criar_router
    app.include_router(criar_router(get_db_connection, get_usuario_atual))
"""
from .asaas_portal import criar_router
