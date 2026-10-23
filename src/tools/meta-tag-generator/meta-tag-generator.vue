<script setup lang="ts">
import { generateMeta } from '@it-tools/oggen';
import { chain, pickBy } from 'lodash';
import { image, ogSchemas, twitter, website } from './og-schemas';
import { toValidMetaMarkup } from './meta-tag.service';
import type { OGSchemaType, OGSchemaTypeElementSelect } from './OGSchemaType.type';
import TextareaCopyable from '@/components/TextareaCopyable.vue';

// Since type guards do not work in template

const metadata = ref<{ type: string; [k: string]: any }>({
  'type': 'website',
  'twitter:card': 'summary_large_image',
});

watch(
  () => ref(metadata.value.type),
  (_ignored, prevSection) => {
    const section = ogSchemas[prevSection.value];

    if (!section) {
      return;
    }

    section.elements.forEach(({ key }) => {
      metadata.value[key] = '';
    });
  },
);

const sections = computed(() => {
  const secs: OGSchemaType[] = [website, image, twitter];
  const additionalSchema = ogSchemas[metadata.value.type];

  if (additionalSchema) {
    secs.push(additionalSchema);
  }

  return secs;
});

const metaTags = computed(() => {
  const twitterMeta = chain(metadata.value)
    .pickBy((_value, k) => k.startsWith('twitter:'))
    .mapKeys((_value, k) => k.replace(/^twitter:/, ''))
    .value();

  const otherMeta = pickBy(metadata.value, (_value, k) => !k.startsWith('twitter:'));

  // oggen 1.3.0 把内容写在 value= 上，那是无效 markup；这页产出的是给人直接粘贴的代码，
  // 所以必须在出口处规范化，并由 meta-tag.service.test.ts 用真实 oggen 输出钉住。
  return toValidMetaMarkup(generateMeta({ ...otherMeta, twitter: twitterMeta }, { generateTwitterCompatibleMeta: true }));
});
</script>

<template>
  <div>
    <div v-for="{ name, elements } of sections" :key="name" style="margin-bottom: 15px">
      <div mb-5px>
        {{ name }}
      </div>

      <n-input-group v-for="{ key, type, label, placeholder, ...element } of elements" :key="key">
        <n-input-group-label style="flex: 0 0 110px">
          {{ label }}
        </n-input-group-label>

        <c-input-text v-if="type === 'input'" v-model:value="metadata[key]" :placeholder="placeholder" clearable />
        <n-dynamic-input
          v-else-if="type === 'input-multiple'"
          v-model:value="metadata[key]"
          :min="1"
          :placeholder="placeholder"
          :default-value="['']"
          :show-sort-button="true"
        />

        <c-select
          v-else-if="type === 'select'"
          v-model:value="metadata[key]"
          w-full
          :placeholder="placeholder"
          :options="(element as OGSchemaTypeElementSelect).options"
        />
      </n-input-group>
    </div>
  </div>
  <div>
    <n-form-item label="Your meta tags">
      <TextareaCopyable :value="metaTags" language="html" />
    </n-form-item>
  </div>
</template>

<style lang="less" scoped>
.n-input-group {
  margin-bottom: 5px;
}

::v-deep(.n-form-item-blank) {
  min-height: 0 !important;
}
::v-deep(.n-dynamic-input-item) {
  margin-bottom: 5px;
}
</style>
