import React from 'react';
import { SiteHeader } from '../index';

export default {
  title: 'UI/Header',
  component: SiteHeader,
};

export const Default = () => (
  <div className="sb-wrapper">
    <SiteHeader title="tsudev" />
  </div>
);
