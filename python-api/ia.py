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


_PROVIDER_MODELOS = {
    "ollama": "qwen3.5:4b",
    "gemini": "gemini-2.0-flash",
    "groq": "qwen/qwen3.8-27b",
}


def carregar_config():
    """Lê a configuração no ponto de uso, como os demais módulos do projeto."""
    provider = os.getenv("AI_PROVIDER", "ollama").strip().lower()
    if provider not in (*_PROVIDER_MODELOS, "desativado"):
        raise IAError("Provedor de IA não suportado")
    try:
        timeout = float(os.getenv("AI_TIMEOUT_SECONDS", "20"))
        max_tokens = int(os.getenv("AI_MAX_TOKENS", "160"))
    except (TypeError, ValueError):
        raise IAError("Configuração numérica de IA inválida")
    if not 1 <= timeout <= 120 or not 16 <= max_tokens <= 1024:
        raise IAError("Limites de IA fora da faixa permitida")
    chave = os.getenv("AI_API_KEY", "").strip()
    if provider in ("gemini", "groq") and not chave:
        raise IAError("Chave de IA não configurada")
    modelo = (
        os.getenv("AI_MODEL", "").strip()
        or (os.getenv("OLLAMA_MODEL", "").strip() if provider == "ollama" else "")
        or _PROVIDER_MODELOS.get(provider, "desativado")
    )
    return {
        "provider": provider,
        "base_url": os.getenv("OLLAMA_URL", "http://127.0.0.1:11434").strip().rstrip("/"),
        "modelo": modelo,
        "chave": chave,
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
    """Chama o provedor configurado e devolve apenas o texto, com falhas controladas."""
    cfg = config or carregar_config()
    provider = cfg["provider"]
    if provider == "desativado":
        raise IAError("Geração com IA está desativada")
    system = sanitizar(system, 4000)
    prompt = sanitizar(prompt, 4000)
    limite = max_tokens or cfg["max_tokens"]
    cabecalhos = {}

    if provider == "ollama":
        if not cfg["base_url"].startswith(("http://", "https://")):
            raise IAError("URL do provedor de IA inválida")
        url = f"{cfg['base_url']}/api/generate"
        corpo = {
            "model": cfg["modelo"], "system": system, "prompt": prompt,
            "stream": False, "think": False,
            "options": {
                "temperature": 0.3, "repeat_penalty": 1.15, "frequency_penalty": 0.1,
                "num_predict": limite,
            },
        }
    elif provider == "gemini":
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{cfg['modelo']}:generateContent?key={cfg['chave']}"
        )
        corpo = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "systemInstruction": {"parts": [{"text": system}]},
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": limite},
        }
    else:  # groq (endpoint compatível com OpenAI)
        url = "https://api.groq.com/openai/v1/chat/completions"
        cabecalhos = {"Authorization": f"Bearer {cfg['chave']}"}
        corpo = {
            "model": cfg["modelo"],
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            "temperature": 0.3, "max_tokens": limite, "stream": False,
        }

    try:
        with httpx.Client(timeout=cfg["timeout"]) as cliente:
            resposta = cliente.post(url, json=corpo, headers=cabecalhos)
            resposta.raise_for_status()
            dados = resposta.json()
    except (httpx.HTTPError, ValueError):
        # Não registrar prompt, resposta, URL nem credenciais nos logs.
        logger.error("Falha ao consultar o provedor de IA (%s).", provider)
        raise IAError("Não foi possível consultar o modelo de IA")

    try:
        if provider == "gemini":
            texto = dados["candidates"][0]["content"]["parts"][0]["text"]
        elif provider == "groq":
            texto = dados["choices"][0]["message"]["content"]
        else:
            texto = dados.get("response")
    except (KeyError, IndexError, TypeError):
        raise IAError("Resposta inesperada do provedor de IA")
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
    if len(resultado) > limite:
        corte = resultado.rfind(" ", 0, limite)
        resultado = resultado[:corte] if corte > limite // 2 else resultado[:limite]
    return resultado.strip()


