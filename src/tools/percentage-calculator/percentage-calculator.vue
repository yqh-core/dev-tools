<script setup lang="ts">
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function resultText(value: number): string {
  return Number.isFinite(value) ? value.toString() : '';
}

const percentageX = ref();
const percentageY = ref();
const percentageResult = computed(() => {
  if (!isFiniteNumber(percentageX.value) || !isFiniteNumber(percentageY.value)) {
    return '';
  }
  return resultText(percentageX.value / 100 * percentageY.value);
});

const numberX = ref();
const numberY = ref();
const numberResult = computed(() => {
  if (!isFiniteNumber(numberX.value) || !isFiniteNumber(numberY.value) || numberY.value === 0) {
    return '';
  }
  return resultText(100 * numberX.value / numberY.value);
});

const numberFrom = ref();
const numberTo = ref();
const percentageIncreaseDecrease = computed(() => {
  if (!isFiniteNumber(numberFrom.value) || !isFiniteNumber(numberTo.value) || numberFrom.value === 0) {
    return '';
  }
  return resultText((numberTo.value - numberFrom.value) / numberFrom.value * 100);
});

const adjustmentValue = ref();
const adjustmentPercent = ref();
const increasedValue = computed(() => {
  if (!isFiniteNumber(adjustmentValue.value) || !isFiniteNumber(adjustmentPercent.value)) {
    return '';
  }
  return resultText(adjustmentValue.value * (1 + adjustmentPercent.value / 100));
});
const decreasedValue = computed(() => {
  if (!isFiniteNumber(adjustmentValue.value) || !isFiniteNumber(adjustmentPercent.value)) {
    return '';
  }
  return resultText(adjustmentValue.value * (1 - adjustmentPercent.value / 100));
});

const reverseFinalValue = ref();
const reversePercent = ref();
const originalBeforeIncrease = computed(() => {
  if (!isFiniteNumber(reverseFinalValue.value) || !isFiniteNumber(reversePercent.value)) {
    return '';
  }
  const factor = 1 + reversePercent.value / 100;
  if (factor === 0) {
    return '';
  }
  return resultText(reverseFinalValue.value / factor);
});
const originalBeforeDecrease = computed(() => {
  if (!isFiniteNumber(reverseFinalValue.value) || !isFiniteNumber(reversePercent.value)) {
    return '';
  }
  const factor = 1 - reversePercent.value / 100;
  if (factor === 0) {
    return '';
  }
  return resultText(reverseFinalValue.value / factor);
});

const differenceA = ref();
const differenceB = ref();
const percentageDifference = computed(() => {
  if (!isFiniteNumber(differenceA.value) || !isFiniteNumber(differenceB.value)) {
    return '';
  }
  const averageMagnitude = (Math.abs(differenceA.value) + Math.abs(differenceB.value)) / 2;
  if (averageMagnitude === 0) {
    return '';
  }
  return resultText(Math.abs(differenceA.value - differenceB.value) / averageMagnitude * 100);
});

