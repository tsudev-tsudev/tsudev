import React from 'react';
import { Card } from '../components/Card';

export default {
  title: 'UI/Card',
  component: Card,
};

export const Default = () => (
  <Card>
    <h3 className="text-lg font-semibold">Card title</h3>
    <p className="text-sm text-gray-600 mt-2">This is a preview of the Card component.</p>
  </Card>
);
