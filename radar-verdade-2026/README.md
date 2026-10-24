# Radar da Verdade 2026

PWA independente, mobile-first, sem login. Diferencia duas coisas: (1) registro de falas com vereditos de checadores humanos e fonte atribuída e (2) títulos de matérias de checagem recebidos em tempo quase real de um RSS de notícias. **Jamais transforma manchete automaticamente em veredito**.

## Executar

`node server.js` (Node 20+). Teste em `http://localhost:3000`.

## Dados

`data/claims.json` traz quatro exemplos documentados do debate Band 18/10/2026, todos com link para a Agência Lupa. **Nenhuma fala do debate da Globo 23/10 foi pré-classificada.** Para publicar novos vereditos, somente acrescente itens a esse arquivo depois que houver fonte primária/checagem jornalística identificada. Especificar `event`, `candidate`, `date`, `claim` em forma de síntese, `verdict`, `checker`, `sourceUrl` e `explanation`. O campo `sourceUrl` deve apontar para checagem da declaração, não apenas para página genérica de notícias.

A ingestão dinâmica está em `/api/coverage?kind=checagens`; recupera Google News RSS no servidor, com buscas fixas e cache de 90s. O cliente consulta a cada 120s quando visível. RSS pode ter atraso de minutos, falhar ou estar indisponível. Isso NÃO é checagem automatizada da fala.

## Instalação e segurança

Arquivos `manifest.webmanifest` e `sw.js` permitem instalação PWA e leitura offline da interface. As fontes externas são links, não incorporação nem republicação. Sem coleta de dados pessoais: falas anotadas em "Minhas anotações" ficam apenas no dispositivo via localStorage e não são enviadas ao servidor.

## Implantação em Render

Web Service gratuito Node 20+, comando `node server.js`, diretório raiz deste projeto, variável PORT fornecida pelo Render. Se este código estiver dentro de subdiretório em um repositório, start command `cd radar-verdade-2026 && node server.js`, sem build.

## Limites editoriais

Não apresentar "quem mentiu mais" com base em seleção parcial de falas, misturar debates em métricas, ou considerar opiniões/promessas checáveis como fatos. Veredito é sempre atribuído ao checador e pode ser corrigido. Não atribuir intenções: usar "afirmação classificada como falsa" em vez de inferir mentira deliberada.

## Compartilhamento individual (v1.1)

Em cada checagem documentada, o botão **Compartilhar esta verificação** disponibiliza WhatsApp, menu nativo Android/iOS, copiar texto, copiar link específico (`/?verificacao=<id>`) e card PNG vertical gerado no próprio aparelho. O link abre o debate e a fala corretos; o servidor fornece metadados Open Graph individualizados com a classificação, candidato e checador. Os compartilhamentos atribuem o veredito à fonte, mostram contexto e não insinuam intenção comprovada de mentir. Notícias de RSS não ganham botão de compartilhamento como se fossem vereditos; anotações não verificadas também não.


## Acompanhamento da Globo
O painel Fato ou Fake acompanha publicações públicas usando três consultas fixas ao Google News RSS, filtradas pelos veículos do Grupo Globo, com cache de 90 segundos. Nenhuma conexão oficial com os sistemas internos da emissora é reivindicada. Manchetes não recebem vereditos automáticos.

Opcional: configurar a variável privada FACTCHECK_API_KEY no Render ativa a integração com a Fact Check Tools API do Google para vereditos estruturados atribuídos às redações do Grupo Globo que estejam presentes na base. Na ausência da chave, o monitor público segue disponível.
