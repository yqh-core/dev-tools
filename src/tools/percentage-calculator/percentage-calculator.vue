<script setup lang="ts">
const percentageX = ref();
const percentageY = ref();
const percentageResult = computed(() => {
  if (percentageX.value === undefined || percentageY.value === undefined) {
    return '';
  }
  return (percentageX.value / 100 * percentageY.value).toString();
});

const numberX = ref();
const numberY = ref();
const numberResult = computed(() => {
  if (numberX.value === undefined || numberY.value === undefined) {
    return '';
  }
  const result = 100 * numberX.value / numberY.value;
  return (!Number.isFinite(result) || Number.isNaN(result)) ? '' : result.toString();
});

const numberFrom = ref();
const numberTo = ref();
const percentageIncreaseDecrease = computed(() => {
  if (numberFrom.value === undefined || numberTo.value === undefined) {
    return '';
  }
  const result = (numberTo.value - numberFrom.value) / numberFrom.value * 100;
  return (!Number.isFinite(result) || Number.isNaN(result)) ? '' : result.toString();
});

const adjustmentValue = ref();
const adjustmentPercent = ref();
const increasedValue = computed(() => {
  if (adjustmentValue.value === undefined || adjustmentPercent.value === undefined) {
    return '';
  }
  return (adjustmentValue.value * (1 + adjustmentPercent.value / 100)).toString();
});
const decreasedValue = computed(() => {
  if (adjustmentValue.value === undefined || adjustmentPercent.value === undefined) {
    return '';
  }
  return (adjustmentValue.value * (1 - adjustmentPercent.value / 100)).toString();
});
</script>