_SISTEMA_DESCRICAO = (
    "Escreva uma descrição DETALHADA de um serviço artístico em português do Brasil, "
    "com 70 a 100 palavras, em 2 parágrafos curtos separados por uma linha em branco. "
    "No primeiro parágrafo, apresente o serviço, o estilo/repertório e para que tipo de evento ou público ele é ideal. "
    "No segundo, descreva o que está incluído, como é a execução, a duração aproximada, a modalidade de atendimento "
    "e o que torna a apresentação especial. "
    "Use tom natural e acolhedor, adequado ao catálogo de uma plataforma de artistas. "
    "Responda somente com a descrição, sem aspas, sem markdown, sem título e sem explicações. "
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
    partes = [f"{titulo}: apresentação{local} pensada para tornar seu evento mais especial."]
    if categoria:
        partes.append(f"Voltada a {categoria.lower()}, a apresentação valoriza o repertório e o estilo do artista.")
    if publico:
        partes.append(f"É uma escolha indicada para {publico.lower()}.")
    partes.append(
        "O repertório é selecionado de acordo com o perfil da ocasião, com atenção a cada detalhe. "
        "O atendimento inclui alinhamento prévio sobre preferências e duração, "
        "além de uma execução personalizada no dia do evento."
    )
    return " ".join(partes)[:500]


def _completar_descricao(texto, dados):
    """Garante um texto de catálogo mais completo quando o modelo responde curto."""
    if len(texto.split()) >= 55:
        return texto
    extra = []
    categoria = (dados.get("categoria") or "").strip()
    publico = (dados.get("publico") or "").strip()
    modalidade = (dados.get("modalidade") or "ambos").strip()
    if categoria:
        extra.append(
            f"O trabalho valoriza o estilo {categoria.lower()} e adapta o repertório ao perfil de cada ocasião."
        )
    if publico:
        extra.append(f"É uma escolha indicada para {publico.lower()}, com atenção ao clima do evento.")
    if modalidade == "remoto":
        extra.append("O atendimento é remoto, com alinhamento prévio para garantir a mesma qualidade da apresentação presencial.")
    elif modalidade == "presencial":
        extra.append("O atendimento é presencial, com alinhamento de horário, espaço e preferências.")
    else:
        extra.append("O atendimento pode ser presencial ou remoto, conforme a necessidade do contratante.")
    extra.append(
        "Antes do evento, o artista alinha repertório, duração e preferências para entregar "
        "uma apresentação personalizada e memorável."
    )
    return _limpar_saida(texto.rstrip() + " " + " ".join(extra), 500)


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
        cfg = carregar_config()
        # Modelo local em CPU é lento; o complemento abaixo completa o texto.
        limite = 110 if cfg["provider"] == "ollama" else 220
        texto = _limpar_saida(gerar_texto(_SISTEMA_DESCRICAO, "\n".join(linhas), max_tokens=limite))
        texto = _completar_descricao(texto, limpos)
        return {"descricao": texto, "origem": "modelo_local", "modelo": cfg["modelo"]}
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


_PALAVRAS_OFENSIVAS = (
    "idiota", "estupido", "estúpido", "burro", "inutil", "inútil", "escoria", "escória",
    "desgraçado", "filho da puta", "merda", "bosta", "cretino", "imbecil",
)
_PADROES_CONTATO_EXTERNO = re.compile(
    r"\b(whatsapp|whats|zap|telegram|instagram|instagram|pix|transferencia|transferência|deposito|depósito)\b",
    re.IGNORECASE,
)
_PADROES_LINK = re.compile(r"(https?://|www\.)", re.IGNORECASE)
_PADROES_REPETICAO = re.compile(r"(.)\1{6,}")


def moderar_texto(texto):
    """Avalia o texto e devolve um AVISO. Nunca bloqueia o envio."""
    limpo = sanitizar(texto, 2000)
    categorias = []
    if limpo:
        minusculas = limpo.lower()
        if any(palavra in minusculas for palavra in _PALAVRAS_OFENSIVAS):
            categorias.append("linguagem ofensiva")
        if _PADROES_CONTATO_EXTERNO.search(limpo):
            categorias.append("contato/pagamento fora da plataforma")
        if _PADROES_LINK.search(limpo):
            categorias.append("links externos")
        if _PADROES_REPETICAO.search(limpo):
            categorias.append("texto repetitivo")
        for padrao, _ in _PADROES_SENSIVEIS:
            if padrao.search(limpo):
                categorias.append("dados pessoais")
                break
    if not categorias:
        return {"suspeito": False, "categorias": [], "aviso": "", "origem": "regras"}

    categorias = list(dict.fromkeys(categorias))
    aviso = (
        "Este texto pode precisar de revisão (" + ", ".join(categorias) + "). "
        "A decisão de enviar é sua."
    )
    prompt = (
        f"Texto: {limpo}\nSinais detectados: {', '.join(categorias)}. "
        "Explique em uma frase curta e respeitosa por que vale revisar antes de enviar. "
        "Não mande nem bloqueie a mensagem."
    )
    try:
        externo = gerar_texto(
            "Você é um moderador consultivo. Seja breve, neutro e respeitoso. Não censure.",
            prompt, max_tokens=80,
        )
        externo = _limpar_saida(externo, 300)
        if externo:
            aviso = externo
            return {"suspeito": True, "categorias": categorias, "aviso": aviso, "origem": "modelo_local"}
    except IAError:
        logger.error("Falha na moderação com IA; usando aviso por regras (%s).", "moderar_texto")
    return {"suspeito": True, "categorias": categorias, "aviso": aviso, "origem": "regras"}


_SISTEMA_RECOMENDACOES = (
    "Você ordena artistas para um visitante de um marketplace. "
    "Responda SOMENTE com um array JSON de números inteiros (os IDs), do mais relevante ao menos relevante. "
    "Considere especialmente os artistas favoritados e a semelhança de categorias e estilos. "
    "Não inclua IDs que não estiverem na lista e não invente informações."
)


def recomendar_artistas(artistas, favoritos_ids=None, limite=12):
    """Reordena artistas por afinidade com os favoritos do visitante."""
    itens = [item for item in (artistas or []) if isinstance(item, dict)][:30]
    if not itens:
        return {"ids": [], "origem": "fallback"}

    normalizados = []
    for item in itens:
        try:
            artista_id = int(item.get("id"))
        except (TypeError, ValueError):
            continue
        normalizados.append({
            "id": artista_id,
            "nome": sanitizar(str(item.get("nome") or ""), 80),
            "categorias": [sanitizar(str(c), 60) for c in (item.get("categorias") or [])[:6]],
            "servicos": [sanitizar(str(s), 60) for s in (item.get("servicos") or [])[:6]],
            "nota": float(item.get("nota") or 0),
            "cidade": sanitizar(str(item.get("cidade") or ""), 60),
        })
    if not normalizados:
        return {"ids": [], "origem": "fallback"}

    favoritos = set()
    for valor in favoritos_ids or []:
        try:
            favoritos.add(int(valor))
        except (TypeError, ValueError):
            continue
    chaves_favoritas = set()
    for item in normalizados:
        if item["id"] in favoritos:
            chaves_favoritas.update(c.lower() for c in item["categorias"])

    def pontuacao(item):
        return (
            (12 if item["id"] in favoritos else 0)
            + 4 * len(chaves_favoritas.intersection(c.lower() for c in item["categorias"]))
            + min(float(item["nota"]), 5.0)
        )

    fallback_ids = [item["id"] for item in sorted(normalizados, key=pontuacao, reverse=True)][:limite]
    linhas = []
    for item in normalizados:
        linhas.append(
            f"ID {item['id']} | {item['nome'] or 'Artista'} | "
            f"categorias: {', '.join(item['categorias']) or '—'} | "
            f"serviços: {', '.join(item['servicos']) or '—'} | "
            f"nota: {item['nota']:.1f} | {item['cidade'] or '—'}"
        )
    prompt = (
        f"Favoritos do visitante (IDs): {', '.join(str(i) for i in sorted(favoritos)) or 'nenhum'}\n"
        "Artistas:\n" + "\n".join(linhas) + "\n\nOrdene os IDs do mais relevante ao menos relevante."
    )
    try:
        bruto = gerar_texto(_SISTEMA_RECOMENDACOES, prompt, max_tokens=150)
        limpo = re.sub(r"^```(?:json)?\s*|\s*```$", "", bruto.strip(), flags=re.IGNORECASE)
        dados = json.loads(limpo)
        if not isinstance(dados, list):
            raise ValueError("formato inesperado")
        validos = {item["id"] for item in normalizados}
        ordenados = []
        for valor in dados:
            try:
                ident = int(valor)
            except (TypeError, ValueError):
                if isinstance(valor, dict):
                    try:
                        ident = int(valor.get("id"))
                    except (TypeError, ValueError):
                        continue
                else:
                    continue
            if ident in validos and ident not in ordenados:
                ordenados.append(ident)
        if len(ordenados) < 2:
            raise ValueError("ordenação insuficiente")
        for ident in fallback_ids:
            if ident not in ordenados:
                ordenados.append(ident)
        return {"ids": ordenados[:limite], "origem": "modelo_local"}
    except (IAError, ValueError, TypeError):
        logger.error("Falha nas recomendações; usando ordem por afinidade (%s).", "recomendar_artistas")
        return {"ids": fallback_ids, "origem": "fallback"}


_SISTEMA_PROPOSTA = (
    "Você ajuda um contratante a escrever uma proposta para um artista. "
    "Responda SOMENTE com um JSON: "
    '{"valor_sugerido": 450.00, "escopo": "texto", "justificativa": "texto"}. '
    "Use AUMENTAR/DIMINUIR apenas se o pedido justificar; nunca invente preços abaixo do mínimo "
    "nem acima do máximo informados. escopo: descrição clara do que está incluído, em até 60 palavras. "
    "justificativa: até 25 palavras explicando o valor. Não mencione CPF, telefone, e-mail ou dados pessoais."
)


def sugerir_proposta(dados):
    """Sugere valor e escopo para uma proposta, sempre dentro da faixa cadastrada."""
    titulo = sanitizar(str(dados.get("titulo") or "Apresentação artística"), 150)
    descricao = sanitizar(str(dados.get("descricao_escopo") or ""), 1000)
    local = sanitizar(str(dados.get("local_ou_modalidade") or ""), 255)
    preco_min = dados.get("preco_min")
    preco_max = dados.get("preco_max")
    modalidade = sanitizar(str(dados.get("modalidade") or "ambos"), 30)
    categoria = sanitizar(str(dados.get("categoria") or ""), 100)

    linhas = [f"Serviço: {titulo}", f"Pedido do contratante: {descricao}"]
    if local:
        linhas.append(f"Local/modalidade desejada: {local}")
    if preco_min is not None or preco_max is not None:
        linhas.append(f"Faixa cadastrada pelo artista: R$ {preco_min or 0} a R$ {preco_max or 'a combinar'}")
    if modalidade:
        linhas.append(f"Modalidade: {modalidade}")
    if categoria:
        linhas.append(f"Categoria: {categoria}")

    try:
        bruto = gerar_texto(_SISTEMA_PROPOSTA, "\n".join(linhas), max_tokens=180)
        limpo = re.sub(r"^```(?:json)?\s*|\s*```$", "", bruto.strip(), flags=re.IGNORECASE)
        modelo = json.loads(limpo)
        if not isinstance(modelo, dict):
            raise ValueError("formato inesperado")
        valor = float(modelo.get("valor_sugerido"))
        if not 0 < valor <= 100_000_000:
            raise ValueError("valor invalido")
        if preco_min is not None and preco_max is not None:
            valor = min(max(valor, float(preco_min)), float(preco_max))
        escopo = _limpar_saida(str(modelo.get("escopo") or ""), 1000)
        justificativa = _limpar_saida(str(modelo.get("justificativa") or ""), 300)
        if not escopo:
            raise ValueError("sem escopo")
        return {
            "valor_sugerido": round(valor, 2), "escopo": escopo,
            "justificativa": justificativa, "origem": "modelo_local",
        }
    except (IAError, ValueError, TypeError):
        logger.error("Falha na sugestão de proposta; usando faixa cadastrada (%s).", "sugerir_proposta")
        if preco_min is not None and preco_max is not None:
            valor = round((float(preco_min) + float(preco_max)) / 2, 2)
        elif preco_min is not None:
            valor = round(float(preco_min), 2)
        elif preco_max is not None:
            valor = round(float(preco_max), 2)
        else:
            valor = 0.0
        escopo = f"{titulo}: {descricao}".strip(": ")
        if local:
            escopo += f" Local/modalidade: {local}."
        return {
            "valor_sugerido": valor, "escopo": escopo[:1000],
            "justificativa": "Valor baseado na faixa cadastrada pelo artista e no pedido informado.",
            "origem": "fallback",
        }


_SISTEMA_RESUMO = (
    "Resuma a conversa em até 5 tópicos curtos, em português do Brasil, "
    "destacando acordos, valores, prazos, perguntas e pendências mencionados. "
    "Responda somente com o resumo em tópicos, sem markdown, sem título e sem inventar informações."
)


def resumir_conversa(mensagens):
    """Resume o histórico textual de uma conversa privada, sob demanda."""
    historico = [sanitizar(str(item), 500) for item in mensagens if str(item).strip()][-40:]
    if not historico:
        return {"resumo": "Ainda não há mensagens para resumir.", "origem": "fallback"}
    prompt = "Mensagens recentes:\n" + "\n".join(f"- {item}" for item in historico)
    try:
        texto = _limpar_saida(gerar_texto(_SISTEMA_RESUMO, prompt, max_tokens=200), 1200)
        return {"resumo": texto, "origem": "modelo_local"}
    except IAError:
        logger.error("Falha no resumo da conversa; usando histórico recente (%s).", "resumir_conversa")
        linhas = [f"- {item[:160]}" for item in historico[-5:]]
        return {"resumo": "Últimas mensagens:\n" + "\n".join(linhas), "origem": "fallback"}


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
