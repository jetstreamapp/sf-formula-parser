import type { ReactNode } from 'react';
import Heading from '@theme/Heading';

type FeatureItem = {
  icon: string;
  title: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    icon: 'fx',
    title: '90+ Functions',
    description: <>Logical, math, text, and date/time functions — all matching real Salesforce behavior, including edge cases.</>,
  },
  {
    icon: '0',
    title: 'Zero Dependencies',
    description: (
      <>Pure TypeScript compiled to ESM. No Node.js APIs, no runtime dependencies. Works in browsers, Node, Deno, and edge functions.</>
    ),
  },
  {
    icon: '{}',
    title: 'Full AST Access',
    description: <>Parse formulas into a typed AST for inspection, caching, or building your own tooling on top of the formula language.</>,
  },
  {
    icon: 'Aa',
    title: 'Case-Insensitive',
    description: (
      <>
        <code>IF</code>, <code>if</code>, <code>If</code> — all work, just like Salesforce. No surprises.
      </>
    ),
  },
  {
    icon: '?:',
    title: 'Lazy Evaluation',
    description: (
      <>
        <code>IF</code>, <code>CASE</code>, <code>IFS</code> only evaluate the branch that&apos;s taken. Side effects in untaken branches
        are skipped.
      </>
    ),
  },
  {
    icon: '->',
    title: 'Related Records',
    description: (
      <>
        Traverse relationships like <code>Account.Name</code> or <code>Contact.Account.Industry</code> with nested record contexts.
      </>
    ),
  },
];

function Feature({ icon, title, description }: FeatureItem) {
  return (
    <div className="col col--4" style={{ marginBottom: '1.5rem' }}>
      <div className="feature-card">
        <span
          className="feature-icon"
          style={{ fontFamily: 'var(--ifm-font-family-monospace)', fontWeight: 700, color: 'var(--ifm-color-primary)' }}
        >
          {icon}
        </span>
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className="features-section">
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
