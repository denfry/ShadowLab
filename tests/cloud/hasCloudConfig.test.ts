import { describe, it, expect } from 'vitest';
import { hasCloudConfig } from '@/services/supabase/client';

describe('hasCloudConfig', () => {
  it('is false when url or key is missing', () => {
    expect(hasCloudConfig({})).toBe(false);
    expect(hasCloudConfig({ url: 'x' })).toBe(false);
    expect(hasCloudConfig({ key: 'y' })).toBe(false);
  });
  it('is true when both are present', () => {
    expect(hasCloudConfig({ url: 'https://x.supabase.co', key: 'anon' })).toBe(true);
  });
});