<template>
  <div style="flex: 0 0 100%">
    <div style="margin: 0 auto; max-width: 600px">
      <c-card mb-3>
        <div mb-3 sm:hidden>
          What is
        </div>
        <div flex gap-2>
          <div hidden pt-1 sm:block style="min-width: 48px;">
            What is
          </div>
          <n-input-number v-model:value="percentageX" data-test-id="percentageX" placeholder="X" />
          <div min-w-fit pt-1>
            % of
          </div>
          <n-input-number v-model:value="percentageY" data-test-id="percentageY" placeholder="Y" />
          <input-copyable v-model:value="percentageResult" data-test-id="percentageResult" readonly placeholder="Result" style="max-width: 150px;" />
        </div>
      </c-card>

      <c-card mb-3>
        <div mb-3 sm:hidden>
          X is what percent of Y
        </div>
        <div flex gap-2>
          <n-input-number v-model:value="numberX" data-test-id="numberX" placeholder="X" />
          <div hidden min-w-fit pt-1 sm:block>
            is what percent of
          </div>
          <n-input-number v-model:value="numberY" data-test-id="numberY" placeholder="Y" />
          <input-copyable v-model:value="numberResult" data-test-id="numberResult" readonly placeholder="Result" style="max-width: 150px;" />
        </div>
      </c-card>

      <c-card mb-3>
        <div mb-3>
          What is the percentage increase/decrease
        </div>
        <div flex gap-2>
          <n-input-number v-model:value="numberFrom" data-test-id="numberFrom" placeholder="From" />
          <n-input-number v-model:value="numberTo" data-test-id="numberTo" placeholder="To" />
          <input-copyable v-model:value="percentageIncreaseDecrease" data-test-id="percentageIncreaseDecrease" readonly placeholder="Result" style="max-width: 150px;" />
        </div>
      </c-card>

      <c-card mb-3>
        <div mb-3>
          Increase or decrease a value by a percentage
        </div>
        <div flex gap-2>
          <n-input-number v-model:value="adjustmentValue" data-test-id="adjustmentValue" placeholder="Value" />
          <div min-w-fit pt-1>
            by
          </div>
          <n-input-number v-model:value="adjustmentPercent" data-test-id="adjustmentPercent" placeholder="Percent" />
        </div>
        <div grid grid-cols-2 gap-2 mt-2>
          <div>
            <div text-sm op-70 mb-1>Increased</div>
            <input-copyable v-model:value="increasedValue" data-test-id="increasedValue" readonly placeholder="Result" />
          </div>
          <div>
            <div text-sm op-70 mb-1>Decreased</div>
            <input-copyable v-model:value="decreasedValue" data-test-id="decreasedValue" readonly placeholder="Result" />
          </div>
        </div>
      </c-card>
    </div>

    <section class="mx-auto mt-8 max-w-800px px-4" data-test-id="percentage-calculator-guide">
      <h2 class="mb-3 text-xl font-semibold">How to calculate a percentage</h2>
      <p class="mb-4">
        Use the calculator above for four common percentage problems: finding a percent of a number,
        expressing one number as a percent of another, measuring percentage change, and applying a
        percent increase or decrease.
      </p>

      <h3 class="mb-2 text-lg font-semibold">Percentage formulas and examples</h3>
      <ul class="mb-4 list-disc pl-6">
        <li><strong>What is X% of Y?</strong> Calculate (X ÷ 100) × Y. Example: 15% of 80 is 12.</li>
        <li><strong>X is what percent of Y?</strong> Calculate (X ÷ Y) × 100. Example: 30 is 25% of 120.</li>
        <li><strong>Percentage change:</strong> Calculate ((new value − original value) ÷ original value) × 100. Example: a price rising from 80 to 92 is a 15% increase.</li>
        <li><strong>Increase or decrease by a percent:</strong> Multiply the starting value by (1 + p ÷ 100) to increase, or (1 − p ÷ 100) to decrease. Example: reducing 80 by 15% gives 68.</li>
      </ul>

      <h3 class="mb-2 text-lg font-semibold">Discounts, sales tax and percentage change</h3>
      <p class="mb-4">
        For a discount, use the decrease calculation: subtract the discount percentage from the original
        price. For sales tax, use the increase calculation: add the tax percentage to the pre-tax price.
        For example, a 10% discount on 50 gives 45 before any additional taxes or fees.
      </p>

      <h3 class="mb-2 text-lg font-semibold">Common percentage calculation mistakes</h3>
      <ul class="list-disc pl-6">
        <li>Percentage change uses the original value as its denominator, not the new value.</li>
        <li>A percentage change from an original value of zero is undefined; choose a non-zero starting value.</li>
        <li>A 15% increase followed by a 15% decrease does not return to the starting value, because the second change uses a different base.</li>
      </ul>

      <h3 class="mb-2 text-lg font-semibold">Common percentage questions</h3>
      <div class="mb-4">
        <h4 class="mb-1 font-semibold">How do I calculate a percentage of a number?</h4>
        <p>
          Divide the percentage by 100, then multiply by the number. For example, 18% of 250 is
          (18 ÷ 100) × 250 = 45.
        </p>
      </div>
      <div class="mb-4">
        <h4 class="mb-1 font-semibold">How do I find what percentage one number is of another?</h4>
        <p>
          Divide the first number by the total, then multiply by 100. For example, 45 out of 250 is
          (45 ÷ 250) × 100 = 18%. The total cannot be zero.
        </p>
      </div>
      <div class="mb-4">
        <h4 class="mb-1 font-semibold">How do I calculate percentage increase or decrease?</h4>
        <p>
          Subtract the original value from the new value, divide by the original value, and multiply
          by 100. A positive result is an increase; a negative result is a decrease. An original
          value of zero makes percentage change undefined.
        </p>
      </div>
      <div class="mb-4">
        <h4 class="mb-1 font-semibold">How do I calculate a discount or add sales tax?</h4>
        <p>
          Apply a discount with the decrease calculator and add a tax rate with the increase
          calculator. If both apply, calculate each step using the updated amount; actual tax rules
          depend on the product and location.
        </p>
      </div>
    </section>
  </div>
</template>
