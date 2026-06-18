import type { CaseProgress, CaseSummary, DetectiveCase } from '../domain/types';

/** Loads case content (JSON authored separately from code) and builds a fresh
 *  progress object. v2 swaps the fetch for a Supabase `detective_cases` query. */
class CaseManagerImpl {
  private cache = new Map<string, DetectiveCase>();
  private catalog: CaseSummary[] | null = null;

  async loadCatalog(): Promise<CaseSummary[]> {
    if (this.catalog) return this.catalog;
    try {
      const res = await fetch('/data/cases/index.json');
      if (!res.ok) throw new Error(String(res.status));
      this.catalog = (await res.json()) as CaseSummary[];
    } catch {
      this.catalog = [];
    }
    return this.catalog;
  }

  async load(caseId: string): Promise<DetectiveCase> {
    const cached = this.cache.get(caseId);
    if (cached) return cached;
    const res = await fetch(`/data/cases/${caseId}.json`);
    if (!res.ok) throw new Error(`Не удалось загрузить дело: ${caseId}`);
    const data = (await res.json()) as DetectiveCase;
    this.cache.set(caseId, data);
    return data;
  }

  freshProgress(caseId: string): CaseProgress {
    return {
      caseId,
      phase: 'intro',
      discovered: [],
      connections: [],
      answers: {},
    };
  }
}

export const CaseManager = new CaseManagerImpl();

/** Default case if a launch arrives without ?case=. */
export const FIRST_CASE_ID = 'missing-researcher';

/** Stable slot per case = its index in the catalog (set in index.json order). */
export const CASE_SLOTS: Record<string, number> = {
  'missing-researcher': 0,
  'gallery-forgery': 1,
};

export const recordKey = {
  caseBestScore: (caseId: string) => `case.${caseId}.bestScore`,
  caseSolved: (caseId: string) => `case.${caseId}.solved`,
};
