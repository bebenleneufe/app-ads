import { formatEuros, formatFullDate, formatProductQuantity } from './format.js';

export function buildShoppingListText(shoppingList, settings, weekStartDate) {
  const headerLines = [
    `Courses Lidl, semaine du ${formatFullDate(weekStartDate)} (${settings.personCount} pers.)`,
    '',
  ];
  const aisleLines = shoppingList.aisleGroups.flatMap((group) => [
    group.aisle.toUpperCase(),
    ...group.lines.map((line) => `- ${line.packageCount} × ${line.product.name} (${line.product.packageLabel}) : ${formatEuros(line.cost)}`),
    '',
  ]);
  const pantryLines = shoppingList.pantryLines.length === 0
    ? []
    : [
      'À VÉRIFIER AU PLACARD',
      ...shoppingList.pantryLines.map((line) => `- ${formatProductQuantity(line.product, line.neededQuantity)}`),
      '',
    ];
  return [
    ...headerLines,
    ...aisleLines,
    ...pantryLines,
    `Total estimé : ${formatEuros(shoppingList.totalToPay)}`,
  ].join('\n');
}
