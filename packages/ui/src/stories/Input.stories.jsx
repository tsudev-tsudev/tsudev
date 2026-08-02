import React from 'react';
import { Input } from '../components/Input';

export default {
  title: 'UI/Input',
  component: Input,
};

export const Default = (args) => <Input {...args} />;
Default.args = {
  id: 'story-input',
  label: 'Name',
  placeholder: 'Enter your name',
};
