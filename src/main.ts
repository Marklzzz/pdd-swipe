import './style.css';
import { parseQuestionBank } from './core/data';

// Stage 2 placeholder: proves the build, the data pipeline and Pages hosting work.

const DATA_URL = `${import.meta.env.BASE_URL}data/`;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

async function main(): Promise<void> {
  const app = document.getElementById('app')!;
  app.append(el('h1', {}, 'ПДД свайпом'));
  const status = el('p', { className: 'muted' }, 'Загрузка вопросов…');
  app.append(status);

  try {
    const res = await fetch(`${DATA_URL}questions.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bank = parseQuestionBank(await res.json());
    status.textContent = `${bank.questions.length} вопросов · датасет ${bank.source.slice(0, 7)}`;

    const withImage = bank.questions.filter((q) => q.img);
    const q = withImage[Math.floor(Math.random() * withImage.length)];
    if (q) {
      const [ticket, num] = q.refs[0]!;
      app.append(
        el(
          'div',
          { className: 'card' },
          el('img', { src: `${DATA_URL}${q.img}`, alt: '' }),
          el('p', {}, q.text),
          el('p', { className: 'muted' }, `Билет ${ticket}, вопрос ${num}`),
        ),
      );
    }
  } catch (e) {
    status.textContent = `Не удалось загрузить вопросы: ${(e as Error).message}`;
  }
}

void main();
