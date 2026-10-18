<script setup lang="ts">
import RandExp from 'randexp';
import { render } from '@regexper/render';
import type { ShadowRootExpose } from 'vue-shadow-dom';
import { matchRegex } from './regex-tester.service';
import { useValidation } from '@/composable/validation';
import { useQueryParamOrStorage } from '@/composable/queryParams';

const regex = useQueryParamOrStorage({ name: 'regex', storageName: 'regex-tester:regex', defaultValue: '' });
const text = ref('');
const global = ref(true);
const ignoreCase = ref(false);
const multiline = ref(false);
const dotAll = ref(true);
const unicode = ref(true);
const unicodeSets = ref(false);
const visualizerSVG = ref<ShadowRootExpose>();

const regexValidation = useValidation({
  source: regex,
  rules: [
    {
      message: 'Invalid regex: {0}',
      validator: value => new RegExp(value),
      getErrorMessage: (value) => {
        const _ = new RegExp(value);
        return '';
      },
    },
  ],
});
const results = computed(() => {
  let flags = 'd';
  if (global.value) {
    flags += 'g';
  }
  if (ignoreCase.value) {
    flags += 'i';
  }
  if (multiline.value) {
    flags += 'm';
  }
  if (dotAll.value) {
    flags += 's';
  }
  if (unicode.value) {
    flags += 'u';
  }
  else if (unicodeSets.value) {
    flags += 'v';
  }

  try {
    return matchRegex(regex.value, text.value, flags);
  }
  catch (_) {
    return [];
  }
});

const sample = computed(() => {
  try {
    const randexp = new RandExp(new RegExp(regex.value.replace(/\(\?\<[^\>]*\>/g, '(?:')));
    return randexp.gen();
  }
  catch (_) {
    return '';
  }
});

watchEffect(
  async () => {
    const regexValue = regex.value;
    // shadow root is required:
    // @regexper/render append a <defs><style> that broke svg transparency of icons in the whole site
    const visualizer = visualizerSVG.value?.shadow_root;
    if (visualizer) {
      while (visualizer.lastChild) {
        visualizer.removeChild(visualizer.lastChild);
      }
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      try {
        await render(regexValue, svg);
      }
      catch (_) {
      }
      visualizer.appendChild(svg);
    }
  },
);
</script>

<template>
  <div max-w-600px>
    <c-card title="Regex" mb-1>
      <c-input-text
        v-model:value="regex"
        label="Regex to test:"
        placeholder="Put the regex to test"
        multiline
        rows="3"
        :validation="regexValidation"
      />
      <router-link target="_blank" to="/regex-memo" mb-1 mt-1>
        See Regular Expression Cheatsheet
      </router-link>
      <n-space>
        <n-checkbox v-model:checked="global">
          <span title="Global search">Global search. (<code>g</code>)</span>
        </n-checkbox>
        <n-checkbox v-model:checked="ignoreCase">
          <span title="Case-insensitive search">Case-insensitive search. (<code>i</code>)</span>
        </n-checkbox>
        <n-checkbox v-model:checked="multiline">
          <span title="Allows ^ and $ to match next to newline characters.">Multiline(<code>m</code>)</span>
        </n-checkbox>
        <n-checkbox v-model:checked="dotAll">
          <span title="Allows . to match newline characters.">Singleline(<code>s</code>)</span>
        </n-checkbox>
        <n-checkbox v-model:checked="unicode">
          <span title="Unicode; treat a pattern as a sequence of Unicode code points.">Unicode(<code>u</code>)</span>
        </n-checkbox>
        <n-checkbox v-model:checked="unicodeSets">
          <span title="An upgrade to the u mode with more Unicode features.">Unicode Sets (<code>v</code>)</span>
        </n-checkbox>
      </n-space>

      <n-divider />

      <c-input-text
        v-model:value="text"
        label="Text to match:"
        placeholder="Put the text to match"
        multiline
        rows="5"
      />
    </c-card>

    <c-card title="Matches" mb-1 mt-3>
      <!--
        滚动壳：与 ipv4-subnet-calculator 同款的 `overflow-x-auto + max-w-full` 收口。
        「Matches」表有 Index / Value / Captures / Groups 四列，Value 与 Captures 里装的是
        匹配到的原文和 `"name" = value [start - end]` —— 用常见的邮箱/URL 正则一测，
        390px 视口下这张表固有宽就到 ~546px（长邮箱更多），右边缘越过视口 ~599px，
        而祖先链上没有可滚容器（naive-ui 的 .n-table 只 overflow-x:hidden，裁而不滚），
        实测 6/12 单元格「滚不进视口」（脚本 scripts/probe-mobile-overflow.mjs）。
        这正是任务1 已给 subnet-calculator 补过、但漏了同族 regex-tester 的那个缺陷。
        max-w-full 不能省：否则壳自己就比视口宽，等于把溢出往里挪一层。
      -->
      <div v-if="results?.length > 0" class="relative max-w-full overflow-x-auto rounded">
        <n-table>
          <thead>
            <tr>
              <th scope="col">
                Index in text
              </th>
              <th scope="col">
                Value
              </th>
              <th scope="col">
                Captures
              </th>
              <th scope="col">
                Groups
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="match of results" :key="match.index">
              <td>{{ match.index }}</td>
              <td>{{ match.value }}</td>
              <td>
                <ul>
                  <li v-for="capture in match.captures" :key="capture.name">
                    "{{ capture.name }}" = {{ capture.value }} [{{ capture.start }} - {{ capture.end }}]
                  </li>
                </ul>
              </td>
              <td>
                <ul>
                  <li v-for="group in match.groups" :key="group.name">
                    "{{ group.name }}" = {{ group.value }} [{{ group.start }} - {{ group.end }}]
                  </li>
                </ul>
              </td>
            </tr>
          </tbody>
        </n-table>
      </div>
      <c-alert v-else>
        No match
      </c-alert>
    </c-card>

    <c-card title="Sample matching text" mt-3>
      <pre style="white-space: pre-wrap; word-break: break-all;">{{ sample }}</pre>
    </c-card>

    <c-card title="Regex Diagram" style="overflow-x: scroll;" mt-3>
      <shadow-root ref="visualizerSVG">
&#xa0;
      </shadow-root>
    </c-card>
  </div>
</template>
