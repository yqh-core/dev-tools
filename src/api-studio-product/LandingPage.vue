<script setup lang="ts">
import { computed, ref } from 'vue';

const workflows = [
  {
    number: '01',
    title: 'Send and inspect',
    description: 'Build an HTTP request, add query parameters or headers, then read the status, response headers and body.',
    tags: ['Methods', 'Params', 'Response'],
  },
  {
    number: '02',
    title: 'Keep work organized',
    description: 'Save requests in collections and folders. Reuse environment values across development and staging.',
    tags: ['Collections', 'Folders', 'Environments'],
  },
  {
    number: '03',
    title: 'Check what matters',
    description: 'Add response assertions and scripts, run a collection in order, and expand the result that needs attention.',
    tags: ['Assertions', 'Scripts', 'Runner'],
  },
];

const demoSteps = [
  {
    number: '01',
    label: 'Request',
    title: 'Shape the request',
    description: 'Choose an HTTP method, endpoint, query parameters and headers. Start with one clear request before adding more moving parts.',
  },
  {
    number: '02',
    label: 'Response',
    title: 'Read what came back',
    description: 'Send through the first-party relay, then inspect the upstream status, response headers and formatted body in one place.',
  },
  {
    number: '03',
    label: 'Assertions',
    title: 'Check the response',
    description: 'Add response assertions and scripts, then review which checks passed and which need attention.',
  },
  {
    number: '04',
    label: 'Collection run',
    title: 'Repeat the whole flow',
    description: 'Run saved requests in order, follow per-request progress, cancel safely and export a redacted run report.',
  },
];

const activeDemoStep = ref(0);
const currentDemoStep = computed(() => demoSteps[activeDemoStep.value] ?? demoSteps[0]);
</script>

