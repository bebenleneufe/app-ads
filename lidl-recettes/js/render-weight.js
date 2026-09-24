import { createElement, replaceChildrenWithFragment } from './dom.js';
import { formatDecimal } from './format.js';
import { TREND_STATUSES } from './weight-log.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const CHART_SIZE = Object.freeze({ width: 280, height: 96, left: 30, right: 10, top: 10, bottom: 18 });
const MAX_POINTS_ON_CHART = 16;
const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

function createSvgElement(tagName, attributes = {}, children = []) {
  const element = document.createElementNS(SVG_NAMESPACE, tagName);
  for (const [attributeName, attributeValue] of Object.entries(attributes)) {
    element.setAttribute(attributeName, String(attributeValue));
  }
  element.append(...children);
  return element;
}

function parseIsoDate(isoDate) {
  return new Date(Number(isoDate.slice(0, 4)), Number(isoDate.slice(5, 7)) - 1, Number(isoDate.slice(8, 10)));
}

function formatKg(kg) {
  return `${formatDecimal(kg)} kg`;
}

function formatSignedKg(kg) {
  const sign = kg > 0 ? '+' : kg < 0 ? '−' : '';
  return `${sign}${formatDecimal(Math.abs(kg))} kg`;
}

// Une seule série : ligne fine couleur d'accent, grille discrète, dernier point mis en avant.
// Chaque point a une zone de survol plus large que lui, avec la date et le poids.
function buildWeightChart(entries) {
  const shownEntries = entries.slice(-MAX_POINTS_ON_CHART);
  const weights = shownEntries.map((entry) => entry.kg);
  const lowestKg = Math.floor(Math.min(...weights) - 0.5);
  const highestKg = Math.ceil(Math.max(...weights) + 0.5);
  const plotWidth = CHART_SIZE.width - CHART_SIZE.left - CHART_SIZE.right;
  const plotHeight = CHART_SIZE.height - CHART_SIZE.top - CHART_SIZE.bottom;
  const firstTime = parseIsoDate(shownEntries[0].date).getTime();
  const timeSpan = Math.max(1, parseIsoDate(shownEntries.at(-1).date).getTime() - firstTime);
  const toX = (entry) => CHART_SIZE.left + ((parseIsoDate(entry.date).getTime() - firstTime) / timeSpan) * plotWidth;
  const toY = (kg) => CHART_SIZE.top + ((highestKg - kg) / (highestKg - lowestKg)) * plotHeight;

  const gridLines = [highestKg, (highestKg + lowestKg) / 2, lowestKg].flatMap((kg) => [
    createSvgElement('line', {
      class: 'chart-grid', x1: CHART_SIZE.left, x2: CHART_SIZE.width - CHART_SIZE.right, y1: toY(kg), y2: toY(kg),
    }),
    createSvgElement('text', { class: 'chart-label', x: CHART_SIZE.left - 6, y: toY(kg) + 3, 'text-anchor': 'end' }, [formatDecimal(kg)]),
  ]);
  const dateLabels = [shownEntries[0], shownEntries.at(-1)].map((entry, index) => createSvgElement('text', {
    class: 'chart-label',
    x: toX(entry),
    y: CHART_SIZE.height - 4,
    'text-anchor': index === 0 ? 'start' : 'end',
  }, [SHORT_DATE_FORMATTER.format(parseIsoDate(entry.date))]));
  const linePath = shownEntries.map((entry, index) => `${index === 0 ? 'M' : 'L'}${toX(entry).toFixed(1)},${toY(entry.kg).toFixed(1)}`).join(' ');
  const points = shownEntries.map((entry, index) => {
    const isLatest = index === shownEntries.length - 1;
    const tooltip = createSvgElement('title', {}, [`${SHORT_DATE_FORMATTER.format(parseIsoDate(entry.date))} : ${formatKg(entry.kg)}`]);
    return createSvgElement('g', { class: 'chart-point' }, [
      createSvgElement('circle', { class: 'chart-hit', cx: toX(entry), cy: toY(entry.kg), r: 10 }),
      createSvgElement('circle', { class: isLatest ? 'chart-dot is-latest' : 'chart-dot', cx: toX(entry), cy: toY(entry.kg), r: isLatest ? 4.5 : 3 }),
      tooltip,
    ]);
  });

  return createSvgElement('svg', {
    class: 'weight-chart',
    viewBox: `0 0 ${CHART_SIZE.width} ${CHART_SIZE.height}`,
    role: 'img',
    'aria-label': `Évolution du poids : de ${formatKg(shownEntries[0].kg)} à ${formatKg(shownEntries.at(-1).kg)}`,
  }, [
    ...gridLines,
    ...dateLabels,
    createSvgElement('path', { class: 'chart-line', d: linePath }),
    ...points,
  ]);
}

function buildHistoryTable(entries) {
  const rows = [...entries].reverse().map((entry) => createElement('tr', {}, [
    createElement('td', { text: SHORT_DATE_FORMATTER.format(parseIsoDate(entry.date)) }),
    createElement('td', { text: formatKg(entry.kg) }),
  ]));
  return createElement('details', { className: 'weight-history' }, [
    createElement('summary', { text: `Toutes les pesées (${entries.length})` }),
    createElement('table', {}, [
      createElement('thead', {}, [createElement('tr', {}, [
        createElement('th', { text: 'Date', attributes: { scope: 'col' } }),
        createElement('th', { text: 'Poids', attributes: { scope: 'col' } }),
      ])]),
      createElement('tbody', {}, rows),
    ]),
  ]);
}

function describeTrend(analysis) {
  const { status, weeklyChangeKg } = analysis;
  if (status === TREND_STATUSES.NOT_ENOUGH_DATA) {
    return 'Note ton poids une fois par semaine, le matin à jeun. La tendance apparaît après une semaine de pesées.';
  }
  const weeklyText = `${formatSignedKg(weeklyChangeKg)} par semaine`;
  if (status === TREND_STATUSES.TOO_FAST) {
    return `${weeklyText} : c’est rapide. Mange bien tes trois repas : au-delà d’1 kg par semaine, on perd aussi du muscle.`;
  }
  if (status === TREND_STATUSES.STALLED) {
    return 'Ton poids ne bouge plus depuis trois semaines. C’est courant : surveille l’huile et le fromage ajoutés, marche 20 minutes par jour, et tiens deux semaines avant de réduire les calories.';
  }
  if (status === TREND_STATUSES.GAINING) {
    return `${weeklyText}. Vérifie ce qui sort des menus : boissons sucrées, grignotage, portions resservies.`;
  }
  return `${weeklyText} : c’est le bon rythme, continue.`;
}

export function renderWeightTracker({ chartContainer, adviceElement, weightLog, analysis }) {
  const chartChildren = weightLog.length >= 2 ? [buildWeightChart(weightLog), buildHistoryTable(weightLog)] : [];
  replaceChildrenWithFragment(chartContainer, chartChildren);
  const totalText = analysis.totalChangeKg === null ? '' : ` Depuis le début : ${formatSignedKg(analysis.totalChangeKg)}.`;
  const latestText = analysis.latestEntry ? `Dernière pesée : ${formatKg(analysis.latestEntry.kg)}. ` : '';
  adviceElement.textContent = `${latestText}${describeTrend(analysis)}${totalText}`;
}
