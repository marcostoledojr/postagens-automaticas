/**
 * Série "Dores reais do Protheus" (24 semanas)
 *
 * Fonte: dossiê "Mapeamento de Dores Reais (Reclame Aqui)" levantado pelo Marcos em out/2026.
 * Regra: 1 pauta por semana, sempre no post Comercial Oficina1 de SEGUNDA às 08h.
 * O post de quinta (Comercial) continua livre, gerado como antes.
 *
 * A pauta é escolhida pela DATA do slot (não por contador no banco), então
 * regenerar o post da segunda mantém a mesma pauta.
 *
 * Ordem intercalada entre os 6 blocos do dossiê para não concentrar
 * várias semanas seguidas no mesmo assunto (ex: 5 semanas de fiscal).
 */

export type PautaDor = {
  numero: number        // numeração original do dossiê
  bloco: string
  titulo: string
  cenario: string       // situação observada no mercado, sem nomes nem cidades
  dor: string           // a dor na voz de quem viveu, parafraseada
  angulo: string        // posicionamento da Oficina1
  palavraCta: string    // palavra do "comente X" (sem acento, fácil de digitar no celular)
  sintoma: string       // pergunta de autodiagnóstico para o decisor se reconhecer
  oferta: string        // próximo passo concreto oferecido no CTA
}

export type PautaDaSemana = {
  semana: number        // 1 a 24
  total: number
  pauta: PautaDor
}

/** Primeira segunda-feira considerada (BRT). */
export const INICIO_SERIE = '2026-10-12'

/**
 * Segundas de feriado: ficam FORA da série (o Comercial desse dia sai livre)
 * e a pauta é empurrada para a segunda seguinte.
 * 12/10 Nossa Senhora Aparecida | 02/11 Finados | 08/02/2027 Carnaval
 */
export const SEGUNDAS_PULADAS: string[] = ['2026-10-12', '2026-11-02', '2027-02-08']

const B1 = 'Venda, implantação e escopo'
const B2 = 'Consultoria, franquias e customizações'
const B3 = 'Faturamento parado, fiscal e Reforma Tributária'
const B4 = 'Performance, nuvem e ferramentas novas'
const B5 = 'Usabilidade, módulos integrados e atendimento'
const B6 = 'Armadilhas contratuais e licenciamento'

