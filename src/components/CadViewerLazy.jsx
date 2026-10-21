import React from 'react';
import { CadViewer } from '@cadview/react';

export const CadViewerLazy = ({ buffer }) => (
  <CadViewer
    file={buffer}
    theme="dark"
    tool="pan"
    style={{ width: '100%', height: '560px' }}
  />
);
