import path from 'path';
import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'sf-formula-parser',
  tagline: 'Salesforce formulas, everywhere JavaScript runs',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://sf-formula-parser.dev',
  baseUrl: '/',

  organizationName: 'jetstreamapp',
  projectName: 'sf-formula-parser',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  plugins: [
    function aliasPlugin() {
      return {
        name: 'alias-local-package',
        configureWebpack() {
          return {
            resolve: {
              alias: {
                '@jetstreamapp/sf-formula-parser': path.resolve(__dirname, '..', 'dist', 'esm', 'index.mjs'),
              },
            },
          };
        },
      };
    },
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/jetstreamapp/sf-formula-parser/tree/main/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'sf-formula-parser',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/playground',
          label: 'Playground',
          position: 'left',
        },
        {
          href: 'https://github.com/austinturner/sf-formula-parser',
          label: 'GitHub',
          position: 'right',
        },
        {
          href: 'https://www.npmjs.com/package/sf-formula-parser',
          label: 'npm',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/getting-started',
            },
            {
              label: 'API Reference',
              to: '/docs/api-reference',
            },
            {
              label: 'Functions',
              to: '/docs/functions/logical',
            },
          ],
        },
        {
          title: 'Tools',
          items: [
            {
              label: 'Playground',
              to: '/playground',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/austinturner/sf-formula-parser',
            },
            {
              label: 'npm',
              href: 'https://www.npmjs.com/package/sf-formula-parser',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} sf-formula-parser. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
