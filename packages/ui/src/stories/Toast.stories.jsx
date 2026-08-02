import React from 'react';
import { Toast } from '../components/Toast';

export default {
  title: 'UI/Toast',
  component: Toast,
};

export const Info = () => <Toast message="This is an informational toast" />;
export const Error = () => <Toast message="Something went wrong" type="error" />;
