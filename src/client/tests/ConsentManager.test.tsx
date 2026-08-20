import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConsentManager } from '../../../src/client/src/components/ConsentManager';

describe('ConsentManager', () => {
  it('does not render when isVisible is false', () => {
    const { container } = render(<ConsentManager isVisible={false} onClose={() => {}} onConsentChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders and calls onConsentChange with proper values when saved', () => {
    const onConsentChangeMock = vi.fn();
    const onCloseMock = vi.fn();
    
    render(<ConsentManager isVisible={true} onClose={onCloseMock} onConsentChange={onConsentChangeMock} />);
    
    expect(screen.getByText('Data & Consent')).toBeDefined();
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    expect(onConsentChangeMock).toHaveBeenCalledWith({
      dataCollection: true,
      clinicalAnalysis: true
    });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
