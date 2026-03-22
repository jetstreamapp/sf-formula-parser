import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'getting-started',
    'api-reference',
    'record-context',
    'error-handling',
    {
      type: 'category',
      label: 'Functions',
      collapsed: false,
      items: ['functions/logical', 'functions/math', 'functions/text', 'functions/date-time'],
    },
  ],
};

export default sidebars;
