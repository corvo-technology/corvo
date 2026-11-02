import type { SkillStoreEntry } from "@corvo/contracts";

/**
 * Social media, marketing and design skills for a small business. Written for Corvo. They plan,
 * write and review; none publishes, spends or changes anything on its own. Names stay plain (no
 * accents) so the `/` and `@` pickers match them as typed.
 */
export const MARKETING_SKILLS: readonly SkillStoreEntry[] = [
  {
    slug: "content-calendar",
    category: "marketing",
    icon: "calendar",
    name: { en: "Content Calendar", "pt-BR": "Calendario de conteudo" },
    description: {
      en: "Plan four weeks of posts by channel, with themes, formats and the day to post.",
      "pt-BR": "Planeja quatro semanas de posts por canal, com temas, formatos e dia de publicar.",
    },
    body: {
      en: `Plan the next four weeks of content.

1. Ask once for: the business and its audience, the channels in use, how many posts per week the owner can really produce, and the goal (sales, bookings, followers, trust).
2. Choose three or four content pillars that serve the goal, for example: show the work, teach something, social proof, and an offer.
3. Build the calendar as a table: date, channel, pillar, format (photo, carousel, short video, story, text), the idea in one line and the call to action.
4. Repeat what works: plan one idea to be reused in two formats.
5. Mark the dates that matter to the business (promotions, holidays, launches) and plan the lead-up.
6. Add a short weekly routine: what to prepare on which day, so the posts exist before the day they go out.
Keep it realistic: fewer posts that get done beat a full calendar that does not. You only plan and write; the owner publishes.`,
      "pt-BR": `Planeje as próximas quatro semanas de conteúdo.

1. Pergunte uma vez: o negócio e o público, os canais em uso, quantos posts por semana o dono consegue mesmo produzir e o objetivo (vendas, agendamentos, seguidores, confiança).
2. Escolha três ou quatro pilares de conteúdo que sirvam ao objetivo, por exemplo: mostrar o trabalho, ensinar algo, prova social e uma oferta.
3. Monte o calendário em uma tabela: data, canal, pilar, formato (foto, carrossel, vídeo curto, story, texto), a ideia em uma linha e a chamada para ação.
4. Repita o que funciona: planeje uma ideia para ser reaproveitada em dois formatos.
5. Marque as datas que importam para o negócio (promoções, feriados, lançamentos) e planeje a preparação.
6. Acrescente uma rotina semanal curta: o que preparar em que dia, para os posts existirem antes do dia em que saem.
Seja realista: menos posts que saem valem mais do que um calendário cheio que não acontece. Você só planeja e escreve; quem publica é o dono.`,
    },
  },
  {
    slug: "viral-ideas",
    category: "marketing",
    icon: "megaphone",
    name: { en: "Viral Ideas", "pt-BR": "Ideias virais" },
    description: {
      en: "Generate content ideas with a strong hook, and rank which ones to test first.",
      "pt-BR": "Gera ideias de conteúdo com gancho forte e ordena quais testar primeiro.",
    },
    body: {
      en: `Generate content ideas that have a real chance of spreading. Nobody can promise a post will go viral, so you find ideas worth testing and say so.

1. Ask for the business, the audience and the channel. If there are past posts, look at which ones did best and why.
2. Write ten ideas. For each: the hook in the first line or first three seconds, the format, the main beat of the content, why a person would share it (it is useful, funny, surprising, relatable or it shows an identity) and the call to action.
3. Use proven patterns, adapted to the business: a myth people believe, a before and after, a mistake to avoid, a behind-the-scenes look, a simple how-to, an honest opinion, a customer story, a question that invites replies.
4. Rank the ten by how easy they are to produce and how strong the hook is, and pick three to test this week.
5. Say what to measure (watch time, saves, shares, replies) and when to decide to repeat or drop an idea.
Follow trends only when they fit the business, and never use someone else's work, music or likeness without the right to. You only suggest; the owner decides and posts.`,
      "pt-BR": `Gere ideias de conteúdo com chance real de se espalhar. Ninguém pode prometer que um post vai viralizar, então você acha ideias que valem o teste e diz isso.

1. Pergunte o negócio, o público e o canal. Se houver posts passados, veja quais foram melhor e por quê.
2. Escreva dez ideias. Para cada uma: o gancho na primeira linha ou nos primeiros três segundos, o formato, o ponto principal do conteúdo, por que alguém compartilharia (é útil, engraçado, surpreendente, reconhecível ou mostra uma identidade) e a chamada para ação.
3. Use padrões comprovados, adaptados ao negócio: um mito em que as pessoas acreditam, um antes e depois, um erro a evitar, os bastidores, um passo a passo simples, uma opinião sincera, a história de um cliente, uma pergunta que convida a responder.
4. Ordene as dez pela facilidade de produzir e pela força do gancho, e escolha três para testar esta semana.
5. Diga o que medir (tempo assistido, salvamentos, compartilhamentos, respostas) e quando decidir repetir ou largar uma ideia.
Siga tendências só quando combinarem com o negócio e nunca use trabalho, música ou imagem de outra pessoa sem ter o direito. Você só sugere; quem decide e publica é o dono.`,
    },
  },
  {
    slug: "short-video-script",
    category: "marketing",
    icon: "megaphone",
    name: { en: "Short Video Script", "pt-BR": "Roteiro de video curto" },
    description: {
      en: "Write a 15 to 45 second video script with hook, beats, on-screen text and call to action.",
      "pt-BR":
        "Escreve um roteiro de vídeo de 15 a 45 segundos com gancho, cenas, texto e chamada.",
    },
    body: {
      en: `Write a script for a short vertical video (Reels, TikTok, Shorts).

1. Ask for the topic, who it is for, the goal and the length (15 to 45 seconds). Ask what the owner can film.
2. Write the hook: one line, in the first three seconds, that makes the right person stay. Offer two versions.
3. Write the script as a table of scenes: time, what is on screen, what is said, the text on screen. Keep sentences short and spoken, one idea per scene.
4. End with one clear call to action (comment, save, send to someone, book, visit).
5. Add the caption, a few relevant hashtags and the suggested sound or music mood.
6. Add a shot list the owner can film with a phone in one sitting.
Do not promise results you cannot prove, and keep the claims true. You write the script; the owner films and posts.`,
      "pt-BR": `Escreva um roteiro para um vídeo vertical curto (Reels, TikTok, Shorts).

1. Pergunte o tema, para quem é, o objetivo e a duração (15 a 45 segundos). Pergunte o que o dono consegue filmar.
2. Escreva o gancho: uma linha, nos três primeiros segundos, que faça a pessoa certa ficar. Ofereça duas versões.
3. Escreva o roteiro como uma tabela de cenas: tempo, o que aparece na tela, o que é dito, o texto na tela. Frases curtas e faladas, uma ideia por cena.
4. Termine com uma chamada para ação clara (comentar, salvar, mandar para alguém, agendar, visitar).
5. Acrescente a legenda, algumas hashtags relevantes e o clima de som ou música sugerido.
6. Acrescente uma lista de planos que o dono consiga filmar com o celular de uma vez.
Não prometa resultados que não possa provar e mantenha as afirmações verdadeiras. Você escreve o roteiro; o dono filma e publica.`,
    },
  },
  {
    slug: "social-post",
    category: "marketing",
    icon: "megaphone",
    name: { en: "Social Post", "pt-BR": "Post para redes" },
    description: {
      en: "Turn one idea into posts adapted to each network, in your brand's voice.",
      "pt-BR": "Transforma uma ideia em posts adaptados a cada rede, na voz da sua marca.",
    },
    body: {
      en: `Turn one idea into posts for the networks the owner uses.

1. Ask for the idea, the goal and the networks. Use the brand voice you already know; if you do not know it, ask for two examples of posts the owner likes.
2. For each network, adapt the same idea to how people read there: Instagram (a first line that stops the scroll, line breaks, a clear call to action), LinkedIn (a short story or lesson, a professional tone), X (one sharp thought), WhatsApp status or channel (short and personal).
3. Offer two versions for the first line of each post.
4. Suggest the image or video that goes with each, and the best time to post if you know the audience.
5. Check before you finish: is it true, is it clear in five seconds, is there one call to action, does it sound like the brand.
Do not invent numbers, testimonials or promotions. You write; the owner posts.`,
      "pt-BR": `Transforme uma ideia em posts para as redes que o dono usa.

1. Pergunte a ideia, o objetivo e as redes. Use a voz da marca que você já conhece; se não conhece, peça dois exemplos de posts de que o dono gosta.
2. Para cada rede, adapte a mesma ideia a como as pessoas leem lá: Instagram (uma primeira linha que pare a rolagem, quebras de linha, chamada clara), LinkedIn (uma história ou aprendizado curto, tom profissional), X (um pensamento afiado), status ou canal do WhatsApp (curto e pessoal).
3. Ofereça duas versões para a primeira linha de cada post.
4. Sugira a imagem ou o vídeo que acompanha cada um e o melhor horário, se você conhece o público.
5. Confira antes de terminar: é verdade, fica claro em cinco segundos, tem uma só chamada para ação, soa como a marca.
Não invente números, depoimentos nem promoções. Você escreve; o dono publica.`,
    },
  },
  {
    slug: "brand-voice",
    category: "marketing",
    icon: "file",
    name: { en: "Brand Voice", "pt-BR": "Voz da marca" },
    description: {
      en: "Describe how your brand speaks, with do and do not lists and rewritten examples.",
      "pt-BR":
        "Descreve como a sua marca fala, com listas do que fazer e evitar e exemplos reescritos.",
    },
    body: {
      en: `Define the brand's voice so every text sounds like the same business.

1. Ask for three to five texts the owner likes or wrote (posts, messages, a website page) and who the audience is.
2. Describe the voice in three to five traits, each with what it means in practice (for example "warm: we greet by first name and avoid corporate words").
3. Write a do and do not list: words and phrases to use, words to avoid, how to treat the customer, emojis yes or no, how long a message should be.
4. Show before and after: take two of the owner's real sentences and rewrite them in the voice.
5. Write a short guide of one page the team can follow, and a prompt-sized version (five lines) to paste when asking an assistant to write.
6. Ask the owner to correct what feels wrong and update the guide.
Describe the voice the business already has and wants; do not invent a personality that does not fit.`,
      "pt-BR": `Defina a voz da marca para que todo texto soe como o mesmo negócio.

1. Peça de três a cinco textos de que o dono gosta ou que ele escreveu (posts, mensagens, uma página do site) e quem é o público.
2. Descreva a voz em três a cinco traços, cada um com o que significa na prática (por exemplo "acolhedora: cumprimentamos pelo primeiro nome e evitamos palavras corporativas").
3. Escreva uma lista do que fazer e do que evitar: palavras e expressões para usar, palavras a evitar, como tratar o cliente, emojis sim ou não, o tamanho de uma mensagem.
4. Mostre antes e depois: pegue duas frases reais do dono e reescreva na voz.
5. Escreva um guia curto de uma página que a equipe possa seguir e uma versão do tamanho de um prompt (cinco linhas) para colar ao pedir a um assistente que escreva.
6. Peça ao dono para corrigir o que parecer errado e atualize o guia.
Descreva a voz que o negócio já tem e quer ter; não invente uma personalidade que não combina.`,
    },
  },
  {
    slug: "content-strategy",
    category: "marketing",
    icon: "chart",
    name: { en: "Content Strategy", "pt-BR": "Estrategia de conteudo" },
    description: {
      en: "Define audience, pillars, channels and metrics so content serves a business goal.",
      "pt-BR": "Define público, pilares, canais e métricas para o conteúdo servir a um objetivo.",
    },
    body: {
      en: `Build a content strategy that serves a business goal, not just activity.

1. Start with the goal in numbers if possible (for example, 20 new bookings a month) and the offer behind it.
2. Describe the ideal customer in a short paragraph: who they are, what they worry about, where they spend time online and what makes them trust a business.
3. Choose the channels where that person is, and drop the rest. Fewer channels done well.
4. Define three to four pillars and the share of posts for each.
5. Define the path from content to sale: what a person sees first, what makes them come closer (a message, a form, a visit) and what closes.
6. Choose five metrics that show progress toward the goal (not just likes) and a monthly review.
7. List the first three experiments to run and what would make you change course.
Be honest about what the owner can maintain every week.`,
      "pt-BR": `Monte uma estratégia de conteúdo que sirva a um objetivo do negócio, não só a atividade.

1. Comece pelo objetivo em números, se possível (por exemplo, 20 novos agendamentos por mês), e pela oferta por trás dele.
2. Descreva o cliente ideal em um parágrafo curto: quem é, com o que se preocupa, onde passa tempo na internet e o que o faz confiar em um negócio.
3. Escolha os canais onde essa pessoa está e descarte o resto. Menos canais, bem feitos.
4. Defina três a quatro pilares e a parte dos posts de cada um.
5. Defina o caminho do conteúdo até a venda: o que a pessoa vê primeiro, o que a faz chegar mais perto (uma mensagem, um formulário, uma visita) e o que fecha.
6. Escolha cinco métricas que mostrem o avanço rumo ao objetivo (não só curtidas) e uma revisão mensal.
7. Liste os três primeiros experimentos e o que faria você mudar de rumo.
Seja honesto sobre o que o dono consegue manter toda semana.`,
    },
  },
  {
    slug: "review-reply",
    category: "support",
    icon: "mail",
    name: { en: "Review Reply", "pt-BR": "Resposta a avaliacoes" },
    description: {
      en: "Draft replies to customer reviews, from praise to complaints, in a calm, human tone.",
      "pt-BR":
        "Escreve respostas a avaliações de clientes, de elogios a reclamações, em tom humano.",
    },
    body: {
      en: `Draft replies to customer reviews (Google, Instagram, marketplaces).

1. Read the review and the facts you have. If you do not know what happened, ask the owner before replying.
2. Positive review: thank the person by name, mention one specific thing they said, and invite them back. Keep it short and not copy-pasted from other replies.
3. Mixed or negative review: thank them for telling you, apologize for how they felt without admitting what you cannot confirm, say in a sentence what you will do or have already done, and offer a way to talk (a phone number or message) so the details move out of public view. Never argue, blame the customer or reveal private details.
4. Fake or abusive review: reply politely and briefly, and tell the owner how to report it on the platform.
5. After a batch, list the themes that came up so the owner can fix the cause.
Show the drafts and let the owner post them; never post a reply yourself.`,
      "pt-BR": `Escreva respostas a avaliações de clientes (Google, Instagram, marketplaces).

1. Leia a avaliação e os fatos que você tem. Se não souber o que aconteceu, pergunte ao dono antes de responder.
2. Avaliação positiva: agradeça a pessoa pelo nome, cite uma coisa específica que ela disse e convide para voltar. Curta e sem copiar de outras respostas.
3. Avaliação mista ou negativa: agradeça por avisar, peça desculpas pelo que a pessoa sentiu sem admitir o que não dá para confirmar, diga em uma frase o que será feito ou já foi feito e ofereça um jeito de conversar (telefone ou mensagem) para os detalhes saírem da vista do público. Nunca discuta, culpe o cliente nem revele detalhes privados.
4. Avaliação falsa ou abusiva: responda com educação e brevidade e diga ao dono como denunciar na plataforma.
5. Depois de um lote, liste os temas que apareceram para o dono corrigir a causa.
Mostre os rascunhos e deixe o dono publicar; nunca publique uma resposta você mesmo.`,
    },
  },
  {
    slug: "ad-review",
    category: "marketing",
    icon: "chart",
    name: { en: "Ad Review", "pt-BR": "Revisao de anuncios" },
    description: {
      en: "Read ad results and say what to pause, keep, scale and test next.",
      "pt-BR": "Lê os resultados dos anúncios e diz o que pausar, manter, escalar e testar.",
    },
    body: {
      en: `Review the results of paid campaigns and recommend what to do.

1. Take the numbers for the period: spend, impressions, clicks, conversions (messages, leads, sales) and revenue if known. Confirm what a conversion means for this business.
2. Calculate per campaign and per ad: cost per click, cost per result, conversion rate and, with revenue, the return on ad spend. Note frequency (how often the same person sees the ad).
3. Sort the ads: scale (good result, enough volume), keep, fix (clicks but no results: look at the offer, the page or the audience) and pause (spending without results after enough data).
4. Do not decide on too little data; say how much more is needed before a verdict.
5. Propose two or three tests with one change each (image, first line, audience, offer) and what result would count as a win.
6. Warn about problems: ad fatigue, tracking that looks broken, and budgets that run out early in the day.
Never change a budget, pause an ad or edit a campaign yourself; give the recommendation and let the owner decide.`,
      "pt-BR": `Revise os resultados de campanhas pagas e recomende o que fazer.

1. Pegue os números do período: gasto, impressões, cliques, conversões (mensagens, contatos, vendas) e receita, se souber. Confirme o que é uma conversão para este negócio.
2. Calcule por campanha e por anúncio: custo por clique, custo por resultado, taxa de conversão e, com a receita, o retorno sobre o gasto. Anote a frequência (quantas vezes a mesma pessoa vê o anúncio).
3. Classifique os anúncios: escalar (bom resultado, volume suficiente), manter, ajustar (cliques mas sem resultado: veja a oferta, a página ou o público) e pausar (gasta sem resultado depois de dados suficientes).
4. Não decida com dados de menos; diga quantos dados faltam antes de um veredito.
5. Proponha dois ou três testes com uma mudança cada (imagem, primeira linha, público, oferta) e que resultado contaria como vitória.
6. Avise de problemas: cansaço do anúncio, medição que parece quebrada e verba que acaba cedo no dia.
Nunca altere uma verba, pause um anúncio nem edite uma campanha você mesmo; dê a recomendação e deixe o dono decidir.`,
    },
  },
  {
    slug: "local-visibility",
    category: "marketing",
    icon: "search",
    name: { en: "Local Visibility", "pt-BR": "Visibilidade local" },
    description: {
      en: "Improve how nearby customers find you on Google, maps and directories.",
      "pt-BR": "Melhora como clientes próximos encontram você no Google, nos mapas e em listas.",
    },
    body: {
      en: `Help a local business get found by nearby customers.

1. Ask for the business, the neighborhood or city, the main services and the link to its Google Business Profile and website if they exist.
2. Check the basics and list what is missing: the Google Business Profile complete and verified (name, category, address, hours, phone, services, photos), the same name, address and phone everywhere, a link to WhatsApp, and the website loading fast on a phone.
3. Suggest the words customers use to search ("service near me", the service plus the neighborhood) and where to use them: the profile description, service pages and photos' names.
4. Plan a routine to collect reviews: when to ask, the message to send and how to reply (see the review reply skill).
5. Suggest a short monthly routine: new photos, a post on the profile, answers to questions and reviews.
6. Rank the fixes by effort and effect, and give the first three to do this week.
Do not promise a ranking position. You advise and prepare the texts; the owner makes the changes.`,
      "pt-BR": `Ajude um negócio local a ser encontrado por clientes próximos.

1. Pergunte o negócio, o bairro ou a cidade, os principais serviços e o link do Perfil da Empresa no Google e do site, se existirem.
2. Confira o básico e liste o que falta: o Perfil da Empresa no Google completo e verificado (nome, categoria, endereço, horário, telefone, serviços, fotos), o mesmo nome, endereço e telefone em todo lugar, um link para o WhatsApp e o site carregando rápido no celular.
3. Sugira as palavras que os clientes usam para buscar ("serviço perto de mim", o serviço mais o bairro) e onde usá-las: a descrição do perfil, as páginas de serviço e o nome das fotos.
4. Planeje uma rotina para coletar avaliações: quando pedir, a mensagem a enviar e como responder (veja a skill de resposta a avaliações).
5. Sugira uma rotina mensal curta: fotos novas, um post no perfil, respostas a perguntas e avaliações.
6. Ordene os ajustes por esforço e efeito e dê os três primeiros para fazer esta semana.
Não prometa posição no ranking. Você orienta e prepara os textos; quem faz as mudanças é o dono.`,
    },
  },
  {
    slug: "campaign-plan",
    category: "marketing",
    icon: "calendar",
    name: { en: "Campaign Plan", "pt-BR": "Plano de campanha" },
    description: {
      en: "Plan a promotion or launch: offer, audience, channels, calendar, budget and metrics.",
      "pt-BR":
        "Planeja uma promoção ou lançamento: oferta, público, canais, calendário, verba e métricas.",
    },
    body: {
      en: `Plan a campaign for a promotion, a launch or a season.

1. Define the goal with a number and a date, and the offer: what is being sold, to whom, at what price or benefit and until when.
2. Describe the audience and the one message that matters to them.
3. Choose the channels and the role of each (attract, convince, close).
4. Build the calendar: before (teasers), during (the offer, reminders, last call), after (thank you, follow-up). Give each item a date, a channel and an owner.
5. Split the budget across channels and keep a small reserve to put on what works.
6. List the assets needed (images, videos, texts, links) and who prepares each.
7. Define how you will measure success, the day you will check it and the decision you will take if it is below target.
Make the plan fit the time and money the owner really has. You plan and write; the owner approves, spends and publishes.`,
      "pt-BR": `Planeje uma campanha para uma promoção, um lançamento ou uma data sazonal.

1. Defina o objetivo com um número e uma data, e a oferta: o que está sendo vendido, para quem, a que preço ou benefício e até quando.
2. Descreva o público e a única mensagem que importa para ele.
3. Escolha os canais e o papel de cada um (atrair, convencer, fechar).
4. Monte o calendário: antes (teasers), durante (a oferta, lembretes, última chamada), depois (agradecimento, acompanhamento). Dê a cada item uma data, um canal e um responsável.
5. Divida a verba entre os canais e guarde uma pequena reserva para colocar no que funcionar.
6. Liste o material necessário (imagens, vídeos, textos, links) e quem prepara cada um.
7. Defina como vai medir o sucesso, o dia em que vai conferir e a decisão que tomará se estiver abaixo da meta.
Faça o plano caber no tempo e no dinheiro que o dono realmente tem. Você planeja e escreve; o dono aprova, gasta e publica.`,
    },
  },
  {
    slug: "growth-report",
    category: "marketing",
    icon: "chart",
    name: { en: "Growth Report", "pt-BR": "Relatorio de crescimento" },
    description: {
      en: "Summarize the week's marketing numbers and the three things to do next.",
      "pt-BR": "Resume os números de marketing da semana e as três coisas a fazer em seguida.",
    },
    body: {
      en: `Write a short weekly report on how the business is growing.

1. Collect the numbers you can read for the week and the week before: new followers, reach, visits to the site or profile, messages and leads, sales and revenue by source if known.
2. Show a small table with the change from the previous week.
3. Say in three sentences what moved and the most likely reason (a post, an ad, a season, a one-off).
4. Name the post, ad or channel that did best and the one that did worst, with the number behind each.
5. End with three actions for next week, each tied to a number.
6. Say which numbers are missing or look wrong.
Keep it under 200 words plus the table, with the most important point first. Do not explain what a metric is unless the owner asks.`,
      "pt-BR": `Escreva um relatório semanal curto de como o negócio está crescendo.

1. Reúna os números que você consegue ler da semana e da semana anterior: novos seguidores, alcance, visitas ao site ou ao perfil, mensagens e contatos, vendas e receita por origem, se souber.
2. Mostre uma tabela pequena com a variação em relação à semana anterior.
3. Diga em três frases o que mexeu e o motivo mais provável (um post, um anúncio, uma data, algo pontual).
4. Aponte o post, anúncio ou canal que foi melhor e o pior, com o número de cada um.
5. Termine com três ações para a semana que vem, cada uma ligada a um número.
6. Diga quais números faltam ou parecem errados.
Mantenha abaixo de 200 palavras mais a tabela, com o ponto mais importante primeiro. Não explique o que é uma métrica a menos que o dono peça.`,
    },
  },
  {
    slug: "design-critique",
    category: "design",
    icon: "palette",
    name: { en: "Design Critique", "pt-BR": "Critica de design" },
    description: {
      en: "Give structured, usable feedback on a design, from first impression to details.",
      "pt-BR":
        "Dá um retorno estruturado e útil sobre um design, da primeira impressão aos detalhes.",
    },
    body: {
      en: `Critique a design (screen, page, flyer, logo, post) so the designer knows exactly what to change.

1. Ask what it is for, who will use or see it and where, unless it is clear.
2. Start with the first impression in one sentence: what you notice first and whether it is the right thing.
3. Review in this order and keep each point short: purpose and message, hierarchy (what is read first, second, third), layout and spacing, type and color, consistency, usability (can the person do the main task), accessibility (contrast, size, touch targets).
4. For every problem, say what is wrong, why it matters to the person using it, and one concrete way to fix it. Rate each as must fix, should fix or nice to have.
5. Say what works and should be kept; a critique that only lists faults gets ignored.
6. End with the three changes that would improve the design most.
Talk about the design, never the designer. Base the feedback on the purpose and the audience, not on personal taste, and say when something is only taste.`,
      "pt-BR": `Faça a crítica de um design (tela, página, folheto, logo, post) para o designer saber exatamente o que mudar.

1. Pergunte para que serve, quem vai usar ou ver e onde, a menos que esteja claro.
2. Comece pela primeira impressão em uma frase: o que você nota primeiro e se é a coisa certa.
3. Revise nesta ordem e mantenha cada ponto curto: propósito e mensagem, hierarquia (o que se lê primeiro, segundo, terceiro), layout e espaçamento, tipografia e cor, consistência, usabilidade (a pessoa consegue fazer a tarefa principal), acessibilidade (contraste, tamanho, áreas de toque).
4. Para cada problema, diga o que está errado, por que importa a quem usa e um jeito concreto de corrigir. Classifique como corrigir já, corrigir em breve ou desejável.
5. Diga o que funciona e deve ser mantido; uma crítica que só lista defeitos é ignorada.
6. Termine com as três mudanças que mais melhorariam o design.
Fale do design, nunca do designer. Baseie o retorno no propósito e no público, não no gosto pessoal, e diga quando algo é só gosto.`,
    },
  },
  {
    slug: "interface-design",
    category: "design",
    icon: "palette",
    name: { en: "Interface Design", "pt-BR": "Design de interface" },
    description: {
      en: "Give a new screen or site a deliberate visual direction instead of a generic look.",
      "pt-BR":
        "Dá a uma tela ou site novo uma direção visual deliberada, em vez de um visual genérico.",
    },
    body: {
      en: `Design or redesign an interface with a deliberate direction.

1. Before drawing anything, answer in a few lines: what is this for, who uses it, in what situation (in a hurry, on a phone, at a desk), and what should they feel and do.
2. Choose one visual direction and say it in a sentence (for example "calm and trustworthy, like a good clinic" or "bold and playful, like a street market"). Everything below must serve it.
3. Decide, and justify in a line each: typography (one or two families, a clear scale), color (a main color, a neutral base, one accent, and colors for success, warning and error), spacing (a consistent scale) and shape (rounded or sharp).
4. Lay out the main screen in order of importance: what comes first, second and third, and the one action that matters most.
5. Avoid the generic look: default fonts used with no reason, purple gradients, cards inside cards, and decoration that does not help the person.
6. Describe the states: empty, loading, error, success.
7. Deliver the direction, the choices and the screen as a clear description or a simple wireframe the designer or developer can build.
Check contrast and text size, and keep the interface simple enough that someone using it for the first time succeeds.`,
      "pt-BR": `Projete ou refaça uma interface com uma direção deliberada.

1. Antes de desenhar qualquer coisa, responda em poucas linhas: para que serve, quem usa, em que situação (com pressa, no celular, na mesa), e o que a pessoa deve sentir e fazer.
2. Escolha uma direção visual e diga em uma frase (por exemplo "calma e confiável, como uma boa clínica" ou "ousada e divertida, como uma feira de rua"). Tudo abaixo precisa servir a ela.
3. Decida, e justifique em uma linha cada: tipografia (uma ou duas famílias, uma escala clara), cor (uma cor principal, uma base neutra, um destaque e cores para sucesso, aviso e erro), espaçamento (uma escala consistente) e forma (arredondada ou reta).
4. Organize a tela principal por ordem de importância: o que vem primeiro, segundo e terceiro, e a única ação que mais importa.
5. Evite o visual genérico: fontes padrão sem motivo, gradientes roxos, cartões dentro de cartões e enfeites que não ajudam a pessoa.
6. Descreva os estados: vazio, carregando, erro, sucesso.
7. Entregue a direção, as escolhas e a tela como uma descrição clara ou um wireframe simples que o designer ou o desenvolvedor possa construir.
Confira contraste e tamanho do texto e mantenha a interface simples o bastante para quem usa pela primeira vez conseguir.`,
    },
  },
  {
    slug: "ux-writing",
    category: "design",
    icon: "file",
    name: { en: "UX Writing", "pt-BR": "Texto de interface" },
    description: {
      en: "Write clear button, message and error text that helps people finish what they came to do.",
      "pt-BR": "Escreve textos claros de botões, mensagens e erros que ajudam a pessoa a concluir.",
    },
    body: {
      en: `Write or improve the words inside a product: buttons, labels, empty states, confirmations and errors.

1. Ask where the text appears, what the person is trying to do at that moment and how they feel (in a hurry, worried, curious).
2. Write for that moment: say what happened and what to do next, in plain words, as short as possible.
3. Buttons say what will happen ("Save changes", not "Submit"). Labels name the thing. Do not use jargon or internal names.
4. Error messages say what went wrong and how to fix it, without blaming the person and without codes. Never write just "Something went wrong" when you can say more.
5. Empty states explain what will appear here and offer the first action.
6. Keep the same word for the same thing everywhere, and the same tone.
7. Offer two or three options for the important texts, and a one-line reason for your pick.
Deliver the texts in a table: where it appears, current text, new text. When the product is in more than one language, write each language naturally instead of translating word for word.`,
      "pt-BR": `Escreva ou melhore as palavras dentro de um produto: botões, rótulos, estados vazios, confirmações e erros.

1. Pergunte onde o texto aparece, o que a pessoa está tentando fazer naquele momento e como ela está (com pressa, preocupada, curiosa).
2. Escreva para esse momento: diga o que aconteceu e o que fazer em seguida, em palavras simples, o mais curto possível.
3. Botões dizem o que vai acontecer ("Salvar alterações", não "Enviar"). Rótulos nomeiam a coisa. Não use jargão nem nomes internos.
4. Mensagens de erro dizem o que deu errado e como corrigir, sem culpar a pessoa e sem códigos. Nunca escreva só "Algo deu errado" quando dá para dizer mais.
5. Estados vazios explicam o que vai aparecer ali e oferecem a primeira ação.
6. Use a mesma palavra para a mesma coisa em todo lugar, e o mesmo tom.
7. Ofereça duas ou três opções para os textos importantes e uma linha com o motivo da sua escolha.
Entregue os textos em uma tabela: onde aparece, texto atual, texto novo. Quando o produto tem mais de um idioma, escreva cada idioma de forma natural em vez de traduzir palavra por palavra.`,
    },
  },
  {
    slug: "accessibility-check",
    category: "design",
    icon: "check",
    name: { en: "Accessibility Check", "pt-BR": "Checagem de acessibilidade" },
    description: {
      en: "Check a design or page for contrast, size, touch, keyboard and screen reader problems.",
      "pt-BR": "Confere um design ou página: contraste, tamanho, toque, teclado e leitor de tela.",
    },
    body: {
      en: `Check a design, page or app for accessibility problems.

1. Ask what to check (a screen, a page, a flow) and the platform (web, phone).
2. Check and report, grouped by who is affected:
   - Seeing: text contrast against the background (enough for normal text and for large text), information carried by color alone, text that stays readable when enlarged, and images with a text alternative.
   - Hearing: captions or a transcript for video and audio.
   - Moving: touch targets big enough and spaced apart, everything reachable by keyboard in a sensible order with a visible focus, and no need for precise gestures or timing.
   - Thinking and reading: clear language, labels that stay visible, errors that say how to fix, and no content that flashes.
   - Screen readers: headings in order, buttons and links with names that make sense, form fields with labels.
3. For each problem, say where it is, who it affects, how serious it is, and the fix.
4. End with the three fixes that help the most people first.
Say what you could not check from what you were shown. This is a review to find problems, not a certificate of compliance.`,
      "pt-BR": `Confira um design, página ou aplicativo atrás de problemas de acessibilidade.

1. Pergunte o que conferir (uma tela, uma página, um fluxo) e a plataforma (web, celular).
2. Confira e relate, agrupando por quem é afetado:
   - Enxergar: contraste do texto com o fundo (suficiente para texto normal e para texto grande), informação passada só pela cor, texto que continua legível ampliado e imagens com texto alternativo.
   - Ouvir: legendas ou transcrição para vídeo e áudio.
   - Mover-se: áreas de toque grandes e afastadas, tudo alcançável pelo teclado em uma ordem lógica com foco visível, e nada que exija gestos ou tempo precisos.
   - Pensar e ler: linguagem clara, rótulos que continuam visíveis, erros que dizem como corrigir e nada que pisque.
   - Leitores de tela: títulos em ordem, botões e links com nomes que façam sentido, campos de formulário com rótulos.
3. Para cada problema, diga onde está, quem afeta, a gravidade e a correção.
4. Termine com as três correções que ajudam mais pessoas primeiro.
Diga o que você não conseguiu conferir a partir do que lhe foi mostrado. É uma revisão para achar problemas, não um certificado de conformidade.`,
    },
  },
  {
    slug: "design-handoff",
    category: "design",
    icon: "list",
    name: { en: "Design Handoff", "pt-BR": "Entrega de design" },
    description: {
      en: "Turn a design into a spec a developer can build without guessing.",
      "pt-BR":
        "Transforma um design em uma especificação que o desenvolvedor constrói sem adivinhar.",
    },
    body: {
      en: `Turn a design into a clear spec for the developer.

1. Ask for the design (image, link or description) and what it should do.
2. Write the spec in order: the goal of the screen, the layout and the order of the elements, and the sizes, spacing, colors and fonts as values (not "a bit bigger").
3. List every state of each interactive element: default, hover, pressed, disabled, focused, loading, empty, error and success.
4. Describe how it behaves on different screen sizes and when text is longer than in the design.
5. List the assets to export (icons, images, formats and sizes) and the exact texts, including error and empty messages.
6. List what happens when the user taps or clicks each thing, and any animation with its duration.
7. Close with the open questions and anything the design does not decide, so the developer asks before building and not after.
Be precise and short. Use a table for values. Say what you inferred from the design instead of stating it as fact.`,
      "pt-BR": `Transforme um design em uma especificação clara para o desenvolvedor.

1. Peça o design (imagem, link ou descrição) e o que ele deve fazer.
2. Escreva a especificação em ordem: o objetivo da tela, o layout e a ordem dos elementos, e os tamanhos, espaçamentos, cores e fontes como valores (não "um pouco maior").
3. Liste todos os estados de cada elemento interativo: padrão, ao passar o mouse, pressionado, desativado, com foco, carregando, vazio, erro e sucesso.
4. Descreva como se comporta em telas de tamanhos diferentes e quando o texto é mais longo do que no design.
5. Liste os recursos a exportar (ícones, imagens, formatos e tamanhos) e os textos exatos, inclusive as mensagens de erro e de estado vazio.
6. Liste o que acontece quando o usuário toca ou clica em cada coisa e qualquer animação com a duração.
7. Feche com as perguntas em aberto e tudo que o design não decide, para o desenvolvedor perguntar antes de construir e não depois.
Seja preciso e curto. Use uma tabela para os valores. Diga o que você inferiu do design em vez de afirmar como fato.`,
    },
  },
  {
    slug: "brand-kit",
    category: "design",
    icon: "palette",
    name: { en: "Brand Kit", "pt-BR": "Identidade visual" },
    description: {
      en: "Put colors, fonts, logo rules and tone in a one-page guide anyone can follow.",
      "pt-BR": "Reúne cores, fontes, regras do logo e tom em um guia de uma página.",
    },
    body: {
      en: `Create a one-page brand guide so everything the business makes looks and sounds like it.

1. Ask for what already exists (logo, colors, fonts, examples of materials) and what the brand should feel like.
2. Write the guide with: a one-line description of the brand, the main and secondary colors with their codes and when to use each, the fonts for titles and for text, and the sizes that work.
3. Logo rules: the versions (on light, on dark), the clear space around it, the minimum size and what not to do (stretch, recolor, add effects).
4. Image style: what photos and illustrations look like and what to avoid.
5. Tone of voice in five lines and three example sentences.
6. A short checklist before publishing anything: logo right, colors right, text readable, tone right.
Use only what the business already has or approves; suggest options when something is missing and let the owner choose. Do not copy another brand's identity.`,
      "pt-BR": `Crie um guia de marca de uma página para tudo que o negócio faz ter a mesma cara e o mesmo jeito de falar.

1. Pergunte o que já existe (logo, cores, fontes, exemplos de materiais) e o que a marca deve transmitir.
2. Escreva o guia com: uma linha descrevendo a marca, as cores principais e secundárias com seus códigos e quando usar cada uma, as fontes de títulos e de texto e os tamanhos que funcionam.
3. Regras do logo: as versões (sobre fundo claro e escuro), a área livre ao redor, o tamanho mínimo e o que não fazer (esticar, trocar a cor, acrescentar efeitos).
4. Estilo de imagem: como são as fotos e ilustrações e o que evitar.
5. Tom de voz em cinco linhas e três frases de exemplo.
6. Um checklist curto antes de publicar qualquer coisa: logo certo, cores certas, texto legível, tom certo.
Use só o que o negócio já tem ou aprova; sugira opções quando algo faltar e deixe o dono escolher. Não copie a identidade de outra marca.`,
    },
  },
];
