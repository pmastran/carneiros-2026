import { createHash } from 'node:crypto';

const startedAt = new Date().toISOString();
const observed = new Map();
const events = [];
let lastFreshAt = null;
let previousSnapshot = null;
const MAX_EVENTS = 100;

function fingerprint(value) {
  return createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}
function appendEvent(event) {
  events.unshift(Object.freeze({ ...event, recordedAt: new Date().toISOString() }));
  events.splice(MAX_EVENTS);
}
function isTrustedItem(item) {
  return !!item &&
    item.sourceType === 'automatic-lupa' &&
    item.checker === 'Agência Lupa' &&
    item.sourceUrl?.startsWith('https://www.agencialupa.org/') &&
    typeof item.sourceQuote === 'string' && item.sourceQuote.length >= 12 &&
    item.sourceVerdict &&
    ['verdadeiro', 'falso', 'exagerado', 'subestimado', 'falta-contexto'].includes(item.verdict);
}
export function collectAudit(live, curatedClaims = []) {
  if (live?.status === 'fresh' && Array.isArray(live.claims)) {
    const catalog = new Map(curatedClaims.map(item => [item.id, item]));
    for (const item of live.claims) {
      if (!isTrustedItem(item)) continue;
      const prior = observed.get(item.id);
      const noteHash = fingerprint(item.explanation);
      if (!prior) {
        const saved = catalog.get(item.id);
        if (saved && saved.verdict !== item.verdict) {
          appendEvent({
            type: 'catalogo-revisado', id: item.id, candidate: item.candidate,
            previous: saved.verdict, current: item.verdict,
            message: 'A classificação do catálogo pré-carregado divergia da publicação; a fonte passou a prevalecer.',
            sourceUrl: item.sourceUrl
          });
        } else {
          appendEvent({
            type: 'primeira-captura', id: item.id, candidate: item.candidate,
            current: item.verdict,
            message: 'Declaração identificada na publicação pela primeira vez nesta sessão do servidor.',
            sourceUrl: item.sourceUrl
          });
        }
      } else if (prior.verdict !== item.verdict) {
        appendEvent({
          type: 'veredito-alterado', id: item.id, candidate: item.candidate,
          previous: prior.verdict, current: item.verdict,
          message: 'O veredito publicado na fonte foi alterado desde a captura anterior nesta sessão.',
          sourceUrl: item.sourceUrl
        });
      } else if (prior.noteHash !== noteHash) {
        appendEvent({
          type: 'contexto-atualizado', id: item.id, candidate: item.candidate,
          current: item.verdict,
          message: 'O texto de explicação publicado na fonte foi atualizado sem alteração de veredito.',
          sourceUrl: item.sourceUrl
        });
      }
      observed.set(item.id, { verdict: item.verdict, noteHash, seenAt: live.fetchedAt });
    }
    lastFreshAt = live.fetchedAt;
    previousSnapshot = fingerprint(live.claims
      .filter(isTrustedItem)
      .map(x => x.id + ':' + x.verdict + ':' + fingerprint(x.explanation))
      .sort()
      .join('|'));
  }
  return {
    startedAt,
    lastFreshAt,
    observations: observed.size,
    lastSnapshotFingerprint: previousSnapshot,
    persistence: 'memoria-da-instancia',
    notice: 'O histórico é referente à instância atual do servidor e será reiniciado em uma nova implantação. Verifique sempre o artigo original.',
    recent: events.slice(0, 30)
  };
}
export function isSourceValidated(item) {
  return isTrustedItem(item);
}
