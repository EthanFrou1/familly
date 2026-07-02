export function buildQuestionCountPresets(minRequired) {
  return [
    { label: 'Court', value: 8, emoji: '🌱', minRequired },
    { label: 'Moyen', value: 12, emoji: '🌳', minRequired },
    { label: 'Long', value: 16, emoji: '🔥', minRequired },
  ]
}
