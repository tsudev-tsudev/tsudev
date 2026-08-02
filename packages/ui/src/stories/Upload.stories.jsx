import React from 'react';
import { Upload } from '../index';

export default {
  title: 'UI/Upload',
  component: Upload,
};

export const Default = () => (
  <div className="sb-wrapper">
    <Upload
      onGetPresign={async (file) => ({ key: `mock/${file.name}` })}
      onUploadComplete={(res) => alert('Completed: ' + res.key)}
    />
  </div>
);
