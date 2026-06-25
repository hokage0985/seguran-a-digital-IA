'use strict';

const CHAR_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
};

const AMBIGUOUS_CHARACTERS = new Set(['0', 'O', '1', 'l', 'I']);

const elements = {
  form: document.querySelector('#password-form'),
  output: document.querySelector('#password-output'),
  copyButton: document.querySelector('#copy-button'),
  copyFeedback: document.querySelector('#copy-feedback'),
  range: document.querySelector('#length-range'),
  number: document.querySelector('#length-number'),
  uppercase: document.querySelector('#uppercase'),
  lowercase: document.querySelector('#lowercase'),
  numbers: document.querySelector('#numbers'),
  symbols: document.querySelector('#symbols'),
  avoidAmbiguous: document.querySelector('#avoid-ambiguous'),
  error: document.querySelector('#form-error'),
  strengthText: document.querySelector('#strength-text'),
  strengthDescription: document.querySelector('#strength-description'),
  strengthBar: document.querySelector('#strength-bar'),
  strengthTrack: document.querySelector('#strength-track'),
  entropyValue: document.querySelector('#entropy-value')
};

const MIN_LENGTH = 4;
const MAX_LENGTH = 64;

/**
 * Retorna um inteiro aleatório seguro no intervalo [0, max).
 * Rejection sampling evita viés de módulo.
 */
function secureRandomInt(max) {
  if (!Number.isInteger(max) || max <= 0) {
    throw new RangeError('O valor máximo deve ser um inteiro positivo.');
  }

  const maxUint32 = 0x100000000;
  const limit = maxUint32 - (maxUint32 % max);
  const randomBuffer = new Uint32Array(1);

  do {
    crypto.getRandomValues(randomBuffer);
  } while (randomBuffer[0] >= limit);

  return randomBuffer[0] % max;
}

function randomCharacter(characters) {
  return characters[secureRandomInt(characters.length)];
}

function secureShuffle(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = secureRandomInt(index + 1);
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index]
    ];
  }

  return shuffled;
}

function removeAmbiguousCharacters(characters) {
  return [...characters]
    .filter((character) => !AMBIGUOUS_CHARACTERS.has(character))
    .join('');
}

function getSelectedCharacterSets() {
  const selected = [];

  if (elements.uppercase.checked) selected.push(CHAR_SETS.uppercase);
  if (elements.lowercase.checked) selected.push(CHAR_SETS.lowercase);
  if (elements.numbers.checked) selected.push(CHAR_SETS.numbers);
  if (elements.symbols.checked) selected.push(CHAR_SETS.symbols);

  if (elements.avoidAmbiguous.checked) {
    return selected.map(removeAmbiguousCharacters);
  }

  return selected;
}

function clampLength(value) {
  const parsedValue = Number.parseInt(value, 10);

  if (Number.isNaN(parsedValue)) return 16;
  return Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, parsedValue));
}

function updateRangeProgress() {
  const current = clampLength(elements.range.value);
  const progress =
    ((current - MIN_LENGTH) / (MAX_LENGTH - MIN_LENGTH)) * 100;

  elements.range.style.setProperty('--range-progress', `${progress}%`);
}

function synchronizeLength(source) {
  const value = clampLength(source.value);

  elements.range.value = value;
  elements.number.value = value;
  updateRangeProgress();
}

function calculateEntropy(length, poolSize) {
  if (length <= 0 || poolSize <= 1) return 0;
  return length * Math.log2(poolSize);
}

function getStrength(entropy) {
  if (entropy < 36) {
    return {
      name: 'Muito fraca',
      description: 'Adequada apenas para testes. Aumente o tamanho ou combine mais tipos.',
      color: '#b44d47',
      score: 20
    };
  }

  if (entropy < 60) {
    return {
      name: 'Razoável',
      description: 'Já oferece alguma proteção, mas ainda pode ser fortalecida.',
      color: '#c48736',
      score: 45
    };
  }

  if (entropy < 80) {
    return {
      name: 'Forte',
      description: 'Boa escolha para a maioria das contas pessoais.',
      color: '#6d985f',
      score: 70
    };
  }

  if (entropy < 120) {
    return {
      name: 'Muito forte',
      description: 'Excelente resistência estimada contra tentativas automatizadas.',
      color: '#52745f',
      score: 88
    };
  }

  return {
    name: 'Patinha suprema',
    description: 'Nível altíssimo de entropia. A Lola aprovou com entusiasmo.',
    color: '#315c4a',
    score: 100
  };
}

function updateStrength(entropy) {
  const strength = getStrength(entropy);
  const roundedEntropy = Math.round(entropy);

  elements.strengthText.textContent = strength.name;
  elements.strengthDescription.textContent = strength.description;
  elements.entropyValue.textContent = `${roundedEntropy} bits`;
  elements.strengthBar.style.width = `${strength.score}%`;
  elements.strengthBar.style.background = strength.color;
  elements.strengthTrack.setAttribute('aria-valuenow', strength.score);
  elements.strengthTrack.setAttribute(
    'aria-valuetext',
    `${strength.name}, ${roundedEntropy} bits de entropia`
  );
}

function generatePassword() {
  const length = clampLength(elements.number.value);
  const selectedSets = getSelectedCharacterSets();

  elements.error.textContent = '';

  if (selectedSets.length === 0) {
    elements.error.textContent =
      'Selecione pelo menos um tipo de caractere para a Lola trabalhar.';
    return;
  }

  if (length < selectedSets.length) {
    elements.error.textContent =
      'O tamanho da senha precisa ser igual ou maior que o número de opções marcadas.';
    return;
  }

  const completePool = selectedSets.join('');
  const passwordCharacters = [];

  // Garante que cada grupo escolhido apareça pelo menos uma vez.
  for (const characterSet of selectedSets) {
    passwordCharacters.push(randomCharacter(characterSet));
  }

  while (passwordCharacters.length < length) {
    passwordCharacters.push(randomCharacter(completePool));
  }

  const password = secureShuffle(passwordCharacters).join('');
  const entropy = calculateEntropy(length, completePool.length);

  elements.output.value = password;
  elements.copyFeedback.textContent = '';
  updateStrength(entropy);
}

async function copyPassword() {
  const password = elements.output.value;

  if (!password) {
    elements.copyFeedback.textContent = 'Gere uma senha antes de copiar.';
    return;
  }

  try {
    await navigator.clipboard.writeText(password);
    elements.copyFeedback.textContent = 'Senha copiada! A Lola guardou o segredo.';
  } catch {
    elements.output.select();
    document.execCommand('copy');
    elements.output.setSelectionRange(0, 0);
    elements.copyFeedback.textContent = 'Senha copiada!';
  }
}

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  generatePassword();
});

elements.copyButton.addEventListener('click', copyPassword);

elements.range.addEventListener('input', () => {
  synchronizeLength(elements.range);
});

elements.number.addEventListener('input', () => {
  synchronizeLength(elements.number);
});

elements.number.addEventListener('blur', () => {
  synchronizeLength(elements.number);
});

[
  elements.uppercase,
  elements.lowercase,
  elements.numbers,
  elements.symbols,
  elements.avoidAmbiguous
].forEach((control) => {
  control.addEventListener('change', () => {
    if (elements.output.value) generatePassword();
  });
});

updateRangeProgress();
generatePassword();
