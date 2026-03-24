import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';

function HomepageHeader() {
  return (
    <header className="hero--sf">
      <div className="container" style={{ textAlign: 'center' }}>
        <Heading as="h1">sf-formula-parser</Heading>
        <p>Parse and evaluate Salesforce formulas entirely client-side. Zero dependencies. 90+ functions. TypeScript-first.</p>

        <div className="hero-code">
          <div>
            <span className="code-keyword">import</span> {'{ evaluateFormula }'} <span className="code-keyword">from</span>{' '}
            <span className="code-string">'sf-formula-parser'</span>;
          </div>
          <br />
          <div>
            <span className="code-keyword">const</span> result = <span className="code-fn">evaluateFormula</span>(
          </div>
          <div style={{ paddingLeft: '1.5rem' }}>
            <span className="code-string">'IF(Amount &gt; 1000, "Large", "Small")'</span>,
          </div>
          <div style={{ paddingLeft: '1.5rem' }}>
            {'{ record: { Amount: '}
            <span className="code-number">5000</span>
            {' } }'}
          </div>
          <div>);</div>
          <div>
            <span className="code-comment">{'// => "Large"'}</span>
          </div>
        </div>

        <div className="install-cmd">
          <span style={{ opacity: 0.5 }}>$</span> npm install @jetstreamapp/sf-formula-parser
        </div>

        <div
          style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Link className="button button--primary button--lg" to="/docs/getting-started">
            Get Started
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/playground"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.25)',
              color: '#fff',
            }}
          >
            Try the Playground
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/llms-full.txt"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.8)',
              fontSize: '0.9rem',
            }}
          >
            LLM Docs
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title="Salesforce formulas in JavaScript"
      description="Parse and evaluate Salesforce formulas client-side with zero dependencies. 90+ functions, full AST access, TypeScript-first."
    >
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
