import type { SkillStoreEntry } from "@corvo/contracts";
import { FINANCE_SKILLS } from "./skill-store-finance.js";
import { MANAGEMENT_SKILLS } from "./skill-store-management.js";
import { MARKETING_SKILLS } from "./skill-store-marketing.js";

/** Ready-made skills. Wording is original; names avoid accents so the pickers match as typed. */
const BASE_SKILLS: readonly SkillStoreEntry[] = [
  {
    slug: "change-review",
    category: "development",
    icon: "code",
    name: { en: "Change Review", "pt-BR": "Revisao de mudanca" },
    description: {
      en: "Review a code change for bugs, regressions and missing tests.",
      "pt-BR": "Revisa uma mudança de código atrás de bugs, regressões e testes que faltam.",
    },
    body: {
      en: `Review the change the user points at. Read the code around it before judging it.

1. Say in one line what the change is meant to do.
2. Look for real failures: wrong logic, unhandled errors, edge cases, callers that break.
3. For each suspicion, name the input or state that triggers it. Drop what you cannot show.
4. Check whether the tests cover the risky paths.
5. End with a verdict (ship, ship after fixes, do not ship) and the confirmed findings, worst first. If nothing holds up, say so instead of listing nitpicks.`,
      "pt-BR": `Revise a mudança que o usuário indicar. Leia o código ao redor antes de julgar.

1. Diga em uma linha o que a mudança pretende fazer.
2. Procure falhas reais: lógica errada, erros sem tratamento, casos de borda, chamadores que quebram.
3. Para cada suspeita, diga a entrada ou o estado que a provoca. Descarte o que não conseguir demonstrar.
4. Veja se os testes cobrem os caminhos arriscados.
5. Termine com um veredito (pode entrar, entra depois de ajustes, não deve entrar) e os achados confirmados, do pior ao menor. Se nada se sustentar, diga isso em vez de listar detalhes.`,
    },
  },
  {
    slug: "project-plan",
    category: "operations",
    icon: "list",
    name: { en: "Project Plan", "pt-BR": "Plano de projeto" },
    description: {
      en: "Turn a goal into a small first deliverable and the steps after it.",
      "pt-BR": "Transforma um objetivo em uma primeira entrega pequena e nos passos seguintes.",
    },
    body: {
      en: `Turn the user's goal into a plan.

1. Ask for the goal, the deadline and who is involved if they are missing.
2. Propose a small first deliverable that proves the idea.
3. List the steps after it. For each step give an owner, what it depends on and how you will know it is done.
4. Say what is still unknown and what could block the plan.
Keep it to one page.`,
      "pt-BR": `Transforme o objetivo do usuário em um plano.

1. Pergunte o objetivo, o prazo e quem participa, se faltar.
2. Proponha uma primeira entrega pequena que prove a ideia.
3. Liste os passos seguintes. Para cada um, diga quem cuida, de que depende e como saber que acabou.
4. Diga o que ainda é incerto e o que pode bloquear o plano.
Mantenha em uma página.`,
    },
  },
  {
    slug: "evidence-brief",
    category: "knowledge",
    icon: "search",
    name: { en: "Evidence Brief", "pt-BR": "Resumo com evidencias" },
    description: {
      en: "Summarize sources into a brief that separates facts from interpretation.",
      "pt-BR": "Resume fontes em um texto que separa fatos de interpretação.",
    },
    body: {
      en: `Write a brief from the sources the user gives you or that you find.

1. Start with the conclusion in one or two sentences.
2. List the facts, each with the link or document it comes from.
3. Add your interpretation separately and mark it as yours.
4. List the open questions and what would settle them.
Never state something no source supports.`,
      "pt-BR": `Escreva um resumo a partir das fontes que o usuário der ou que você encontrar.

1. Comece pela conclusão em uma ou duas frases.
2. Liste os fatos, cada um com o link ou documento de onde vem.
3. Coloque sua interpretação separada e marque como sua.
4. Liste as perguntas em aberto e o que as resolveria.
Nunca afirme algo que nenhuma fonte sustente.`,
    },
  },
  {
    slug: "meeting-notes",
    category: "operations",
    icon: "file",
    name: { en: "Meeting Notes", "pt-BR": "Ata de reuniao" },
    description: {
      en: "Turn raw notes into decisions, next steps and owners.",
      "pt-BR": "Transforma anotações soltas em decisões, próximos passos e responsáveis.",
    },
    body: {
      en: `Turn the notes or transcript into a short record.

1. One line on what the meeting was about and who was there.
2. Decisions made, each in a sentence.
3. Next steps, each with an owner and a date when one was said.
4. Open questions.
Do not add anything that was not said. If an owner or date is unclear, write "to confirm".`,
      "pt-BR": `Transforme as anotações ou a transcrição em um registro curto.

1. Uma linha sobre o assunto da reunião e quem participou.
2. Decisões tomadas, cada uma em uma frase.
3. Próximos passos, cada um com responsável e data quando foi dita.
4. Perguntas em aberto.
Não acrescente nada que não foi dito. Se faltar responsável ou data, escreva "a confirmar".`,
    },
  },
  {
    slug: "bug-report",
    category: "development",
    icon: "code",
    name: { en: "Bug Report", "pt-BR": "Relato de bug" },
    description: {
      en: "Write a bug report with steps to reproduce, expected and actual behavior.",
      "pt-BR": "Escreve um relato de bug com passos para reproduzir, esperado e obtido.",
    },
    body: {
      en: `Write a bug report from what the user describes or from the error you are shown.

1. Title: what breaks, in one line.
2. Steps to reproduce, numbered and as short as possible.
3. What you expected and what happened instead.
4. Where it happens (version, device, account type) and how often.
5. The most likely cause, labeled as a guess.
Ask for the one missing detail that blocks reproduction before writing, if there is one.`,
      "pt-BR": `Escreva um relato de bug a partir do que o usuário descrever ou do erro mostrado.

1. Título: o que quebra, em uma linha.
2. Passos para reproduzir, numerados e o mais curtos possível.
3. O que era esperado e o que aconteceu.
4. Onde acontece (versão, aparelho, tipo de conta) e com que frequência.
5. A causa mais provável, marcada como palpite.
Se faltar o único detalhe que impede reproduzir, pergunte antes de escrever.`,
    },
  },
  {
    slug: "decision-check",
    category: "knowledge",
    icon: "check",
    name: { en: "Decision Check", "pt-BR": "Checagem de decisao" },
    description: {
      en: "Add a quick self-check before a recommendation that matters.",
      "pt-BR": "Faz uma autochecagem rápida antes de uma recomendação importante.",
    },
    body: {
      en: `Before you give a recommendation, estimate or plan that someone will act on, check it.

1. What are you assuming? List the two assumptions that matter most.
2. What would change your answer?
3. What is the cost if you are wrong, and can it be undone?
Give the recommendation after that, with the confidence you really have. If the check shows you cannot answer, say what you need.`,
      "pt-BR": `Antes de dar uma recomendação, estimativa ou plano em que alguém vai se basear, confira.

1. O que você está assumindo? Liste as duas suposições que mais importam.
2. O que mudaria sua resposta?
3. Qual o custo se você estiver errado, e dá para desfazer?
Depois disso, dê a recomendação com a confiança que você realmente tem. Se a checagem mostrar que não dá para responder, diga o que precisa.`,
    },
  },
  {
    slug: "email-reply",
    category: "support",
    icon: "mail",
    name: { en: "Email Reply", "pt-BR": "Resposta de email" },
    description: {
      en: "Draft a short, polite reply that answers what was asked.",
      "pt-BR": "Escreve uma resposta curta e educada que responde ao que foi perguntado.",
    },
    body: {
      en: `Draft a reply to the email the user shows you.

1. Answer what was asked, first.
2. Keep it short: a few sentences, plain words, the tone the sender used.
3. If you cannot answer something, say what you need and by when.
4. Do not promise anything the user did not say you can do.
Show the draft and let the user send it.`,
      "pt-BR": `Escreva uma resposta ao email que o usuário mostrar.

1. Responda primeiro o que foi perguntado.
2. Seja breve: poucas frases, palavras simples, no tom que a pessoa usou.
3. Se não puder responder algo, diga o que precisa e até quando.
4. Não prometa nada que o usuário não disse que pode fazer.
Mostre o rascunho e deixe o usuário enviar.`,
    },
  },
  {
    slug: "weekly-summary",
    category: "operations",
    icon: "list",
    name: { en: "Weekly Summary", "pt-BR": "Resumo semanal" },
    description: {
      en: "Summarize the week: what got done, what is stuck and what comes next.",
      "pt-BR": "Resume a semana: o que foi feito, o que travou e o que vem a seguir.",
    },
    body: {
      en: `Write the weekly summary from the work, tickets or notes available.

1. Done: the few things that matter, one line each.
2. Stuck: what is blocked, by what, and who can unblock it.
3. Next: the three most important things for next week.
Keep it under 200 words and lead with the most important point.`,
      "pt-BR": `Escreva o resumo semanal a partir do trabalho, tarefas ou notas disponíveis.

1. Feito: as poucas coisas que importam, uma linha cada.
2. Travado: o que está bloqueado, por quê e quem pode destravar.
3. Próximo: as três coisas mais importantes da semana que vem.
Mantenha abaixo de 200 palavras e comece pelo ponto mais importante.`,
    },
  },
];

/** Every skill in the store. */
export const SKILL_STORE: readonly SkillStoreEntry[] = [
  ...BASE_SKILLS,
  ...FINANCE_SKILLS,
  ...MARKETING_SKILLS,
  ...MANAGEMENT_SKILLS,
];
