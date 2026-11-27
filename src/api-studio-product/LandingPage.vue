<script setup lang="ts">
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
        <a href="#workflow">How it works</a>
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
            <a class="button-secondary" href="#workflow">See how it works</a>
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
