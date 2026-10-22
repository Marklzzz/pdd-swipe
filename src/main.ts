import './style.css';
import { ticketOrder } from './core/attempt';
import { parseQuestionBank } from './core/data';
import { loadCursor, logAttempt, saveCursor } from './storage';
import { el } from './ui/dom';
import { Sequential } from './ui/sequential';

const DATA_URL = `${import.meta.env.BASE_URL}data/`;

function report(what: string) {
  return (e: unknown) => console.error(`${what} failed`, e);
}

async function main(): Promise<void> {
  const app = document.getElementById('app')!;
  app.replaceChildren(el('p', { className: 'muted center' }, 'Загрузка вопросов…'));

  try {
    const res = await fetch(`${DATA_URL}questions.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const questions = ticketOrder(parseQuestionBank(await res.json()).questions);
    const cursor = await loadCursor().catch(() => undefined);
    const index =
      cursor === null ? questions.length : Math.max(0, questions.findIndex((q) => q.id === cursor));

    new Sequential(app, questions, index, {
      imgBase: DATA_URL,
      log: (a) => void logAttempt(a).catch(report('logAttempt')),
      saveCursor: (qid) => void saveCursor(qid).catch(report('saveCursor')),
    });
  } catch (e) {
    app.replaceChildren(
      el('p', { className: 'muted center' }, `Не удалось загрузить вопросы: ${(e as Error).message}`),
    );
  }
}

void main();
