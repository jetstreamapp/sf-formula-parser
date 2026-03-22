import type { ReactNode } from 'react';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import FormulaPlayground from '@site/src/components/FormulaPlayground';

export default function PlaygroundPage(): ReactNode {
  return (
    <Layout title="Playground" description="Try Salesforce formulas live in your browser">
      <div className="container" style={{ padding: '2rem 0 4rem', maxWidth: '1100px' }}>
        <Heading as="h1">Formula Playground</Heading>
        <p style={{ fontSize: '1.1rem', color: 'var(--ifm-color-emphasis-700)', marginBottom: '2rem' }}>
          Write a Salesforce formula, provide a record context, and see the result instantly. Pick an example below or write your own.
        </p>
        <FormulaPlayground />
      </div>
    </Layout>
  );
}