const PAUTAS: Record<number, PautaDor> = {
  1: {
    numero: 1, bloco: B1,
    titulo: 'Venda com mapeamento superficial: proposta barata que vira cobrança extra',
    cenario: 'Empresa assinou a implantação do Protheus sob pressão de fechamento de fim de mês. O levantamento olhou só como o sistema antigo funcionava e ignorou para onde a empresa queria evoluir (multimoedas, por exemplo). Na implantação, avisaram que nada além do precificado seria feito: a empresa usa 2 CNABs e recebeu 1, o envio de boleto por e-mail que existia no sistema antigo sumiu e a força de vendas offline não foi atendida, obrigando a contratar outro sistema à parte.',
    dor: 'A sensação de que o projeto foi precificado por baixo para ganhar a concorrência, e agora cada gap vira uma conta nova. Um sistema mais moderno que não faz nem o que o antigo fazia.',
    angulo: 'Proposta comercial barata pode esconder uma bomba-relógio de aditivos. Na Oficina1 o diagnóstico cobre a operação de hoje e a evolução planejada do negócio antes da assinatura, para o escopo refletir a realidade.',
    palavraCta: 'ESCOPO',
    sintoma: 'Sua implantação já começou a gerar cobrança extra por coisa que o sistema antigo fazia?',
    oferta: 'revisar o seu escopo antes do próximo aditivo',
  },
  2: {
    numero: 2, bloco: B1,
    titulo: 'Projeto de quase R$ 1 milhão que vira elefante branco por falha na implantação e no treinamento',
    cenario: 'Empresas que investiram valores muito altos (na casa de R$ 900 mil) na implantação relatam entrega incompleta, treinamento raso e equipe que não sabe operar o sistema. A diretoria passa a enxergar o ERP como custo e não como ferramenta.',
    dor: 'Gastou-se quase um milhão, a implantação não foi concluída e o treinamento foi ruim. A percepção de que se comprou marketing e de que, depois de implantado, se sofre por anos.',
    angulo: 'O Protheus não é o elefante branco, a condução da implantação é que transforma investimento em frustração. A Oficina1 é chamada para resgatar implantações travadas, ajustar processos e capacitar a equipe para operar com autonomia.',
    palavraCta: 'RESGATE',
    sintoma: 'Seu Protheus custou caro e a equipe ainda não confia nele?',
    oferta: 'entender onde o seu projeto travou e qual o caminho para retomar',
  },
  3: {
    numero: 3, bloco: B1,
    titulo: 'Projeto parado porque o consultor saiu de férias: quase 2 anos sem go-live',
    cenario: 'Implantação se arrastando há quase 24 meses, com relatórios que não funcionam. Quando o consultor responsável saiu de férias, ninguém assumiu o projeto no lugar dele e tudo parou.',
    dor: 'O responsável está de férias, ninguém foi colocado para dar suporte e já são quase dois anos desde a compra do sistema, ainda em implantação.',
    angulo: 'Projeto crítico de ERP não pode depender da agenda de uma única pessoa. Na Oficina1 o cliente contrata uma estrutura com documentação compartilhada, gestão de alocação e retaguarda, sem risco de pessoa-chave.',
    palavraCta: 'CONTINUIDADE',
    sintoma: 'Seu projeto para quando uma pessoa sai de férias?',
    oferta: 'olhar o seu cronograma e o que falta para o go-live',
  },
  4: {
    numero: 4, bloco: B1,
    titulo: 'Cobrança mensal e até negativação sem o sistema ter entrado no ar',
    cenario: 'A implantação atrasou, o ERP nunca foi usado de forma efetiva, apareceram adicionais mensais que o cliente não esperava no contrato e, mesmo sem entrega técnica, as cobranças continuaram e chegaram a negativar o nome da empresa.',
    dor: 'Pagar e ter o nome negativado por um sistema que nunca entrou em operação.',
    angulo: 'Compromisso com o go-live: cronograma real em que o andamento financeiro do projeto caminha junto com a entrega operacional. Na Oficina1 o marco que importa é a operação rodando.',
    palavraCta: 'ENTREGA',
    sintoma: 'Você já paga mensalidade de um sistema que ainda não entrou no ar?',
    oferta: 'entender o que falta para o seu go-live sair do papel',
  },
  5: {
    numero: 5, bloco: B2,
    titulo: 'Customizações mal feitas que travam o sistema e fazem a empresa pagar duas vezes',
    cenario: 'Ao tentar atualizar o Protheus para resolver lentidão no SPED Fiscal, a empresa descobriu que o ambiente estava amarrado por customizações sem padrão feitas no passado. Precisou contratar especialistas só para remover customizações e voltar ao padrão do ERP.',
    dor: 'Gastar duas vezes: uma para customizar errado e outra para desfazer.',
    angulo: 'Customização sem padrão vira caixa-preta que impede atualização e derruba performance. A Oficina1 é chamada para mapear, limpar e devolver o ambiente ao padrão, mantendo só o que agrega ao negócio.',
    palavraCta: 'LIMPEZA',
    sintoma: 'Sua atualização de versão travou por causa de customização antiga?',
    oferta: 'mapear o que da sua customização ainda faz sentido e o que está te prendendo',
  },
  6: {
    numero: 6, bloco: B2,
    titulo: 'Cada consultor ensina o fechamento de estoque de um jeito',
    cenario: 'Não existe método único entre os consultores alocados no projeto. Um ensina a fechar estoque e virar saldo de uma forma, outro ensina de outra. Quando aparece divergência, a culpa vai para o usuário e a saída oferecida é pagar mais horas para ajustar.',
    dor: 'Ser culpado por não ter interpretado o treinamento, quando foram os próprios consultores que ensinaram procedimentos diferentes.',
    angulo: 'Virada de saldo e fechamento de estoque não são questão de opinião do consultor. Na Oficina1 o procedimento é documentado e padronizado, e o time é estável, para o cliente não pagar retrabalho.',
    palavraCta: 'ESTOQUE',
    sintoma: 'O seu fechamento de estoque muda conforme quem ensinou?',
    oferta: 'revisar o seu procedimento de fechamento e virada de saldo',
  },
  7: {
    numero: 7, bloco: B2,
    titulo: 'Culpar o usuário até o erro ficar óbvio, e depois sumir',
    cenario: 'Diante de erros claros na base do sistema e no cálculo do MRP, a postura do atendimento foi sempre tentar transferir a culpa para a empresa contratante. Quando ficou evidente que o problema não era do usuário, as respostas pararam e as solicitações ficaram mais de um mês sem solução.',
    dor: 'Ouvir que talvez o erro seja de interpretação da rotina, enquanto o problema real continua sem ninguém assumir.',
    angulo: 'Quando há erro de base ou de MRP, alguém precisa assumir a frente, investigar a fundo e resolver. Na Oficina1 o time sênior entra para diagnosticar a causa raiz em vez de procurar culpado.',
    palavraCta: 'MRP',
    sintoma: 'Já te disseram que o erro era de interpretação e o problema continuou?',
    oferta: 'chegar na causa raiz do que está acontecendo no seu MRP ou na sua base',
  },
  8: {
    numero: 8, bloco: B2,
    titulo: 'O cliente tendo que programar e gravar vídeo para provar que era possível',
    cenario: 'Após reportar uma falha na consulta de diretórios em uma release recente do Protheus, a empresa recebeu como resposta, depois de escalonamentos internos, que aquilo não era possível. O próprio time interno do cliente escreveu o código e gravou um vídeo mostrando a solução, e só então o encaminhamento mudou.',
    dor: 'Pagar por apoio especializado e, no fim, ser o próprio cliente quem mostra como resolver.',
    angulo: 'Se a equipe interna sabe mais de ADVPL e da arquitetura do Protheus do que o parceiro contratado, a relação está invertida. A Oficina1 traz profundidade técnica de quem programa e conhece o Protheus por dentro há quase 20 anos.',
    palavraCta: 'ADVPL',
    sintoma: 'Sua equipe interna já resolveu sozinha o que o parceiro disse ser impossível?',
    oferta: 'avaliar o que você precisa construir no Protheus',
  },
  9: {
    numero: 9, bloco: B3,
    titulo: 'R$ 10 milhões em notas paradas por erro de arredondamento no XML da NFS-e',
    cenario: 'Falha na transmissão de NFS-e pelo TSS para um provedor municipal: o XML saía com valor de COFINS inconsistente com a alíquota por causa de cálculo e arredondamento (erro E160). Mesmo com ambiente atualizado, o problema persistiu e a empresa precisou envolver o jurídico.',
    dor: 'Cerca de R$ 10 milhões em notas paradas, comprometendo faturamento e gerando risco financeiro, fiscal, contratual e operacional.',
    angulo: 'Faturamento travado por detalhe de XML exige quem conhece TSS e motor fiscal a fundo e age rápido. Na Oficina1 nota parada é prioridade máxima, porque é o caixa da empresa que está parado.',
    palavraCta: 'NOTA',
    sintoma: 'Você tem nota parada por erro de transmissão neste momento?',
    oferta: 'colocar um especialista em TSS e motor fiscal olhando o seu caso',
  },
  10: {
    numero: 10, bloco: B3,
    titulo: '19 dias sem faturar e a necessidade de recorrer à Justiça',
    cenario: 'A empresa pediu com 40 dias de antecedência a adequação à nova NFS-e do seu município. Dois prazos foram descumpridos, o pacote de correção chegou atrasado e com falha, e a empresa ficou 19 dias sem conseguir emitir nota. Precisou recorrer a uma liminar judicial para ter solução.',
    dor: 'Fluxo de caixa comprometido e a necessidade de um advogado para conseguir emitir nota fiscal no próprio ERP.',
    angulo: 'Nenhuma empresa deveria precisar de liminar para faturar. Na Oficina1 faturamento parado é tratado como código vermelho, com antecipação das mudanças municipais antes do prazo.',
    palavraCta: 'FATURAR',
    sintoma: 'Sua prefeitura vai mudar o layout da NFS-e e ninguém te mostrou o plano?',
    oferta: 'checar se o seu ambiente está pronto antes do prazo',
  },
  11: {
    numero: 11, bloco: B3,
    titulo: 'O cliente fazendo o papel da consultoria na Secretaria da Fazenda',
    cenario: 'Com o novo layout de nota exigido pela Reforma Tributária em um município, empresas ficaram sem emitir notas porque o ambiente não foi atualizado a tempo. A própria empresa teve que ir à Secretaria da Fazenda buscar orientações e repassar para o time de desenvolvimento.',
    dor: 'Indignação por ter que fazer um trabalho que não cabia ao cliente, e a certeza de que sem essa iniciativa ainda estariam sem solução.',
    angulo: 'Com a Reforma Tributária, o parceiro de Protheus precisa antecipar as mudanças da SEFAZ e das prefeituras, não esperar o faturamento travar. A Oficina1 acompanha o calendário da transição para o cliente não ser pego de surpresa.',
    palavraCta: 'REFORMA',
    sintoma: 'Você sabe hoje se o seu Protheus está pronto para o próximo passo da Reforma Tributária?',
    oferta: 'avaliar a prontidão do seu ambiente para IBS e CBS',
  },
  12: {
    numero: 12, bloco: B3,
    titulo: 'TES ou Configurador de Tributos: a transição imposta e o medo do retrabalho',
    cenario: 'Empresas que usam o Protheus há décadas questionam a obrigação de abandonar a TES (Tipos de Entrada e Saída) para impostos legados e migrar tudo para o Configurador de Tributos, criado para IBS e CBS.',
    dor: 'Uma coisa é exigir isso de cliente novo, outra é forçar quem tem décadas de parametrização construída na TES.',
    angulo: 'A transição para IBS e CBS pode ser feita de forma planejada e mista, sem enlouquecer o fiscal e sem jogar fora décadas de trabalho. A Oficina1 desenha esse caminho com o time fiscal do cliente.',
    palavraCta: 'TES',
    sintoma: 'Seu fiscal tem medo de perder décadas de TES na migração?',
    oferta: 'desenhar a transição entre TES e Configurador de Tributos sem retrabalho',
  },
  13: {
    numero: 13, bloco: B3,
    titulo: 'Perder clientes reais porque o ERP não emite nota',
    cenario: 'Uma empresa ficou 8 dias sem emitir NFS-e e viu clientes buscarem fornecedores concorrentes. Outra, um distribuidor com e-commerce, ficou mais de 10 dias bloqueada depois de uma atualização de versão, acumulando reclamações no Procon e cancelamentos de pedidos, a ponto de registrar boletim de ocorrência.',
    dor: 'Clientes que dependem da empresa procurando alternativas, imagem arranhada e pedidos cancelados.',
    angulo: 'Quando o ERP para de faturar, a empresa não perde só tempo, perde cliente e reputação. Na Oficina1 blindar o faturamento, com homologação antes de atualizar e plano de contingência, é prioridade número um.',
    palavraCta: 'BLINDAR',
    sintoma: 'Sua última atualização de versão deixou o faturamento parado?',
    oferta: 'montar um plano de homologação e contingência antes da próxima',
  },
  14: {
    numero: 14, bloco: B4,
    titulo: 'SmartView: relatórios descontinuados e ferramenta que cai todo dia',
    cenario: 'Relatórios essenciais do Financeiro e do Comercial foram descontinuados para forçar o uso do SmartView, que apresenta lentidão e quedas diárias. Para mantê-lo funcionando, a equipe reinicia todos os dias os serviços REST e do SmartView, reexecuta o wizard de configuração e, nos casos críticos, recria o banco da ferramenta.',
    dor: 'Uma rotina diária de remendos só para ter acesso aos relatórios que a diretoria precisa.',
    angulo: 'A Oficina1 estabiliza os serviços REST e o SmartView e constrói as visões de dados que Financeiro e Comercial precisam, para a diretoria não ficar no escuro.',
    palavraCta: 'SMARTVIEW',
    sintoma: 'Alguém da sua equipe reinicia o SmartView todo dia?',
    oferta: 'entender o que está derrubando os seus serviços e recuperar os relatórios',
  },
  15: {
    numero: 15, bloco: B4,
    titulo: 'Instabilidade crônica na nuvem: quedas em produção e homologação que não compila',
    cenario: 'Ambiente Protheus em nuvem com mais de uma semana sem resposta em solicitações de alta prioridade. Em outro caso, 35 quedas graves em um ano, banco Oracle fora do ar por 5 a 6 horas em horário comercial e erros em DIRF e ECD. Na homologação, não era possível sequer compilar um fonte sem derrubar o ambiente.',
    dor: 'Lentidão crônica em produção, quedas constantes e uma base de testes que não serve para testar.',
    angulo: 'Estabilidade é arquitetura e gestão de ambiente: tuning de banco, separação real entre homologação e produção e monitoramento. É esse o trabalho de sustentação que a Oficina1 faz.',
    palavraCta: 'NUVEM',
    sintoma: 'Seu ambiente cai em horário comercial ou não deixa compilar em homologação?',
    oferta: 'olhar a arquitetura e a saúde do seu ambiente',
  },
  16: {
    numero: 16, bloco: B4,
    titulo: 'Atualização surpresa que para rotinas e depois vira orçamento de consultoria',
    cenario: 'Atualizações aplicadas no ambiente em nuvem sem aviso prévio fazem rotinas internas pararem de funcionar de uma hora para outra. O atendimento não resolve e, pouco depois, a recomendação é contratar consultoria para corrigir.',
    dor: 'Descobrir pela operação parada que houve uma atualização, e ainda ter que pagar para voltar a funcionar.',
    angulo: 'Nenhuma atualização deveria chegar em produção sem validação prévia e homologação controlada. Na Oficina1 o jogo é limpo: o cliente sabe o que vai mudar antes de mudar.',
    palavraCta: 'TESTE',
    sintoma: 'Alguma rotina sua parou do nada depois de uma atualização?',
    oferta: 'estruturar uma homologação antes de qualquer pacote chegar em produção',
  },
  17: {
    numero: 17, bloco: B4,
    titulo: 'SPED Fiscal que leva mais de 100 horas para gerar',
    cenario: 'A geração do SPED Fiscal de um mês fechado levava mais de 100 horas, enquanto uma empresa do mesmo ramo e porte gerava em cerca de 2 horas. Durante a geração, todos os outros departamentos ficavam lentos, gerando ociosidade e horas extras.',
    dor: 'A empresa inteira travada por dias e pagando horas extras para recuperar o tempo perdido.',
    angulo: 'Quando o SPED demora dias, a causa costuma estar em índices de banco, customizações e fontes mal otimizados. A Oficina1 investiga e otimiza o ambiente para a obrigação fiscal deixar de travar a operação. Não prometer números de redução que não estejam aqui.',
    palavraCta: 'SPED',
    sintoma: 'Seu SPED Fiscal leva mais de um dia para gerar?',
    oferta: 'investigar o que está deixando a geração lenta no seu ambiente',
  },
  18: {
    numero: 18, bloco: B4,
    titulo: 'O parto das atualizações noturnas: 5 filiais e 9 noites seguidas',
    cenario: 'Gestor de TI relata o desgaste de manter o Protheus atualizado para ECD, ECF e releases: depois de aplicar uma atualização, ainda precisa atualizar várias vezes em noites consecutivas, porque não dá para atualizar com o sistema em uso, e trabalha de madrugada para não parar 5 filiais.',
    dor: 'Cada atualização é um parto, exige quase uma especialização e custa as noites do gestor de TI.',
    angulo: 'A Oficina1 assume o planejamento e a execução das atualizações de release, pacotes fiscais e patches, para o time interno de TI voltar a cuidar do negócio e não da madrugada.',
    palavraCta: 'RELEASE',
    sintoma: 'Seu gestor de TI passa madrugadas atualizando o Protheus?',
    oferta: 'planejar as suas atualizações de release e pacotes fiscais',
  },
  19: {
    numero: 19, bloco: B5,
    titulo: 'Caos no PDV: TEF aprovado, sistema travado e cliente indo embora',
    cenario: 'Quando a SEFAZ ou o TSS oscilam, o PDV em contingência offline mostra mensagens técnicas que o operador de caixa não entende. Nas vendas com cartão (TEF), o pagamento é aprovado mas o sistema trava, formando filas em feriados e fazendo clientes desistirem da compra.',
    dor: 'Ver o cliente largar os produtos no caixa e ir embora porque o sistema não sabe o que fazer com um cartão já aprovado.',
    angulo: 'Operador de caixa não é analista de TI. A Oficina1 trabalha a contingência e o fluxo do TEF para a venda não parar e a tela falar a língua de quem está no caixa.',
    palavraCta: 'PDV',
    sintoma: 'Seu caixa trava quando o cartão é aprovado e a SEFAZ oscila?',
    oferta: 'revisar a contingência e o fluxo de TEF da sua loja',
  },
  20: {
    numero: 20, bloco: B5,
    titulo: 'Erro de sincronização entre Meu RH, ponto e folha gerando passivo trabalhista',
    cenario: 'Falhas de comunicação entre o app Meu RH, a Automação de Ponto (SIGAPON) e a Folha do Protheus fazem o sistema deixar de contabilizar marcações, tratar dias trabalhados como faltas e recalcular o saldo de forma errada, gerando banco de horas negativo que não condiz com a realidade.',
    dor: 'Atrito entre funcionários e RH e insegurança sobre a precisão dos dados trabalhistas.',
    angulo: 'Banco de horas errado por falha de integração é risco trabalhista, não só incômodo. A Oficina1 audita e corrige a integração entre ponto, Meu RH e folha.',
    palavraCta: 'PONTO',
    sintoma: 'Seus funcionários reclamam de banco de horas errado?',
    oferta: 'auditar a integração entre Meu RH, ponto e folha',
  },
  21: {
    numero: 21, bloco: B5,
    titulo: 'Atendimento automatizado que responde errado enquanto o faturamento está parado',
    cenario: 'Um grupo com 7 CNPJs, com faturamento travado havia 15 dias, reportou erro na inscrição municipal do tomador no XML. A resposta automática, gerada por IA, mandou corrigir a inscrição municipal do prestador, que não era o problema. O chat era lento e acabava redirecionando para e-mail, também com respostas automáticas.',
    dor: 'Faturamento parado há duas semanas e um robô que não distingue tomador de prestador.',
    angulo: 'Marcos usa IA no dia a dia e defende IA como apoio, mas problema crítico precisa de gente sênior olhando. Na Oficina1 quem atende situação crítica é consultor experiente, não resposta automática.',
    palavraCta: 'HUMANO',
    sintoma: 'Seu problema crítico está sendo respondido por robô?',
    oferta: 'olhar o seu caso com quem entende de faturamento',
  },
  22: {
    numero: 22, bloco: B5,
    titulo: 'Empresa sem TI interno e um suporte que só fala em jargão',
    cenario: 'Gestores de negócio recebem respostas cheias de termos técnicos que não entendem, e pedidos que envolvem banco de dados são recusados. O relato é que, sem TI interno, o sistema fica inviável, e mesmo com TI interno o responsável passa o dia trabalhando para resolver pendências do ERP.',
    dor: 'Precisar montar um departamento de TI só para traduzir o que o suporte diz.',
    angulo: 'A Oficina1 funciona como braço direito tecnológico: fala a língua do negócio com o gestor e cuida da parte técnica, inclusive banco de dados.',
    palavraCta: 'PARCEIRO',
    sintoma: 'Você precisa de alguém só para traduzir o que o suporte responde?',
    oferta: 'entender o que a sua operação precisa do lado técnico',
  },
  23: {
    numero: 23, bloco: B6,
    titulo: 'Multa surpresa de mais de R$ 3 mil por excesso de uso de licença',
    cenario: 'A empresa mantinha apenas 1 licença por módulo para consultas históricas e recebeu uma multa de mais de R$ 3 mil por exceder o uso, sem nunca ter recebido orientação, já que os gerentes de conta mudavam com frequência.',
    dor: 'Ser multado por algo que ninguém nunca explicou.',
    angulo: 'Acesso simultâneo mal controlado pode virar multa. A Oficina1 ajuda a configurar o License Server com regras de acesso e a auditar o uso real das licenças antes que a conta chegue.',
    palavraCta: 'AUDITORIA',
    sintoma: 'Você sabe quantos acessos simultâneos usa de verdade no Protheus?',
    oferta: 'revisar o uso real das suas licenças antes da próxima conta',
  },
  24: {
    numero: 24, bloco: B6,
    titulo: 'Licenças ociosas que não podem ser reduzidas: aviso prévio de 6 meses',
    cenario: 'Depois de reduzir a equipe, uma instituição pediu a redução parcial de licenças ociosas e esbarrou na exigência de aviso prévio de 6 meses, chegando a enviar notificação extrajudicial. Outra empresa cancelou em março e em setembro ainda recebia boletos.',
    dor: 'Continuar pagando por licenças que ninguém usa, com uma regra de saída desproporcional.',
    angulo: 'Licenciamento e contrato precisam acompanhar o momento real da operação. A Oficina1 ajuda o cliente a dimensionar licenças pelo uso real e a planejar ajustes com antecedência. Não fazer promessas sobre condições contratuais da Oficina1 que não estejam aqui.',
    palavraCta: 'AJUSTE',
    sintoma: 'Você está pagando por licença que ninguém usa?',
    oferta: 'dimensionar as suas licenças pelo uso real',
  },
}

