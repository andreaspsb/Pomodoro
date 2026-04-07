// Sugestões de pausa baseadas na conversa com o Gemini (5 categorias)

export const CATEGORIES = {
  physical: {
    icon: '💪',
    label: 'Físico',
    suggestions: [
      'Alongamento de punhos e antebraços — estenda o braço e puxe os dedos para trás por 30s em cada mão.',
      'Regra 20-20-20: olhe para algo a 6 metros de distância por 20 segundos para relaxar os olhos.',
      'Vá buscar um copo de água — sinta o movimento das pernas, torne o ato um ritual consciente.',
      'Libere a tensão cervical: gire o pescoço lentamente, sentindo onde há tensão acumulada.',
      'Relaxe os ombros: inspire fundo, suba-os até as orelhas e solte de uma vez.',
      'Espreguice-se com os braços acima da cabeça — estique todo o tronco.',
    ],
  },
  creative: {
    icon: '🎨',
    label: 'Criativo',
    suggestions: [
      'Análise musical: escolha uma progressão de acordes que você estuda e visualize-a mentalmente.',
      'Esboço gestual de 2 minutos — capture o movimento de um objeto, sem foco no acabamento.',
      'Escuta ativa: ouça uma música e tente isolar apenas um instrumento (o baixo, os sintetizadores).',
      'Descrição de cores: observe ao redor e nomeie as 3 cores predominantes com precisão técnica.',
      'Imagine uma cena diferente e descreva-a mentalmente em detalhes de luz e sombra.',
    ],
  },
  reflection: {
    icon: '🧘',
    label: 'Reflexão',
    suggestions: [
      'Check-in de sentimentos: "Neste momento, sinto tensão, calma, cansaço ou curiosidade?"',
      'Pequeno relatório interno: "No último bloco me senti ___ porque ___." — como um log.',
      'Gratidão estruturada: identifique 3 coisas muito específicas que aconteceram bem hoje.',
      'Grounding 5 sentidos: 5 coisas que vê, 4 que toca, 3 que ouve, 2 que cheira, 1 que saboreia.',
      'Respire em caixinha: 4s inspirando, 4s segurando, 4s soltando, 4s segurando. Repita 3x.',
      'Opine em ambiente seguro: "Sobre ___, eu acho que... porque..." — treino de expressão interna.',
    ],
  },
  organize: {
    icon: '🗂️',
    label: 'Organização',
    suggestions: [
      'Feche todas as abas e janelas que não são necessárias para a próxima tarefa.',
      'Limpe o teclado e o mouse — remova a sensação de "tecla engordurada" que acumula desconforto.',
      'O ritual da Primeira Linha: decida qual é a primeiríssima ação do próximo bloco de 25 minutos.',
      'Organize suas anotações: vire a página, separe o que foi feito do que ainda falta.',
      'Verifique iluminação e temperatura — um ajuste na cortina pode mudar muito o cansaço ocular.',
      'Esvazie a memória de trabalho: escreva um TODO rápido para liberar o que está na cabeça.',
    ],
  },
  visual: {
    icon: '👀',
    label: 'Visual/Conhecimento',
    suggestions: [
      'Observe uma imagem de referência: identifique onde está a luz principal e como a sombra se comporta.',
      'Reconstrua mentalmente um ramo genealógico (deuses gregos, heróis da DC) — visualize nós e arestas.',
      'Desenhe no papel um diagrama de blocos do que está codificando — apenas quadrados e setas.',
      'Analise a paleta de cores do ambiente: identifique as 3 cores com nomes técnicos (saturação, brilho).',
      'Revise 2 ou 3 flashcards mentais de teoria musical ou de conceitos que está estudando.',
    ],
  },
};

const _lastIdx = {};

export function getSuggestion(activeCategories = Object.keys(CATEGORIES)) {
  const available = activeCategories.filter(k => CATEGORIES[k]);
  if (!available.length) return null;

  const key = available[Math.floor(Math.random() * available.length)];
  const list = CATEGORIES[key].suggestions;

  _lastIdx[key] = (_lastIdx[key] === undefined ? -1 : _lastIdx[key]);
  _lastIdx[key] = (_lastIdx[key] + 1) % list.length;

  return {
    icon:     CATEGORIES[key].icon,
    label:    CATEGORIES[key].label,
    text:     list[_lastIdx[key]],
    category: key,
  };
}
