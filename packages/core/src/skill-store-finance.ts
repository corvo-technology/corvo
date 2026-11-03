import type { SkillStoreEntry } from "@corvo/contracts";

/**
 * Money skills for a small business in Brazil: cash, billing, month close, reports, payroll and
 * taxes. Written for Rook. They prepare the work and never pay, file or decide; anything with
 * legal or tax weight goes to the person's accountant (contador). Names stay plain (no accents)
 * so the `/` and `@` pickers match them as typed.
 */
export const FINANCE_SKILLS: readonly SkillStoreEntry[] = [
  {
    slug: "cash-flow-forecast",
    category: "finance",
    icon: "money",
    name: { en: "Cash Flow Forecast", "pt-BR": "Fluxo de caixa" },
    description: {
      en: "Forecast the next 30, 60 and 90 days of cash and flag the weeks at risk.",
      "pt-BR": "Projeta o caixa dos próximos 30, 60 e 90 dias e avisa as semanas de risco.",
    },
    body: {
      en: `Build a cash forecast for the next 30, 60 and 90 days.

1. Ask for what you cannot read: today's balance in each account, and the source of the data (bank export, sheet or accounting tool).
2. List money coming in, week by week: invoices and boletos due, Pix, and card sales. Card sales settle days after the sale and installment (parcelado) sales arrive in parts, so use the real settlement dates, not the sale date. Note any receivables advance (antecipação) and its cost.
3. List money going out, week by week: suppliers, rent, payroll with its charges (FGTS, INSS, 13th salary and vacation reserve), taxes and loan payments.
4. Show the balance at the end of each week in a table.
5. Flag up to five risks, worst first: the weeks the balance goes negative, the customers that usually pay late, and the biggest payments.
6. Close with two or three actions, such as chasing a specific invoice, moving a payment, or asking a supplier for time.
Use reais, dates as DD/MM/YYYY, and mark every number you estimated as an estimate. You only read and calculate; never move money. This is a planning aid, not accounting advice: confirm with your contador.`,
      "pt-BR": `Monte uma projeção de caixa para os próximos 30, 60 e 90 dias.

1. Pergunte o que você não consegue ler: o saldo de hoje em cada conta e a origem dos dados (extrato, planilha ou sistema de contabilidade).
2. Liste as entradas, semana a semana: faturas e boletos a vencer, Pix e vendas no cartão. A venda no cartão cai dias depois e a venda parcelada chega em partes, então use as datas reais de recebimento, não a data da venda. Anote qualquer antecipação de recebíveis e o custo dela.
3. Liste as saídas, semana a semana: fornecedores, aluguel, folha com os encargos (FGTS, INSS, reserva de 13º e férias), impostos e parcelas de empréstimo.
4. Mostre o saldo no fim de cada semana em uma tabela.
5. Aponte até cinco riscos, do pior ao menor: as semanas em que o saldo fica negativo, os clientes que costumam atrasar e os maiores pagamentos.
6. Feche com duas ou três ações, como cobrar uma fatura específica, mover um pagamento ou pedir prazo a um fornecedor.
Use reais, datas como DD/MM/AAAA e marque como estimativa todo número que você estimou. Você só lê e calcula; nunca movimente dinheiro. É um apoio de planejamento, não orientação contábil: confirme com o seu contador.`,
    },
  },
  {
    slug: "invoice-chase",
    category: "finance",
    icon: "mail",
    name: { en: "Invoice Chase", "pt-BR": "Cobranca de clientes" },
    description: {
      en: "List overdue invoices and draft a reminder for each, firmer as the delay grows.",
      "pt-BR":
        "Lista as faturas atrasadas e escreve um lembrete para cada, mais firme com o atraso.",
    },
    body: {
      en: `Help the owner collect what customers owe.

1. List overdue invoices: customer, amount, due date and days late. Rank by amount and age.
2. For each one, draft a reminder with the amount, the due date and how to pay (Pix key or boleto link). First reminder: friendly, assumes an oversight. After 15 days: clear about the new date. After 30 days: tell the owner a call is probably better and suggest what to say.
3. Check first whether the customer has anything open that explains the delay: a dispute, a missing document or a returned item.
4. Offer a payment plan only when the owner tells you the terms.
Show the drafts and let the owner send them; never send, charge or change an invoice yourself. Do not threaten or mention legal action or credit bureaus.`,
      "pt-BR": `Ajude o dono a receber o que os clientes devem.

1. Liste as faturas atrasadas: cliente, valor, vencimento e dias de atraso. Ordene por valor e tempo de atraso.
2. Para cada uma, escreva um lembrete com o valor, o vencimento e como pagar (chave Pix ou link do boleto). Primeiro lembrete: simpático, presume um esquecimento. Depois de 15 dias: claro sobre a nova data. Depois de 30 dias: diga ao dono que provavelmente é melhor ligar e sugira o que falar.
3. Veja antes se o cliente tem algo em aberto que explique o atraso: uma disputa, um documento faltando ou uma devolução.
4. Só ofereça parcelamento quando o dono disser as condições.
Mostre os rascunhos e deixe o dono enviar; nunca envie, cobre nem altere uma fatura você mesmo. Não ameace nem cite ação judicial ou protesto.`,
    },
  },
  {
    slug: "month-close",
    category: "finance",
    icon: "check",
    name: { en: "Month Close", "pt-BR": "Fechamento do mes" },
    description: {
      en: "Walk through the month-end checklist and prepare what the accountant needs.",
      "pt-BR": "Percorre o checklist do fim do mês e prepara o que o contador precisa.",
    },
    body: {
      en: `Guide the month-end close so the accountant (contador) gets clean material.

1. Confirm the month and which accounts, cards and payment tools were used.
2. Go through the checklist and mark each item done, pending or not applicable: every bank account and card statement collected; all sales invoices (including NFS-e) issued for the month; supplier invoices and receipts gathered; payments and receipts matched to the statement; cash and petty cash counted; customers' overdue amounts listed; loans and installments recorded; payroll and its charges ready.
3. For each pending item say what is missing and who can provide it.
4. List the unusual items to explain to the contador: large or one-off amounts, personal expenses paid by the company, and anything without a receipt.
5. Produce a short summary: what is ready, what is pending, what to send and by when.
Do not file, pay or adjust anything. Use the contador's deadline if the owner gives one; otherwise suggest sending in the first days of the next month.`,
      "pt-BR": `Conduza o fechamento do mês para o contador receber um material limpo.

1. Confirme o mês e quais contas, cartões e meios de pagamento foram usados.
2. Percorra o checklist e marque cada item como feito, pendente ou não se aplica: extratos de todas as contas e cartões reunidos; todas as notas de venda (inclusive NFS-e) emitidas no mês; notas e comprovantes de fornecedores reunidos; pagamentos e recebimentos conferidos com o extrato; caixa e caixa pequeno contados; valores atrasados dos clientes listados; empréstimos e parcelas lançados; folha e encargos prontos.
3. Para cada pendência diga o que falta e quem pode fornecer.
4. Liste os itens fora do comum para explicar ao contador: valores altos ou únicos, despesas pessoais pagas pela empresa e tudo que estiver sem comprovante.
5. Entregue um resumo curto: o que está pronto, o que está pendente, o que enviar e até quando.
Não declare, pague nem ajuste nada. Use o prazo do contador se o dono informar; senão sugira enviar nos primeiros dias do mês seguinte.`,
    },
  },
  {
    slug: "monthly-result",
    category: "finance",
    icon: "chart",
    name: { en: "Monthly Result", "pt-BR": "Resultado mensal" },
    description: {
      en: "Build a simple monthly income statement and explain what changed from last month.",
      "pt-BR": "Monta um DRE mensal simples e explica o que mudou em relação ao mês anterior.",
    },
    body: {
      en: `Write a simple monthly income statement (DRE) from the figures the owner gives you or you can read.

1. Gross revenue, then the deductions on sales (taxes and returns), to net revenue.
2. Costs of goods or services delivered, to gross profit and the gross margin.
3. Operating expenses grouped in a few lines (people, rent and utilities, marketing, software, other), to the operating result.
4. Financial income and expenses, to the result of the month and the net margin.
5. Compare each line with the previous month: the change in reais and in percent. Explain the three biggest changes in one sentence each and say which are one-off.
6. End with two questions the owner should answer to improve the next month.
Put the table first and the reading after it. Say which figures are missing or estimated. Follow the cash or accrual view you were given; if you cannot tell which it is, ask. It is a management view, not the official statement from the contador.`,
      "pt-BR": `Escreva um DRE mensal simples com os números que o dono der ou que você conseguir ler.

1. Receita bruta, depois as deduções sobre vendas (impostos e devoluções), até a receita líquida.
2. Custo das mercadorias ou dos serviços entregues, até o lucro bruto e a margem bruta.
3. Despesas operacionais agrupadas em poucas linhas (pessoas, aluguel e contas, marketing, sistemas, outras), até o resultado operacional.
4. Receitas e despesas financeiras, até o resultado do mês e a margem líquida.
5. Compare cada linha com o mês anterior: a variação em reais e em percentual. Explique as três maiores mudanças em uma frase cada e diga quais são pontuais.
6. Termine com duas perguntas que o dono deve responder para melhorar o próximo mês.
Coloque a tabela primeiro e a leitura depois. Diga quais números faltam ou são estimados. Siga o regime de caixa ou de competência que lhe foi dado; se não der para saber, pergunte. É uma visão gerencial, não a demonstração oficial do contador.`,
    },
  },
  {
    slug: "bank-reconciliation",
    category: "finance",
    icon: "check",
    name: { en: "Bank Reconciliation", "pt-BR": "Conciliacao bancaria" },
    description: {
      en: "Match the bank statement to your records and list what does not match.",
      "pt-BR": "Confere o extrato com os seus registros e lista o que não bate.",
    },
    body: {
      en: `Reconcile the bank statement with the owner's records for a period.

1. Take the statement lines and the records (sales, receipts, payments). Confirm the period and the opening and closing balance.
2. Match each statement line to a record by amount, date and description. Pix, boleto and card settlements often differ from the sale: card payouts come net of fees and in installments, so match them by settlement and list the fee as its own line.
3. Report three groups: matched, in the statement but not in the records (find out what they are), and in the records but not in the statement (not paid or received yet).
4. Check that opening balance plus movements equals the closing balance, and show the difference, if any.
5. Flag duplicates, bank and card fees, interest, and anything that looks unusual.
Never change a record or a balance yourself; give the owner the list and a suggested correction for each item. This prepares the work for the contador.`,
      "pt-BR": `Faça a conciliação do extrato bancário com os registros do dono em um período.

1. Pegue as linhas do extrato e os registros (vendas, recebimentos, pagamentos). Confirme o período e os saldos inicial e final.
2. Combine cada linha do extrato com um registro por valor, data e descrição. Pix, boleto e cartão costumam diferir da venda: o repasse do cartão vem líquido de taxas e parcelado, então combine pelo recebimento e liste a taxa em uma linha própria.
3. Informe três grupos: conciliados, no extrato mas fora dos registros (descubra o que são) e nos registros mas fora do extrato (ainda não pagos ou recebidos).
4. Confira se o saldo inicial mais as movimentações é igual ao saldo final e mostre a diferença, se houver.
5. Aponte duplicidades, tarifas bancárias e do cartão, juros e tudo que parecer fora do comum.
Nunca altere um registro nem um saldo você mesmo; entregue ao dono a lista e uma sugestão de correção para cada item. Isso prepara o trabalho para o contador.`,
    },
  },
  {
    slug: "bills-to-pay",
    category: "finance",
    icon: "calendar",
    name: { en: "Bills to Pay", "pt-BR": "Contas a pagar" },
    description: {
      en: "Rank what is due, check each bill and propose a payment order for your cash.",
      "pt-BR": "Ordena o que vence, confere cada conta e propõe a ordem de pagamento.",
    },
    body: {
      en: `Organize the bills to pay and propose an order.

1. List every bill: supplier, amount, due date, how it is paid (boleto, Pix, transfer) and whether there is a late fee or interest.
2. Check each one before it is paid: is the supplier known, does the amount match the order or contract, is it a duplicate of one already paid, did the bank details change since last time. Flag anything that does not fit; a changed Pix key or bank account on a known supplier must be confirmed by phone.
3. Rank by what costs most to delay: taxes and payroll first, then bills with late fees, then the rest.
4. Compare the total due this week with the cash available and propose what to pay now, what to move and what to negotiate. Say what each choice costs.
Never pay anything and never change payment details yourself. Prepare the list; the owner approves and pays.`,
      "pt-BR": `Organize as contas a pagar e proponha uma ordem.

1. Liste cada conta: fornecedor, valor, vencimento, forma de pagamento (boleto, Pix, transferência) e se há multa ou juros por atraso.
2. Confira cada uma antes de pagar: o fornecedor é conhecido, o valor bate com o pedido ou o contrato, é duplicada de uma já paga, os dados bancários mudaram desde a última vez. Aponte o que não se encaixa; uma chave Pix ou conta nova de um fornecedor conhecido precisa ser confirmada por telefone.
3. Ordene pelo que custa mais atrasar: impostos e folha primeiro, depois as contas com multa, depois o resto.
4. Compare o total a vencer na semana com o caixa disponível e proponha o que pagar agora, o que mover e o que negociar. Diga quanto cada escolha custa.
Nunca pague nada nem altere dados de pagamento você mesmo. Prepare a lista; o dono aprova e paga.`,
    },
  },
  {
    slug: "payroll-prep",
    category: "finance",
    icon: "users",
    name: { en: "Payroll Prep", "pt-BR": "Preparar a folha" },
    description: {
      en: "Collect what the accountant needs for payroll and flag what looks wrong.",
      "pt-BR": "Reúne o que o contador precisa para a folha e aponta o que parece errado.",
    },
    body: {
      en: `Prepare the information for the month's payroll. The accountant (contador) or the payroll system calculates and files; you prepare and check.

1. List the team: name, role, contract type and any change since last month (hire, termination, raise, leave).
2. Collect the variable items per person: hours and overtime, commissions, bonuses, absences, vacation, advances and discounts.
3. Check against last month and flag what jumped, dropped or is missing, and anyone paid twice or not at all.
4. List the obligations that follow payroll and their dates for the owner to confirm with the contador: FGTS, INSS and income tax withholding, and the reserves for vacation and the 13th salary. Dates and rules change, so never state a date or a rate as certain.
5. Deliver a clean sheet per person and a short list of questions for the contador.
Never calculate final salaries, taxes or severance as if they were official, and never send, pay or file anything. Keep employee data private and share it only with the contador.`,
      "pt-BR": `Prepare as informações da folha do mês. Quem calcula e envia é o contador ou o sistema de folha; você prepara e confere.

1. Liste a equipe: nome, cargo, tipo de contrato e qualquer mudança desde o mês passado (admissão, desligamento, aumento, afastamento).
2. Reúna os itens variáveis por pessoa: horas e horas extras, comissões, bônus, faltas, férias, adiantamentos e descontos.
3. Compare com o mês anterior e aponte o que subiu, caiu ou falta, e quem foi pago duas vezes ou não foi pago.
4. Liste as obrigações que seguem a folha e as datas para o dono confirmar com o contador: FGTS, INSS e imposto de renda retido, e as reservas de férias e de 13º. Datas e regras mudam; nunca afirme uma data ou uma alíquota como certa.
5. Entregue uma ficha limpa por pessoa e uma lista curta de perguntas para o contador.
Nunca calcule salários, impostos ou rescisões finais como se fossem oficiais e nunca envie, pague nem declare nada. Mantenha os dados dos funcionários privados e compartilhe só com o contador.`,
    },
  },
  {
    slug: "tax-calendar",
    category: "finance",
    icon: "calendar",
    name: { en: "Tax Calendar", "pt-BR": "Calendario de impostos" },
    description: {
      en: "Keep the tax obligations of your business in order and ready before each date.",
      "pt-BR": "Mantém as obrigações de impostos da empresa em ordem e prontas antes de cada data.",
    },
    body: {
      en: `Keep the owner's tax routine organized. You do not calculate, file or pay taxes; the accountant (contador) does. You make sure nothing is forgotten.

1. Ask for the company type and tax regime (MEI, Simples Nacional, presumed profit or other) and who is the contador.
2. Build a calendar of the recurring obligations for that regime, such as the monthly Simples or MEI payment slip (DAS), the annual declaration, municipal and state obligations, and the payroll charges if there are employees. Say clearly that dates and rules change and must be confirmed with the contador or the official portal; never state a date as certain.
3. For each obligation list what must be ready before the date: revenue for the month, invoices issued and received, and documents the contador asked for.
4. Each time you are asked, show what is due in the next 30 days, what is ready and what is missing, and draft a short message to the contador for what is missing.
5. Warn when revenue gets close to a limit of the regime, and tell the owner to talk to the contador about it.
This is organization, not tax advice.`,
      "pt-BR": `Mantenha a rotina de impostos do dono organizada. Você não calcula, declara nem paga impostos; quem faz isso é o contador. Você garante que nada seja esquecido.

1. Pergunte o tipo da empresa e o regime tributário (MEI, Simples Nacional, lucro presumido ou outro) e quem é o contador.
2. Monte um calendário das obrigações recorrentes desse regime, como a guia mensal do Simples ou do MEI (DAS), a declaração anual, obrigações municipais e estaduais e os encargos da folha, se há funcionários. Diga com clareza que datas e regras mudam e precisam ser confirmadas com o contador ou no portal oficial; nunca afirme uma data como certa.
3. Para cada obrigação liste o que deve estar pronto antes da data: faturamento do mês, notas emitidas e recebidas e os documentos que o contador pediu.
4. Cada vez que for pedido, mostre o que vence nos próximos 30 dias, o que está pronto e o que falta, e escreva uma mensagem curta ao contador sobre o que falta.
5. Avise quando o faturamento chegar perto de um limite do regime e diga ao dono para conversar com o contador.
Isto é organização, não orientação tributária.`,
    },
  },
  {
    slug: "pricing-margin",
    category: "finance",
    icon: "chart",
    name: { en: "Pricing and Margin", "pt-BR": "Preco e margem" },
    description: {
      en: "Work out the margin, markup and break-even of a product or service.",
      "pt-BR": "Calcula a margem, o markup e o ponto de equilíbrio de um produto ou serviço.",
    },
    body: {
      en: `Help the owner price a product or service.

1. Ask for the costs: what it costs to make or buy, the share of sales taken by taxes, card and platform fees and commissions, shipping, and the fixed costs per month.
2. Calculate the cost per unit including the variable charges, the margin and the markup at the current price, and show the formulas in words.
3. Calculate the price needed for a margin the owner picks, and the break-even: how many units cover the fixed costs.
4. Show three prices side by side (lower, current, higher) with margin and break-even, and say what you would choose and why.
5. Point out the common traps: forgetting card and platform fees, discounts that wipe out the margin, and installment sales that delay the cash.
Use reais and say which numbers are assumptions. A price also depends on the market and the customer; give the numbers, and let the owner decide. You only calculate; never change a price or publish anything yourself.`,
      "pt-BR": `Ajude o dono a precificar um produto ou serviço.

1. Pergunte os custos: quanto custa fazer ou comprar, a parte da venda que vai para impostos, taxas de cartão e de plataforma e comissões, frete e os custos fixos por mês.
2. Calcule o custo por unidade com os encargos variáveis, a margem e o markup no preço atual, e mostre as fórmulas em palavras.
3. Calcule o preço necessário para a margem que o dono escolher e o ponto de equilíbrio: quantas unidades cobrem os custos fixos.
4. Mostre três preços lado a lado (menor, atual, maior) com margem e ponto de equilíbrio, e diga qual você escolheria e por quê.
5. Aponte as armadilhas comuns: esquecer as taxas de cartão e de plataforma, descontos que acabam com a margem e vendas parceladas que atrasam o caixa.
Use reais e diga quais números são suposições. O preço também depende do mercado e do cliente; entregue os números e deixe o dono decidir. Você só calcula; nunca altere um preço nem publique nada você mesmo.`,
    },
  },
  {
    slug: "expense-review",
    category: "finance",
    icon: "search",
    name: { en: "Expense Review", "pt-BR": "Revisao de despesas" },
    description: {
      en: "Find duplicate charges, forgotten subscriptions and costs that grew without a reason.",
      "pt-BR":
        "Acha cobranças duplicadas, assinaturas esquecidas e custos que cresceram sem motivo.",
    },
    body: {
      en: `Review the company's expenses and find where money can be saved.

1. Take the expense list or statements for at least three months.
2. Group them by supplier and by type. For each recurring charge, note the monthly amount and when it started.
3. Find: charges paid twice; subscriptions and software nobody uses or two tools doing the same job; costs that grew more than 10% without a clear reason; fees and interest that could be avoided; and personal expenses mixed in.
4. For each finding write the amount per month and per year, and a next step: cancel, renegotiate, ask the supplier, or ask the owner whether it is still needed.
5. Rank the findings by yearly saving and show the total.
Never cancel anything or contact a supplier yourself. Propose, and let the owner decide.`,
      "pt-BR": `Revise as despesas da empresa e ache onde dá para economizar.

1. Pegue a lista de despesas ou os extratos de pelo menos três meses.
2. Agrupe por fornecedor e por tipo. Para cada cobrança recorrente, anote o valor mensal e quando começou.
3. Procure: cobranças pagas duas vezes; assinaturas e sistemas que ninguém usa ou duas ferramentas que fazem o mesmo; custos que cresceram mais de 10% sem motivo claro; tarifas e juros evitáveis; e despesas pessoais misturadas.
4. Para cada achado escreva o valor por mês e por ano e um próximo passo: cancelar, renegociar, perguntar ao fornecedor ou perguntar ao dono se ainda é necessário.
5. Ordene os achados pela economia anual e mostre o total.
Nunca cancele nada nem fale com um fornecedor você mesmo. Proponha e deixe o dono decidir.`,
    },
  },
];
