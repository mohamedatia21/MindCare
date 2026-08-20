import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CrisisOverlay } from '../src/components/CrisisOverlay';
import fs from 'fs';
import path from 'path';

describe('CrisisOverlay', () => {
  it('does not render when isActive is false', () => {
    const { container } = render(<CrisisOverlay isActive={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders emergency resources when isActive is true', () => {
    render(<CrisisOverlay isActive={true} region="US" />);
    expect(screen.getByText(/You don't have to handle/i)).toBeDefined();
    expect(screen.getByText('988 Suicide & Crisis Lifeline')).toBeDefined();
    expect(screen.getByText('988')).toBeDefined();
  });

  it('calls onDismiss when acknowledge button is clicked', () => {
    const onDismissMock = vi.fn();
    render(<CrisisOverlay isActive={true} region="EG" onDismiss={onDismissMock} />);
    
    const button = screen.getByText('I am safe to continue');
    fireEvent.click(button);
    
    expect(onDismissMock).toHaveBeenCalledTimes(1);
  });

  it('contains zero hardcoded clinical phrasing and makes no network/LLM calls', () => {
    const filePath = path.resolve(__dirname, '../src/components/CrisisOverlay.tsx');
    const sourceCode = fs.readFileSync(filePath, 'utf-8');

    expect(sourceCode).not.toMatch(/fetch\(/);
    expect(sourceCode).not.toMatch(/axios/);
    expect(sourceCode).not.toMatch(/XMLHttpRequest/);
    
    expect(sourceCode).not.toMatch(/async\s/);
    expect(sourceCode).not.toMatch(/await\s/);

    expect(sourceCode).toMatch(/STATIC_RESOURCES/);
  });
});
