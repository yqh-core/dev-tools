import { debounce } from 'lodash';

function useDebouncedRef<T>(initialValue: T, delay: number, immediate: boolean = false) {
  const state = ref(initialValue);
  const debouncedRef = customRef((track, trigger) => ({
    get() {
      track();
      return state.value;
    },
    set: debounce(
      (value) => {
        state.value = value;
        trigger();
      },
      delay,
      { leading: immediate },
    ),
  }));
  return debouncedRef;
}
export default useDebouncedRef;
