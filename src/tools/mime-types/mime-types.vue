<script setup lang="ts">
import { types as extensionToMimeType, extensions as mimeTypeToExtension } from 'mime-types';
import { useFuzzySearch } from '@/composable/fuzzySearch';

const mimeInfos = Object.entries(mimeTypeToExtension).map(([mimeType, extensions]) => ({ mimeType, extensions }));

// 与 http-headers / linux-commands / ascii-table 同一族谱：参考表用 fuzzySearch 收窄。
// mime-types 是这一族里唯一没有搜索入口的页 —— 965 行的表在手机上本来就读不动。
const search = ref('');

// Fuse 匹配的是字符串字段，所以给每行准备一份「扩展名摊平成文本」的检索副本。
// ⚠ 不改 mimeInfos 本体：它同时是 c-table 的整表数据源，多带一个字段会污染表头推断。
const searchRows = mimeInfos.map(row => ({ ...row, extensionText: (row.extensions as string[]).join(' ') }));

const { searchResult } = useFuzzySearch({
  search,
  data: searchRows,
  options: { keys: [{ name: 'mimeType', weight: 3 }, { name: 'extensionText', weight: 2 }] },
});

const rows = computed(() => (search.value ? searchResult.value : []));

// 「展开全部」是持久化偏好：搜索型访问者不该每次进来都被 965 行砸一次首屏，
// 但一旦有人明确要通读，就不该再被他下次进来打回原形。
const showAllRows = useLocalStorage('mime-types-show-all-rows', false);

const mimeToExtensionsOptions = Object.keys(mimeTypeToExtension).map(label => ({ label, value: label }));
const selectedMimeType = ref(undefined);

const extensionsFound = computed(() => (selectedMimeType.value ? mimeTypeToExtension[selectedMimeType.value] : []));

const extensionToMimeTypeOptions = Object.keys(extensionToMimeType).map((label) => {
  const extension = `.${label}`;

  return { label: extension, value: label };
});
const selectedExtension = ref(undefined);

const mimeTypeFound = computed(() => (selectedExtension.value ? extensionToMimeType[selectedExtension.value] : []));
</script>

<template>
  <c-card>
    <n-h2 style="margin-bottom: 0">
      Mime type to extension
    </n-h2>
    <div style="opacity: 0.8">
      Know which file extensions are associated to a mime-type
    </div>
    <c-select
      v-model:value="selectedMimeType"
      searchable
      my-4
      :options="mimeToExtensionsOptions"
      placeholder="Select your mimetype here... (ex: application/pdf)"
    />

    <div v-if="extensionsFound.length > 0">
      Extensions of files with the <n-tag round :bordered="false">
        {{ selectedMimeType }}
      </n-tag> mime-type:
      <div style="margin-top: 10px">
        <n-tag
          v-for="extension of extensionsFound"
          :key="extension"
          round
          :bordered="false"
          type="primary"
          style="margin-right: 10px"
        >
          .{{ extension }}
        </n-tag>
      </div>
    </div>
  </c-card>

  <c-card>
    <n-h2 style="margin-bottom: 0">
      File extension to mime type
    </n-h2>
    <div style="opacity: 0.8">
      Know which mime type is associated to a file extension
    </div>
    <c-select
      v-model:value="selectedExtension"
      searchable
      my-4
      :options="extensionToMimeTypeOptions"
      placeholder="Select your mimetype here... (ex: application/pdf)"
    />

    <div v-if="selectedExtension">
      Mime type associated to the extension <n-tag round :bordered="false">
        {{ selectedExtension }}
      </n-tag> file
      extension:
      <div style="margin-top: 10px">
        <n-tag round :bordered="false" type="primary" style="margin-right: 10px">
          {{ mimeTypeFound }}
        </n-tag>
      </div>
    </div>
  </c-card>

  <div>
    <c-input-text
      v-model:value="search"
      placeholder="Search the full list, e.g. json / audio / 3gp…"
      raw-text
      clearable
      mb-4
    />

    <div mb-2 text-13px op-60>
      <template v-if="search">
        {{ rows.length }} of {{ mimeInfos.length }} entries
      </template>
      <template v-else-if="showAllRows">
        All {{ mimeInfos.length }} entries —
        <c-button text size="small" @click="showAllRows = false">
          collapse
        </c-button>
      </template>
      <template v-else>
        {{ mimeInfos.length }} registered mime types —
        <c-button text size="small" @click="showAllRows = true">
          show the full table
        </c-button>
      </template>
    </div>

    <!--
      三种状态各自明确（v-if 全部放在外层 div 上：v-for 与 v-if 同标签是 lint 的
      no-useless-v-if / vue 的顺序陷阱，命中与否本来互斥，没必要让两者共处一行）：
        搜索中 → 只渲染命中行（无上限风险，也不逼用户滚 965 行）
        展开全部 → 渲染整表，但**必须**走 c-table：它自带 overflow-x-auto 的滚动壳，
                   宽表在手机上「横向可滑」而不是被裁成看不见的半截（见 tool.layout.vue 的修复说明）。
        默认 → 不渲染长表，把入口交给上面的搜索框与「show the full table」。
    -->
    <div v-if="search">
      <c-card v-for="item of rows" :key="item.mimeType" mb-2>
        <div flex flex-wrap items-baseline gap-2>
          <span text-16px font-bold font-mono>{{ item.mimeType }}</span>
        </div>
        <div mt-1>
          <n-tag v-for="extension of item.extensions" :key="extension" round :bordered="false" type="primary" style="margin-right: 10px">
            .{{ extension }}
          </n-tag>
        </div>
      </c-card>

      <c-alert v-if="rows.length === 0">
        No matching mime type. Try a fragment like json, audio or svg.
      </c-alert>
    </div>

    <c-table
      v-else-if="showAllRows"
      :data="mimeInfos"
      :headers="{ mimeType: 'Mime types', extensions: 'Extensions' }"
      description="All registered mime types and their file extensions"
      mb-2
    >
      <template #extensions="{ row }">
        <n-tag v-for="extension of row.extensions" :key="extension" round :bordered="false" style="margin-right: 10px">
          .{{ extension }}
        </n-tag>
      </template>
    </c-table>
  </div>
</template>
