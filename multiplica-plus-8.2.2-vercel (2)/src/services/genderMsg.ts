// src/services/genderMsg.ts

export const isFemaleName = (name: string): boolean => {
  if (!name) return false;
  
  // Clean name: take the first word, lowercase it, remove accents
  const firstWord = name.trim().split(/\s+/)[0].toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Specific female name list (without accents)
  const femaleList = new Set([
    'beatriz', 'beatris', 'raquel', 'ruth', 'rute', 'ester', 'esther', 'miriam', 'myriam', 
    'abigail', 'noemi', 'solange', 'cleide', 'irene', 'rose', 'gisele', 'giselle', 'kelly', 
    'shirley', 'joyce', 'carmen', 'sueli', 'suely', 'elisangela', 'elizabeth', 'elisabete',
    'simone', 'ivone', 'marlene', 'dulce', 'nair', 'lourdes', 'neide', 'dirce', 'alice', 
    'clarice', 'eunice', 'denise', 'marise', 'rosemeire', 'rosangela', 'rosangella', 'luiza',
    'marcia', 'lucia', 'tereza', 'theresa'
  ]);

  if (femaleList.has(firstWord)) return true;

  // Suffix checks
  // Ends in 'a', but not 'as'
  if (firstWord.endsWith('a') && !firstWord.endsWith('as')) {
    const maleExceptions = ['luca', 'joshua', 'andrea', 'gianluca', 'jean', 'buda', 'dalai'];
    if (maleExceptions.includes(firstWord)) return false;
    return true;
  }

  // Suffixes typical of female names
  const femaleSuffixes = ['ice', 'ete', 'ine', 'ane', 'ele', 'elly', 'ely', 'rose', 'one', 'ire', 'ith', 'uth', 'rle', 'ilde', 'ite'];
  for (const suffix of femaleSuffixes) {
    if (firstWord.endsWith(suffix)) {
      const maleSuffixExceptions = ['andre', 'felipe', 'jorge', 'alexandre', 'guilherme', 'henrique', 'vicente', 'dante', 'valente', 'bento'];
      if (maleSuffixExceptions.some(ex => firstWord.includes(ex))) return false;
      return true;
    }
  }

  return false;
};

export const getDynamicHumanMessage = (senderName: string, recipientName: string, recipientId: string): string => {
  const senderIsFemale = isFemaleName(senderName);
  const recipientIsFemale = isFemaleName(recipientName);

  let templates: string[] = [];

  if (!senderIsFemale && !recipientIsFemale) {
    // Man to Man
    templates = [
      `Olá, meu querido! Senti sua falta no culto. Está tudo bem com você? Qualquer coisa estou por aqui! 🙏`,
      `A paz do Senhor, meu querido! Senti sua falta nestes últimos dias. Como você está? Tudo bem por aí? Abraço!`,
      `E aí, meu querido? Senti sua falta nos cultos. Espero que esteja tudo bem! Se precisar de algo ou de oração, me avisa.`,
      `Fala, meu querido, tudo bem? Senti sua falta na igreja esta semana. Deus te abençoe! Abraço! 🙏✨`
    ];
  } else if (!senderIsFemale && recipientIsFemale) {
    // Man to Woman (explicit user request: "minha irmã senti sua falta nestes ultimos dias esta tudo bem??")
    templates = [
      `Olá, minha irmã! Senti sua falta nestes últimos dias. Está tudo bem?? Qualquer coisa conta com minhas orações! 🙏`,
      `A paz do Senhor! Olá, minha irmã! Senti sua falta nestes últimos dias. Está tudo bem?? Espero que sim! Que Deus te abençoe ricamente.`,
      `Oi, minha irmã! Senti sua falta nestes últimos dias. Está tudo bem?? Desejo a você uma semana abençoada!`,
      `Minha irmã, senti sua falta nestes últimos dias. Está tudo bem?? Qualquer necessidade estou à disposição para ajudar. 🙏✨`
    ];
  } else if (senderIsFemale && recipientIsFemale) {
    // Woman to Woman
    templates = [
      `Olá, minha irmã! Senti sua falta no culto. Está tudo bem com você? Um beijo grande! Deus te abençoe! 💕`,
      `Oi, minha querida! Senti sua falta nestes últimos dias. Está tudo bem por aí? Espero que sim! Beijos.`,
      `A paz do Senhor, minha irmã! Senti sua falta na igreja. Se precisar de conversar ou de oração, estou por aqui! 🙏`,
      `Minha querida, tudo bem? Senti sua falta nos cultos. Que Deus te abençoe e guarde a sua vida! ✨`
    ];
  } else {
    // Woman to Man
    templates = [
      `Olá, meu irmão! Senti sua falta no culto recente. Está tudo bem com você? Que Deus te abençoe! 🙏`,
      `A paz do Senhor, meu irmão! Senti sua falta nos últimos dias. Como estão as coisas por aí? Um abraço!`,
      `Como vai, meu irmão? Senti sua falta nos cultos esta semana. Se precisar de oração, estou à disposição!`,
      `Oi, meu irmão! Senti sua falta na igreja. Tudo em paz com você? Que o Senhor te abençoe grandemente! ✨`
    ];
  }

  // Stable pseudo-random selection based on senderName and recipientId
  const seed = senderName + recipientId;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % templates.length;
  return templates[index];
};

export const getBirthdayWhatsAppMessage = (_senderName: string, recipientName: string): string => {
  const recipientIsFemale = isFemaleName(recipientName);
  const firstName = recipientName.trim().split(/\s+/)[0];
  if (recipientIsFemale) {
    return `Olá, minha querida irmã ${firstName}! Parabéns pelo seu aniversário! 🎂🎉 Que o Senhor Deus te abençoe grandemente, encha seu coração de alegria e garanta a vitória na sua vida. O Reino de Deus se alegra com a sua vida! Felicidades! 🎂🎉🙏`;
  } else {
    return `Olá, meu querido irmão ${firstName}! Parabéns pelo seu aniversário! 🎂🎉 Que o Senhor Deus te abençoe grandemente, guie os seus passos e garanta a vitória na sua vida. O Reino de Deus se alegra com a sua vida! Felicidades! 🎂🎉🙏`;
  }
};

export const getNeutralWhatsAppMessage = (recipientName: string): string => {
  const firstName = recipientName.trim().split(/\s+/)[0];
  return `A paz do Senhor, ${firstName}! Como você está? Tudo bem com você?`;
};

