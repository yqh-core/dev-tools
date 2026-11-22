import { ref } from 'vue';
import { describe, expect, it } from 'vitest';
import { useFuzzySearch } from './fuzzySearch';

describe('useFuzzySearch', () => {
  it('rebuilds the Fuse index when reactive search data changes', () => {
    const data = ref([
      { title: 'JWT Parser' },
      { title: 'JSON Formatter' },
    ]);
    const { searchResult } = useFuzzySearch({
      search: 'jwt',
      data,
      options: { keys: ['title'], threshold: 0.3 },
    });

    expect(searchResult.value.map(item => item.title)).toEqual(['JWT Parser']);

    data.value = [
      { title: 'JWT Claims Decoder' },
      { title: 'JSON Formatter' },
    ];

    expect(searchResult.value.map(item => item.title)).toEqual(['JWT Claims Decoder']);
  });
});