/** Ordem de publicação: intercala os 6 blocos (1 pauta por semana). */
export const ORDEM_SERIE: number[] = [
  1, 9, 5, 14, 23, 19,
  2, 10, 6, 15, 24, 20,
  3, 11, 7, 16, 12, 21,
  4, 13, 8, 17, 22, 18,
]

export function ehTemaComercial(nomeTema: string | null | undefined): boolean {
  return (nomeTema ?? '').toLowerCase().includes('comercial')
}

/**
 * Retorna a pauta da série para um slot, ou null se o slot não faz parte dela.
 * Só segundas-feiras (horário de Brasília) entre INICIO_SERIE e a 24ª semana.
 */
export function pautaParaData(dataSlot: Date | string): PautaDaSemana | null {
  const d = typeof dataSlot === 'string' ? new Date(dataSlot) : dataSlot
  if (isNaN(d.getTime())) return null
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000) // UTC-3
  if (brt.getUTCDay() !== 1) return null
  const ymd = brt.toISOString().slice(0, 10)
  const diffDias = Math.round(
    (Date.parse(`${ymd}T00:00:00Z`) - Date.parse(`${INICIO_SERIE}T00:00:00Z`)) / 86400000
  )
  if (diffDias < 0 || diffDias % 7 !== 0) return null
  if (SEGUNDAS_PULADAS.includes(ymd)) return null
  const puladasAntes = SEGUNDAS_PULADAS.filter(f => f >= INICIO_SERIE && f < ymd).length
  const idx = diffDias / 7 - puladasAntes
  if (idx >= ORDEM_SERIE.length) return null
  return { semana: idx + 1, total: ORDEM_SERIE.length, pauta: PAUTAS[ORDEM_SERIE[idx]] }
}

