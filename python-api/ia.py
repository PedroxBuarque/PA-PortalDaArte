"""Serviço de IA do Portal da Arte.

Usa o Ollama local por padrão (gratuito, sem chave de API). Toda chamada é
limitada em tamanho, tempo e tokens; falhas do provedor nunca são repassadas
ao cliente e o texto gerado sempre passa por saneamento antes de ser devolvido.
"""
import json
import logging
import os
import re

import httpx

logger = logging.getLogger(__name__)


class IAError(Exception):
    """Falha de configuração, conexão ou resposta do provedor de IA."""


# Dados pessoais e segredos não devem sair do backend nem entrar no prompt.
_PADROES_SENSIVEIS = (
    (re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b"), "[CPF]"),
    (re.compile(r"\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b"), "[CNPJ]"),
    (re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"), "[email]"),
    (re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"), "[token]"),
    (re.compile(r"\b(?:sb_secret_|sk-[A-Za-z0-9]{12,})[A-Za-z0-9_-]*"), "[chave]"),
)


def carregar_config():
    """Lê a configuração no ponto de uso, como os demais módulos do projeto."""
    provider = os.getenv("AI_PROVIDER", "ollama").strip().lower()
    if provider not in ("ollama", "desativado"):
        raise IAError("Provedor de IA não suportado")
    try:
        timeout = float(os.getenv("AI_TIMEOUT_SECONDS", "20"))
        max_tokens = int(os.getenv("AI_MAX_TOKENS", "160"))
    except (TypeError, ValueError):
        raise IAError("Configuração numérica de IA inválida")
    if not 1 <= timeout <= 120 or not 16 <= max_tokens <= 1024:
        raise IAError("Limites de IA fora da faixa permitida")
    return {
        "provider": provider,
        "base_url": os.getenv("OLLAMA_URL", "http://127.0.0.1:11434").strip().rstrip("/"),
        "modelo": os.getenv("OLLAMA_MODEL", "qwen3.5:4b").strip() or "qwen3.5:4b",
        "timeout": timeout,
        "max_tokens": max_tokens,
    }


def sanitizar(texto, limite=2000):
    """Remove dados sensíveis, controles e limita o tamanho do que vai ao modelo."""
    if not isinstance(texto, str):
        return ""
    resultado = "".join(c for c in texto if c == "\n" or c >= " ")
    for padrao, substituto in _PADROES_SENSIVEIS:
        resultado = padrao.sub(substituto, resultado)
    return resultado.strip()[:limite]


def gerar_texto(system, prompt, config=None, max_tokens=None):
    """Chama o Ollama e devolve apenas o texto, com falhas controladas."""
    cfg = config or carregar_config()
    if cfg["provider"] == "desativado":
        raise IAError("Geração com IA está desativada")
    if not cfg["base_url"].startswith(("http://", "https://")):
        raise IAError("URL do provedor de IA inválida")

    corpo = {
        "model": cfg["modelo"],
        "system": sanitizar(system, 4000),
        "prompt": sanitizar(prompt, 4000),
        "stream": False,
        "think": False,
        "options": {
            "temperature": 0.3,
            "repeat_penalty": 1.15,
            "frequency_penalty": 0.1,
            "num_predict": max_tokens or cfg["max_tokens"],
        },
    }
    try:
        with httpx.Client(timeout=cfg["timeout"]) as cliente:
            resposta = cliente.post(f"{cfg['base_url']}/api/generate", json=corpo)
            resposta.raise_for_status()
            dados = resposta.json()
    except (httpx.HTTPError, ValueError):
        # Não registrar prompt, resposta nem credenciais nos logs.
        logger.error("Falha ao consultar o provedor de IA (%s).", "httpx")
        raise IAError("Não foi possível consultar o modelo de IA")

    texto = dados.get("response") if isinstance(dados, dict) else None
    if not isinstance(texto, str) or not texto.strip():
        raise IAError("Resposta vazia do modelo de IA")
    return texto.strip()


def _limpar_saida(texto, limite=500):
    """Remove cercas de markdown, aspas envoltórias e quebras repetidas."""
    resultado = texto.strip()
    resultado = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", resultado).strip()
    if len(resultado) >= 2 and resultado[0] == resultado[-1] and resultado[0] in "\"'“”:":
        resultado = resultado[1:-1].strip()
    resultado = re.sub(r"[ \t]{2,}", " ", resultado)
    resultado = re.sub(r"\n{3,}", "\n\n", resultado)
    return resultado[:limite].strip()


_SISTEMA_DESCRICAO = (
    "Escreva UMA frase curta (máximo 35 palavras) descrevendo um serviço artístico, "
    "em português do Brasil, de forma natural e acolhedora. "
    "Responda somente a frase, sem aspas, sem markdown, sem título e sem explicações. "
    "Não invente nomes de artistas, prêmios, clientes, formação nem preços, "
    "não mencione valores monetários e não repita palavras."
)


def descricao_fallback(dados):
    """Texto determinístico usado quando o modelo está indisponível."""
    titulo = (dados.get("titulo") or "Apresentação artística").strip()
    categoria = (dados.get("categoria") or "").strip()
    publico = (dados.get("publico") or "").strip()
    modalidade = (dados.get("modalidade") or "ambos").strip()
    cidade = (dados.get("cidade") or "").strip()
    estado = (dados.get("estado") or "").strip()
    local = f" em {cidade}/{estado}" if cidade and estado else (f" em {cidade}" if cidade else "")
    if modalidade == "remoto":
        local = " de forma remota"
    elif modalidade == "presencial":
        local = (local or " presencialmente")
    partes = [f"{titulo}: apresentação{local}"]
    if categoria:
        partes.append(f"voltada a {categoria.lower()}")
    if publico:
        partes.append(f"para {publico.lower()}")
    partes.append("com atendimento personalizado e repertório adaptado ao evento.")
    return " ".join(partes)[:500]


def sugerir_descricao_servico(dados):
    """Gera (ou sugere) a descrição de um serviço a partir dos dados do artista."""
    permitidos = ("titulo", "categoria", "publico", "cidade", "estado",
                  "anos_experiencia", "modalidade", "preco_min", "preco_max")
    limpos = {chave: sanitizar(str(dados.get(chave))) for chave in permitidos if dados.get(chave) is not None}
    titulo = limpos.get("titulo", "").strip()
    if not titulo:
        raise IAError("Informe um título para gerar a descrição")

    linhas = [f"Título do serviço: {titulo}"]
    if limpos.get("categoria"):
        linhas.append(f"Categoria ou estilo: {limpos['categoria']}")
    if limpos.get("publico"):
        linhas.append(f"Público ou ocasião: {limpos['publico']}")
    modalidade = limpos.get("modalidade", "ambos")
    linhas.append(f"Modalidade: {modalidade}")
    if limpos.get("cidade"):
        linhas.append(f"Localização: {limpos['cidade']} {limpos.get('estado', '')}".strip())
    if limpos.get("anos_experiencia"):
        linhas.append(f"Anos de experiência: {limpos['anos_experiencia']}")
    linhas.append("Escreva agora a descrição do serviço.")

    try:
        texto = _limpar_saida(gerar_texto(_SISTEMA_DESCRICAO, "\n".join(linhas)))
        return {"descricao": texto, "origem": "modelo_local", "modelo": carregar_config()["modelo"]}
    except IAError:
        logger.error("Falha na geração com IA; usando texto determinístico (%s).", "descricao_servico")
        return {"descricao": descricao_fallback(limpos), "origem": "fallback"}


_SISTEMA_SUGESTOES = (
    "Você sugere respostas curtas para um chat de marketplace de artistas. "
    "Responda SOMENTE com um array JSON de exatamente 3 strings, cada uma com até 70 caracteres, "
    "em português do Brasil. As sugestões devem fazer sentido como próxima mensagem de quem está digitando, "
    "sem inventar fatos, nomes, valores ou compromissos. Não use markdown."
)

_SUGESTOES_PADRAO = [
    "Pode me contar mais detalhes?",
    "Ótimo! Podemos combinar os próximos passos?",
    "Qual é o valor final e o prazo?",
]


def sugerir_respostas(mensagens):
    """Sugere até 3 respostas curtas a partir das últimas mensagens do chat."""
    historico = [sanitizar(str(item), 500) for item in mensagens if str(item).strip()][-6:]
    if not historico:
        return {"sugestoes": _SUGESTOES_PADRAO, "origem": "fallback"}

    prompt = "Últimas mensagens:\n" + "\n".join(f"- {item}" for item in historico)
    prompt += "\n\nSugira 3 respostas curtas para a pessoa que está digitando."
    try:
        bruto = gerar_texto(_SISTEMA_SUGESTOES, prompt, max_tokens=80)
        limpo = re.sub(r"^```(?:json)?\s*|\s*```$", "", bruto.strip(), flags=re.IGNORECASE)
        dados = json.loads(limpo)
        if not isinstance(dados, list):
            raise ValueError("formato inesperado")
        sugestoes = []
        for item in dados[:3]:
            if isinstance(item, str):
                texto = _limpar_saida(item, 90)
                if texto:
                    sugestoes.append(texto)
        if len(sugestoes) < 2:
            raise ValueError("sugestoes insuficientes")
        return {"sugestoes": sugestoes, "origem": "modelo_local"}
    except (IAError, ValueError, TypeError):
        logger.error("Falha nas sugestões de resposta; usando textos padrão (%s).", "sugerir_respostas")
        return {"sugestoes": _SUGESTOES_PADRAO, "origem": "fallback"}


_SISTEMA_BUSCA = (
    "Transforme o pedido de um visitante em filtros de busca de um marketplace de artistas. "
    "Responda SOMENTE com um objeto JSON: "
    '{"termos": ["palavra1", "palavra2"], "categoria": null, "modalidade": null}. '
    "termos: até 6 palavras curtas que provavelmente aparecem em descrições de artistas e serviços. "
    "categoria: exatamente uma das categorias disponíveis, ou null se nenhuma couber. "
    "modalidade: presencial, remoto, ambos ou null. Não invente categorias nem termos."
)

_PARADAS_BUSCA = {
    "quero", "preciso", "procuro", "procura", "um", "uma", "uns", "umas", "o", "a", "os", "as",
    "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas", "para", "por", "com", "sem",
    "que", "qual", "como", "alguem", "alguém", "artista", "servico", "serviço", "fazer", "fechar",
    "evento", "meu", "minha", "meus", "minhas", "e", "ou", "mas", "aqui", "hoje", "perto",
}


def busca_fallback(consulta):
    """Extrai termos úteis sem modelo, para manter a busca utilizável offline."""
    tokens = re.findall(r"[\wÀ-ÿ]+", sanitizar(consulta).lower())
    termos = []
    for token in tokens:
        limpo = token.strip()
        if len(limpo) > 2 and limpo not in _PARADAS_BUSCA and limpo not in termos:
            termos.append(limpo)
        if len(termos) == 6:
            break
    return {"termos": termos, "categoria": None, "modalidade": None, "origem": "fallback"}


def interpretar_busca(consulta, categorias=None, modalidades=None):
    """Converte linguagem natural em termos/categoria/modalidade para o Explorar."""
    fallback = busca_fallback(consulta)
    categorias = [str(item) for item in (categorias or [])][:40]
    modalidades = [str(item) for item in (modalidades or [])][:4]
    prompt = (
        f"Pedido do visitante: {sanitizar(consulta, 300)}\n"
        f"Categorias disponíveis: {', '.join(categorias) if categorias else 'nenhuma'}\n"
        f"Modalidades disponíveis: {', '.join(modalidades) if modalidades else 'nenhuma'}\n"
        "Retorne o JSON solicitado."
    )
    try:
        bruto = gerar_texto(_SISTEMA_BUSCA, prompt, max_tokens=100)
        limpo = re.sub(r"^```(?:json)?\s*|\s*```$", "", bruto.strip(), flags=re.IGNORECASE)
        dados = json.loads(limpo)
        if not isinstance(dados, dict):
            raise ValueError("formato inesperado")
        termos = [item for item in dados.get("termos", [])[:6]
                  if isinstance(item, str) and 2 <= len(item.strip()) <= 40]
        termos = [_limpar_saida(item, 40) for item in termos]
        if not termos:
            raise ValueError("sem termos")
        categoria = dados.get("categoria")
        if not isinstance(categoria, str):
            categoria = None
        else:
            categoria = next((item for item in categorias if item.lower() == categoria.strip().lower()), None)
        modalidade = dados.get("modalidade")
        modalidade = modalidade.strip().lower() if isinstance(modalidade, str) else None
        if modalidade not in ("presencial", "remoto", "ambos"):
            modalidade = None
        return {"termos": termos, "categoria": categoria, "modalidade": modalidade, "origem": "modelo_local"}
    except (IAError, ValueError, TypeError):
        logger.error("Falha na interpretação da busca; usando termos simples (%s).", "interpretar_busca")
        return fallback