<template>
  <div class="product-site">
    <header class="site-nav">
      <a class="site-brand" href="/" aria-label="API Studio home">
        <span class="site-brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none"><path d="M6 9h20M6 16h14M6 23h9" stroke="currentColor" stroke-width="2.7" stroke-linecap="round"/><circle cx="25" cy="23" r="2.5" fill="currentColor"/></svg>
        </span>
        <span class="site-brand-copy"><strong>API Studio</strong><small>by DigDevBox</small></span>
      </a>
      <nav class="site-nav-links" aria-label="Main navigation">
        <a href="#guided-demo">How it works</a>
        <a href="#features">What you can do</a>
        <a href="/docs/">Guides</a>
      </nav>
      <a class="nav-cta" href="/app/">Open workspace <span aria-hidden="true">↗</span></a>
    </header>

    <main>
      <section class="hero-section">
        <div class="hero-copy">
          <p class="eyebrow"><span class="eyebrow-dot"/> A focused API workbench</p>
          <h1>API work,<br/><span>without the busywork.</span></h1>
          <p class="hero-lede">Send a request. See what came back. Keep the next run ready. API Studio brings everyday API testing into one clear browser workspace.</p>
          <div class="hero-actions">
            <a class="button-primary" href="/app/">Open API Studio <span aria-hidden="true">→</span></a>
            <a class="button-secondary" href="#guided-demo">See how it works</a>
          </div>
          <div class="hero-assurances" aria-label="Getting started">
            <span><i aria-hidden="true">✓</i> No install</span>
            <span><i aria-hidden="true">✓</i> No account</span>
            <span><i aria-hidden="true">✓</i> Start with one request</span>
          </div>
        </div>

        <div class="hero-visual">
          <div class="visual-glow" aria-hidden="true"/>
          <div class="workbench-card">
            <div class="workbench-topline">
              <div class="window-dots" aria-hidden="true"><i/><i/><i/></div>
              <span>API STUDIO WORKSPACE</span>
              <span class="sample-label">GUIDED PREVIEW · SAMPLE DATA</span>
            </div>
            <div class="workbench-body">
              <aside class="preview-sidebar">
                <div class="preview-sidebar-title">COLLECTIONS <b>3</b></div>
                <div class="preview-tree selected"><span class="tree-cube">◇</span> Store API</div>
                <div class="preview-tree nested"><span class="method get">GET</span> List products</div>
                <div class="preview-tree nested"><span class="method post">POST</span> Create order</div>
                <div class="preview-tree"><span class="tree-folder">▱</span> Auth checks</div>
                <div class="preview-env"><small>ENVIRONMENT</small><strong><i/> Staging</strong></div>
              </aside>
              <div class="preview-editor">
                <div class="preview-request-title"><span>List products</span><span class="preview-save">Saved</span></div>
                <div class="request-bar"><b>GET</b><span>https://api.example.test/v1/products</span><button type="button" disabled>Send</button></div>
                <div class="request-tabs"><span class="active">Params</span><span>Headers</span><span>Body</span><span>Scripts</span></div>
                <div class="preview-param"><small>KEY</small><small>VALUE</small><span>limit</span><span>20</span></div>
                <div class="preview-param"><small>KEY</small><small>VALUE</small><span>active</span><span>true</span></div>
                <div class="response-divider"><span>RESPONSE</span><span class="response-status">200 OK <i>·</i> sample</span></div>
                <div class="response-meta"><span>JSON</span><span>Illustrative result · sample data</span></div>
                <pre>{
  "items": [
    { "id": 104, "name": "Canvas pack" },
    { "id": 105, "name": "Field notebook" }
  ],
  "next": null
}</pre>
              </div>
            </div>
            <div class="workbench-footer"><span><i/> Ready for your next request</span><span>Illustrative interface · not a live API call</span></div>
          </div>
          <div class="floating-note"><span class="floating-note-icon">✓</span><span><strong>Response checks</strong><small>Know what passed — and why.</small></span></div>
        </div>
      </section>

      <section class="trust-strip" aria-label="Product approach">
        <span>Made for the whole request journey</span>
        <b>Request</b><i>→</i><b>Response</b><i>→</i><b>Assertion</b><i>→</i><b>Repeat</b>
      </section>

      <section id="guided-demo" class="guided-demo-section section-wrap" aria-labelledby="guided-demo-title">
        <div class="guided-demo-heading">
          <p class="eyebrow">A FOUR-STEP WALKTHROUGH</p>
          <h2 id="guided-demo-title">One request.<br/><span>A repeatable result.</span></h2>
          <p>Choose a step to see how a simple API check grows into a repeatable workflow. This walkthrough is illustrative; it does not send a request.</p>
        </div>
        <div class="guided-demo-panel">
          <div class="guided-demo-steps" role="group" aria-label="Guided demo steps">
            <button
              v-for="(item, index) in demoSteps"
              :key="item.number"
              class="guided-demo-step"
              type="button"
              :aria-pressed="activeDemoStep === index"
              aria-controls="guided-demo-detail guided-demo-preview"
              @click="activeDemoStep = index"
            >
              <span class="guided-demo-index">{{ item.number }}</span>
              <span class="guided-demo-label">{{ item.label }}</span>
            </button>
          </div>
          <div id="guided-demo-detail" class="guided-demo-detail" aria-live="polite" aria-atomic="true">
            <div class="guided-demo-detail-meta">
              <span>STEP {{ currentDemoStep.number }}</span>
              <span>ILLUSTRATIVE · NO LIVE REQUEST</span>
            </div>
            <h3>{{ currentDemoStep.title }}</h3>
            <p>{{ currentDemoStep.description }}</p>
            <a class="guided-demo-link" href="/app/">Open the real workspace <span aria-hidden="true">→</span></a>
          </div>

          <div id="guided-demo-preview" class="guided-demo-preview" data-test-id="guided-demo-preview" aria-live="polite" aria-atomic="false">
            <div class="guided-demo-preview-bar">
              <div class="guided-demo-preview-context">
                <span class="guided-demo-preview-mark" aria-hidden="true">⌁</span>
                <span>ORDERS API <i>/</i> CHECKOUT FLOW</span>
              </div>
              <span class="guided-demo-fixture-badge">FIXTURE DATA · NOT EXECUTED</span>
            </div>

            <div v-if="activeDemoStep === 0" class="guided-demo-scene" data-test-id="guided-demo-scene-request">
              <div class="guided-demo-scene-main">
                <div class="guided-demo-scene-label">REQUEST DEFINITION</div>
                <div class="guided-demo-request-line">
                  <span class="guided-demo-method guided-demo-method-post">POST</span>
                  <code>https://api.example.test/v1/orders</code>
                </div>
                <div class="guided-demo-request-fields">
                  <div><small>ENVIRONMENT</small><strong><i/> Staging</strong></div>
                  <div><small>HEADER</small><strong>Content-Type: application/json</strong></div>
                  <div><small>QUERY</small><strong>validate=true</strong></div>
                </div>
                <div class="guided-demo-code-panel">
                  <div class="guided-demo-code-heading"><span>REQUEST BODY</span><span>JSON</span></div>
                  <pre>{
  "sku": "canvas-pack",
  "quantity": 2,
  "shipping": "standard"
}</pre>
                </div>
              </div>
              <aside class="guided-demo-scene-aside">
                <span class="guided-demo-scene-label">READY TO SEND</span>
                <strong>One request</strong>
                <p>Method, endpoint and payload are grouped in one request definition.</p>
                <span class="guided-demo-aside-note">No request is sent from this preview.</span>
              </aside>
            </div>

            <div v-else-if="activeDemoStep === 1" class="guided-demo-scene" data-test-id="guided-demo-scene-response">
              <div class="guided-demo-scene-main">
                <div class="guided-demo-scene-label">RESPONSE INSPECTION <span class="guided-demo-sample-note">SAMPLE RESPONSE</span></div>
                <div class="guided-demo-response-summary">
                  <div class="guided-demo-response-status"><b>201</b><span>Created</span></div>
                  <div><small>ELAPSED TIME</small><strong>14 ms</strong></div>
                  <div><small>CONTENT TYPE</small><strong>application/json</strong></div>
                </div>
                <div class="guided-demo-code-panel">
                  <div class="guided-demo-code-heading"><span>RESPONSE BODY</span><span>JSON · SAMPLE</span></div>
                  <pre>{
  "id": "ord_1042",
  "status": "accepted",
  "total": 48.00,
  "currency": "USD"
}</pre>
                </div>
              </div>
              <aside class="guided-demo-scene-aside">
                <span class="guided-demo-scene-label">WHAT TO CHECK</span>
                <strong>Read the response</strong>
                <p>Separate the upstream HTTP status from transport errors, then inspect headers and body.</p>
                <span class="guided-demo-aside-note">Status and timing are illustrative fixture values.</span>
              </aside>
            </div>

            <div v-else-if="activeDemoStep === 2" class="guided-demo-scene" data-test-id="guided-demo-scene-assertions">
              <div class="guided-demo-scene-main">
                <div class="guided-demo-scene-label">RESPONSE ASSERTIONS <span class="guided-demo-sample-note">SAMPLE RESULT</span></div>
                <div class="guided-demo-assertion-list">
                  <div class="guided-demo-assertion-row">
                    <span class="guided-demo-assertion-check" aria-hidden="true">✓</span>
                    <span><strong>Status code equals 201</strong><small>Response status</small></span>
                    <b>PASS</b>
                  </div>
                  <div class="guided-demo-assertion-row">
                    <span class="guided-demo-assertion-check" aria-hidden="true">✓</span>
                    <span><strong>JSON path $.id exists</strong><small>Response body</small></span>
                    <b>PASS</b>
                  </div>
                </div>
                <div class="guided-demo-assertion-total"><strong>2 passed</strong><span>·</span><span>0 failed</span><small>Illustrative fixture outcome</small></div>
              </div>
              <aside class="guided-demo-scene-aside">
                <span class="guided-demo-scene-label">VALIDATION</span>
                <strong>Make success explicit</strong>
                <p>Keep each rule beside its outcome so a failed check points to what needs attention.</p>
                <span class="guided-demo-aside-note">These checks are shown as sample data, not executed.</span>
              </aside>
            </div>

            <div v-else class="guided-demo-scene" data-test-id="guided-demo-scene-collection">
              <div class="guided-demo-scene-main">
                <div class="guided-demo-scene-label">COLLECTION RUN <span class="guided-demo-sample-note">SAMPLE RESULTS</span></div>
                <div class="guided-demo-run-summary"><strong>Checkout smoke tests</strong><span>3 requests · fixture run</span></div>
                <div class="guided-demo-run-list">
                  <div><span class="guided-demo-run-index">01</span><strong>GET /health</strong><span class="guided-demo-run-status">200 OK</span></div>
                  <div><span class="guided-demo-run-index">02</span><strong>POST /v1/orders</strong><span class="guided-demo-run-status">201 Created</span></div>
                  <div><span class="guided-demo-run-index">03</span><strong>GET /v1/orders/ord_1042</strong><span class="guided-demo-run-status">200 OK</span></div>
                </div>
                <div class="guided-demo-run-footer"><span>3 / 3 sample outcomes</span><span>Not a live collection run</span></div>
              </div>
              <aside class="guided-demo-scene-aside">
                <span class="guided-demo-scene-label">REPEATABLE WORK</span>
                <strong>From one request to a flow</strong>
                <p>Save related requests, reuse an environment and review each result in order.</p>
                <span class="guided-demo-aside-note">The fixture is illustrative; nothing runs in the background.</span>
              </aside>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" class="workflow-section section-wrap">
        <div class="section-heading">
          <p class="eyebrow">A SIMPLE, REPEATABLE FLOW</p>
          <h2>From “does it respond?”<br/><span>to “does it work?”</span></h2>
          <p>Start with one endpoint. Add structure only when it helps.</p>
        </div>
        <div class="workflow-grid">
          <article v-for="item in workflows" :key="item.number" class="workflow-card">
            <span class="workflow-number">{{ item.number }}</span>
            <h3>{{ item.title }}</h3>
            <p>{{ item.description }}</p>
            <div class="workflow-tags"><span v-for="tag in item.tags" :key="tag">{{ tag }}</span></div>
          </article>
        </div>
      </section>

      <section id="features" class="feature-section">
        <div class="section-wrap feature-layout">
          <div>
            <p class="eyebrow">BUILT AROUND REAL API TASKS</p>
            <h2>The details you need.<br/><span>Not another control panel.</span></h2>
            <p class="feature-intro">Keep the quick path quick. Open the deeper controls when your API work calls for them.</p>
            <a class="text-link" href="/docs/">Explore the practical guides <span aria-hidden="true">→</span></a>
          </div>
          <div class="feature-list">
            <article><span class="feature-icon">↗</span><div><h3>Requests that are easy to read</h3><p>Work with common HTTP methods, query parameters, headers and raw request bodies. Inspect status, headers and formatted response content.</p></div></article>
            <article><span class="feature-icon">▤</span><div><h3>Collections that stay understandable</h3><p>Group endpoints into folders, switch environments and reuse variables instead of rewriting the same URL each time.</p></div></article>
            <article><span class="feature-icon">✓</span><div><h3>Checks you can run again</h3><p>Use assertions and pre-request or response-test scripts. Review collection results request by request.</p></div></article>
            <article><span class="feature-icon">⇄</span><div><h3>Bring a Postman collection</h3><p>Import and export supported Postman v2.1 collection fields. Unsupported fields are called out; this is not full Postman parity.</p></div></article>
          </div>
        </div>
      </section>

      <section class="privacy-section section-wrap">
        <div class="privacy-mark" aria-hidden="true">⌁</div>
        <div class="privacy-copy">
          <p class="eyebrow">A STRAIGHTFORWARD DATA BOUNDARY</p>
          <h2>Your workspace lives here.<br/><span>Requests take the relay.</span></h2>
          <p>Collections and environment values are saved in this browser's site storage. When you send or run a request, its URL, headers and body pass through our first-party API relay.</p>
          <p>Secret masking helps prevent casual on-screen exposure, but it does not encrypt browser storage. Avoid saving production credentials in a shared browser profile.</p>
          <a class="text-link" href="/docs/privacy/">Read how data is handled <span aria-hidden="true">→</span></a>
        </div>
      </section>

      <section class="closing-section">
        <div class="closing-orbit" aria-hidden="true"/>
        <p class="eyebrow">YOUR NEXT API TEST STARTS HERE</p>
        <h2>Make the next request<br/><span>easier than the first.</span></h2>
        <p>No setup ceremony. Open the workspace and get to the part that matters.</p>
        <a class="button-primary" href="/app/">Open API Studio <span aria-hidden="true">→</span></a>
        <small>API Studio is an independent product by DigDevBox.</small>
      </section>
    </main>

    <footer class="site-footer">
      <a class="site-brand" href="/"><span class="site-brand-mark" aria-hidden="true">⌁</span><span class="site-brand-copy"><strong>API Studio</strong><small>by DigDevBox</small></span></a>
      <div><a href="/docs/">Guides</a><a href="/docs/privacy/">Data &amp; privacy</a><a href="https://www.digdevbox.com/">DigDevBox</a></div>
      <span>Focused API work. Clear results.</span>
    </footer>
  </div>
</template>
