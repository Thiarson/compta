import react from '@compta/eslint-config/react';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  ...react,
  {
    files: ['src/components/ui/sidebar.tsx'],
    rules: {
      'react-refresh/only-export-components': ['warn', { allowExportNames: ['useSidebar'] }],
    },
  },
]);