/** Atalho: pauta para um tema + data (null se o tema não for Comercial). */
export function pautaDoSlot(nomeTema: string | null | undefined, dataSlot: Date | string | null | undefined): PautaDaSemana | null {
  if (!dataSlot || !ehTemaComercial(nomeTema)) return null
  return pautaParaData(dataSlot)
}

/** Registro que vai em fontes_pesquisa, para aparecer na Fila de aprovação. */
export function fontesDaPauta(p: PautaDaSemana) {
  return [{
    titulo: `Série Dores reais do Protheus, semana ${p.semana}/${p.total}: ${p.pauta.titulo}`,
    url: '',
    resumo: p.pauta.cenario,
  }]
}

/** Bloco de instrução injetado no prompt do gerador de texto. */
export function blocoPromptPauta(p: PautaDaSemana): string {
  const { pauta } = p
  return `PAUTA OBRIGATÓRIA DESTE POST (série semanal "Dores reais do Protheus", semana ${p.semana} de ${p.total}):
Tema central: ${pauta.titulo}
Cenário observado no mercado: ${pauta.cenario}
A dor de quem viveu (parafrasear, nunca citar entre aspas como depoimento): ${pauta.dor}
Posicionamento da Oficina1: ${pauta.angulo}

CTA DESTE POST (o objetivo é gerar lead, siga à risca):
Pergunta de autodiagnóstico: ${pauta.sintoma}
Palavra: ${pauta.palavraCta}
Oferta: ${pauta.oferta}

REGRAS DA SÉRIE (prevalecem sobre qualquer outra instrução de diversificação de assunto):
- O post inteiro gira em torno desta dor. Não troque de assunto. Diversifique gancho, estrutura e metáforas, não o tema.
- Trate como situação que circula no mercado e que Marcos encontra quando a Oficina1 é chamada (ex: "relatos que tenho acompanhado", "cenário que encontro com mais frequência do que deveria").
- NUNCA mencione Reclame Aqui, nomes de empresas, cidades, estados ou números de reclamação.
- NUNCA acuse a TOTVS, franquias ou consultorias pelo nome. O Protheus não é o vilão: o problema é a condução, a governança ou o modelo de atendimento.
- NUNCA invente cases da Oficina1, nomes de clientes, prazos ou resultados numéricos que não estejam nesta pauta.
- Valores e prazos do cenário (ex: R$ 10 milhões, 19 dias, 100 horas) podem ser usados como exemplo do que acontece no mercado, sem atribuir a ninguém.
- Fale com o decisor (CFO, diretor, gestor de TI): traduza a dor técnica em impacto no caixa, no risco e na operação.`
}