const rateFrom = ref();
const rateTo = ref();
const percentagePointChange = computed(() => {
  if (!isFiniteNumber(rateFrom.value) || !isFiniteNumber(rateTo.value)) {
    return '';
  }
  return resultText(rateTo.value - rateFrom.value);
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

      <c-card mb-3 data-test-id="reverse-percentage-card">
        <div mb-3>
          Find the original value before a percentage increase or decrease
        </div>
        <div grid grid-cols-2 gap-2>
          <div>
            <div text-sm op-70 mb-1>Final value</div>
            <n-input-number v-model:value="reverseFinalValue" data-test-id="reverseFinalValue" placeholder="Final value" />
          </div>
          <div>
            <div text-sm op-70 mb-1>Percentage applied</div>
            <n-input-number v-model:value="reversePercent" data-test-id="reversePercent" placeholder="Percent" />
          </div>
        </div>
        <div grid grid-cols-2 gap-2 mt-2>
          <div>
            <div text-sm op-70 mb-1>Original before an increase</div>
            <input-copyable v-model:value="originalBeforeIncrease" data-test-id="originalBeforeIncrease" readonly placeholder="Result" />
          </div>
          <div>
            <div text-sm op-70 mb-1>Original before a decrease</div>
            <input-copyable v-model:value="originalBeforeDecrease" data-test-id="originalBeforeDecrease" readonly placeholder="Result" />
          </div>
        </div>
      </c-card>

      <c-card mb-3 data-test-id="percentage-difference-card">
        <div mb-3>
          Percentage difference between two values
        </div>
        <div grid grid-cols-2 gap-2>
          <n-input-number v-model:value="differenceA" data-test-id="differenceA" placeholder="Value A" />
          <n-input-number v-model:value="differenceB" data-test-id="differenceB" placeholder="Value B" />
        </div>
        <div mt-2>
          <div text-sm op-70 mb-1>Symmetric percentage difference</div>
          <input-copyable v-model:value="percentageDifference" data-test-id="percentageDifference" readonly placeholder="Result" />
        </div>
      </c-card>

      <c-card mb-3 data-test-id="percentage-points-card">
        <div mb-3>
          Percentage-point change between two rates
        </div>
        <div grid grid-cols-2 gap-2>
          <div>
            <div text-sm op-70 mb-1>Old rate (%)</div>
            <n-input-number v-model:value="rateFrom" data-test-id="rateFrom" placeholder="Old rate" />
          </div>
          <div>
            <div text-sm op-70 mb-1>New rate (%)</div>
            <n-input-number v-model:value="rateTo" data-test-id="rateTo" placeholder="New rate" />
          </div>
        </div>
        <div flex items-center gap-2 mt-2>
          <input-copyable v-model:value="percentagePointChange" data-test-id="percentagePointChange" readonly placeholder="Result" />
          <span text-sm op-70>percentage points</span>
        </div>
      </c-card>
    </div>

    <section class="mx-auto mt-8 max-w-800px px-4" data-test-id="percentage-calculator-guide">
      <h2 class="mb-3 text-xl font-semibold">How to calculate a percentage</h2>
      <p class="mb-4">
        Use the calculator above for seven common percentage problems: finding a percent of a number,
        expressing one number as a percent of another, measuring percentage change, applying an
        increase or decrease, reversing a percentage change, comparing two values symmetrically, and
        measuring percentage-point change between rates.
      </p>

      <h3 class="mb-2 text-lg font-semibold">Percentage formulas and examples</h3>
      <ul class="mb-4 list-disc pl-6">
        <li><strong>What is X% of Y?</strong> Calculate (X ÷ 100) × Y. Example: 15% of 80 is 12.</li>
        <li><strong>X is what percent of Y?</strong> Calculate (X ÷ Y) × 100. Example: 30 is 25% of 120.</li>
        <li><strong>Percentage change:</strong> Calculate ((new value − original value) ÷ original value) × 100. Example: a price rising from 80 to 92 is a 15% increase.</li>
        <li><strong>Increase or decrease by a percent:</strong> Multiply the starting value by (1 + p ÷ 100) to increase, or (1 − p ÷ 100) to decrease. Example: reducing 80 by 15% gives 68.</li>
        <li><strong>Reverse percentage:</strong> Divide a final value by (1 + p ÷ 100) to find the value before an increase, or by (1 − p ÷ 100) to reverse a decrease. For example, 120 after a 20% increase came from 120 ÷ 1.20 = 100.</li>
        <li><strong>Percentage difference:</strong> Divide the absolute difference by the average of the two values' absolute magnitudes, then multiply by 100. For 100 and 150, the symmetric difference is 40%.</li>
        <li><strong>Percentage points:</strong> Subtract the old rate from the new rate. A move from 5% to 7% is +2 percentage points, or +40% relative change.</li>
      </ul>

      <h3 class="mb-2 text-lg font-semibold">Discounts, sales tax and percentage change</h3>
      <p class="mb-4">
        For a discount, use the decrease calculation: subtract the discount percentage from the original
        price. To recover the pre-discount price from a sale price, use reverse percentage instead.
        For sales tax, use the increase calculation: add the tax percentage to the pre-tax price.
        For example, a 10% discount on 50 gives 45 before any additional taxes or fees; reversing that
        discount divides 45 by 0.90 to recover 50.
      </p>

      <h3 class="mb-2 text-lg font-semibold">Common percentage calculation mistakes</h3>
      <ul class="list-disc pl-6">
        <li>Percentage change uses the original value as its denominator, not the new value.</li>
        <li>Percentage difference uses the average magnitude of both values, not the original value as a baseline.</li>
        <li>A percentage change from an original value of zero is undefined; choose a non-zero starting value.</li>
        <li>A 15% increase followed by a 15% decrease does not return to the starting value, because the second change uses a different base.</li>
        <li>A percentage-point change is an absolute difference between rates, not the same as relative percentage change.</li>
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
        <h4 class="mb-1 font-semibold">How do I find the original value before a discount or increase?</h4>
        <p>
          Divide the final value by one plus the increase rate, or one minus the decrease rate. A
          $80 item after a 20% discount had an original price of 80 ÷ 0.80 = $100; adding 20% to $80
          would not reverse the discount.
        </p>
      </div>
      <div class="mb-4">
        <h4 class="mb-1 font-semibold">What is the difference between percentage change and percentage difference?</h4>
        <p>
          Percentage change is directional and uses the starting value as its base. Percentage
          difference is symmetric: it divides the absolute gap by the average magnitude of both
          values, so swapping A and B does not change the result.
        </p>
      </div>
      <div class="mb-4">
        <h4 class="mb-1 font-semibold">What is a percentage-point change?</h4>
        <p>
          It is the new rate minus the old rate. A move from 5% to 7% is +2 percentage points and
          +40% relative change; the two measurements answer different questions.
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
