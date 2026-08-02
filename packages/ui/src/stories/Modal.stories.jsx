import React from 'react';
import { Modal } from '../components/Modal';

export default {
  title: 'UI/Modal',
  component: Modal,
};

export const Open = () => (
  <Modal open={true} title="Example Modal">
    <p>This is modal content used in Storybook.</p>
  </Modal>
);
